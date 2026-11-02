/**
 * The private `meal-photos` bucket, reached over Storage's REST API.
 *
 * No `@supabase/supabase-js`. The three calls needed here — put an object, get
 * a signed URL, delete an object — are plain HTTP, and a client library would
 * add a dependency and a version to keep pinned for no behaviour we use.
 *
 * Access control is worth being explicit about, because it is not RLS. This
 * project authenticates with Better Auth, so Postgres sees the table owner and
 * `auth.uid()` is always null; a Storage policy keyed on it could never match.
 * The bucket therefore has **no `anon` or `authenticated` grant at all**, and
 * every object passes through this module with the service-role key. What
 * keeps one user out of another's photos is that `objectPath` is built from a
 * `userId` the caller resolved from a verified session — never from anything
 * the browser sent. That is the whole guard, so it is centralised here rather
 * than spelled out at each call site.
 */

const BUCKET = "meal-photos";

/** How long a signed read URL lives. Long enough to render, not to share. */
const SIGNED_URL_TTL_SECONDS = 120;

export type MealPhotoStorage = {
  readonly kind: "supabase" | "null";
  /** Resolves false when the object could not be stored. Never throws. */
  put(path: string, body: Uint8Array, contentType: string): Promise<boolean>;
  /** A short-lived read URL, or null when unavailable. */
  signedUrl(path: string): Promise<string | null>;
  remove(path: string): Promise<void>;
};

/**
 * The object path for a photo. The only place this is constructed.
 *
 * `{userId}/{mealPhotoId}.jpg` — the user prefix is what makes a stray path
 * useless to anyone else, and both halves are server-generated ids.
 */
export function objectPath(userId: string, mealPhotoId: string, extension = "jpg"): string {
  return `${userId}/${mealPhotoId}.${extension}`;
}

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return { url, key };
}

/**
 * Used when SUPABASE_SERVICE_ROLE_KEY is unset.
 *
 * `put` fails rather than pretending to succeed: a stored row pointing at an
 * object that was never written is worse than a refused upload, because the
 * failure would surface later as a broken image with no explanation.
 */
const nullStorage: MealPhotoStorage = {
  kind: "null",

  async put() {
    return false;
  },

  async signedUrl() {
    return null;
  },

  async remove() {},
};

function supabaseStorage(url: string, key: string): MealPhotoStorage {
  const headers = { Authorization: `Bearer ${key}`, apikey: key };

  return {
    kind: "supabase",

    async put(path, body, contentType) {
      try {
        const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": contentType,
            /* Replace rather than conflict: the path is derived from the photo
               row's own id, so a second write to it is a retry of the same
               upload, not a different photo. */
            "x-upsert": "true",
          },
          body: new Uint8Array(body) as unknown as BodyInit,
        });

        if (!response.ok) {
          console.error(`[meal-photo-storage] put ${response.status}`);
          return false;
        }

        return true;
      } catch (error) {
        console.error(`[meal-photo-storage] put ${message(error)}`);
        return false;
      }
    },

    async signedUrl(path) {
      try {
        const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
        });

        if (!response.ok) {
          console.error(`[meal-photo-storage] sign ${response.status}`);
          return null;
        }

        const payload: unknown = await response.json();
        const signed =
          typeof payload === "object" && payload !== null
            ? (payload as { signedURL?: string; signedUrl?: string })
            : {};

        const relative = signed.signedURL ?? signed.signedUrl;
        if (!relative) return null;

        /* The API returns a path relative to /storage/v1. */
        return `${url}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
      } catch (error) {
        console.error(`[meal-photo-storage] sign ${message(error)}`);
        return null;
      }
    },

    /**
     * Best-effort. Called when an upload half-failed and the row is being
     * abandoned, so a throw here would replace a recoverable mess with an
     * error the user cannot act on.
     */
    async remove(path) {
      try {
        await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
          method: "DELETE",
          headers,
        });
      } catch (error) {
        console.error(`[meal-photo-storage] remove ${message(error)}`);
      }
    },
  };
}

export function getMealPhotoStorage(): MealPhotoStorage {
  const settings = config();
  if (!settings) return nullStorage;

  return supabaseStorage(settings.url, settings.key);
}

export function photoStorageConnected(): boolean {
  return getMealPhotoStorage().kind !== "null";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
