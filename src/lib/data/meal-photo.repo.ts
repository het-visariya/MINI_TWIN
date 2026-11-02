/**
 * The meal-photo lifecycle: PENDING → ANALYZING → READY → CONFIRMED, or FAILED.
 *
 * The ordering here is the feature's main guarantee, so it is worth saying why
 * it is shaped this way. A photo row is created *before* the object is
 * uploaded and long before any `MealLog` exists, because the user has to
 * confirm the detected rows first and may well never do so. That gives two
 * useful properties:
 *
 *   - An abandoned upload is an identifiable orphan — `status` short of
 *     CONFIRMED with a null `mealLogId` — and can be swept without having to
 *     guess whether it mattered.
 *   - Nothing the provider returned is ever on the user's record. It sits in
 *     `detectedJson` as the provider's claim, not the user's log.
 *
 * Every query is filtered by `userId`, and the ones that act on a single photo
 * use `findFirst({ where: { id, userId } })` rather than `findUnique({ id })`
 * so an id belonging to another user reads as "not found" instead of as a
 * permission error — which is both the safer default and less informative to
 * someone probing ids.
 */

import { getPrisma } from "@/lib/db";
import type { FoodAnalysisPayload } from "@/lib/validation/food-vision";
import {
  getMealPhotoStorage,
  objectPath,
  type MealPhotoStorage,
} from "@/lib/integrations/meal-photo-storage";
import type { FoodVisionProviderKind } from "@/lib/integrations/food-vision";
import { sourceForProvider } from "@/lib/integrations/food-vision";

export type MealPhotoView = {
  id: string;
  status: "PENDING" | "ANALYZING" | "READY" | "CONFIRMED" | "FAILED";
  storagePath: string;
  detected: FoodAnalysisPayload | null;
  /** Which provider produced `detected`. Null before analysis succeeded. */
  source: "PHOTO_GEMINI" | "PHOTO_LOGMEAL" | null;
  failureNote: string | null;
  /** Short-lived signed URL, or null when storage is not configured. */
  url: string | null;
};

export type MealPhotoRepo = {
  /** A row and its object path, before anything is uploaded. */
  create(): Promise<{ id: string; storagePath: string }>;
  markAnalyzing(id: string): Promise<void>;
  saveAnalysis(
    id: string,
    detected: FoodAnalysisPayload,
    provider: FoodVisionProviderKind,
  ): Promise<void>;
  markFailed(id: string, note: string): Promise<void>;
  get(id: string): Promise<MealPhotoView | null>;
  /** Drops the row and its object. Used when the user discards a reading. */
  discard(id: string): Promise<void>;
};

export function mealPhotoRepoForUser(userId: string): MealPhotoRepo {
  const prisma = getPrisma();
  const storage: MealPhotoStorage = getMealPhotoStorage();

  return {
    async create() {
      /* Created first so the row's own id can name the object. The path is
         therefore never derived from anything the client chose. */
      const row = await prisma.mealPhoto.create({
        data: { userId, storagePath: "", status: "PENDING" },
        select: { id: true },
      });

      const storagePath = objectPath(userId, row.id);

      await prisma.mealPhoto.update({
        where: { id: row.id },
        data: { storagePath },
      });

      return { id: row.id, storagePath };
    },

    async markAnalyzing(id) {
      await prisma.mealPhoto.updateMany({
        where: { id, userId },
        data: { status: "ANALYZING" },
      });
    },

    async saveAnalysis(id, detected, provider) {
      await prisma.mealPhoto.updateMany({
        where: { id, userId },
        data: {
          status: "READY",
          /* Stored verbatim. It is the provider's claim, kept so an estimate
             can be explained back to the user and so a change in how we read
             these replies can be re-run against what was actually returned. */
          detectedJson: detected,
          source: sourceForProvider(provider),
          failureNote: null,
        },
      });
    },

    async markFailed(id, note) {
      await prisma.mealPhoto.updateMany({
        where: { id, userId },
        /* Truncated: this is a diagnostic, and a provider that returns a wall
           of HTML on an error should not get to fill the column with it. */
        data: { status: "FAILED", failureNote: note.slice(0, 500) },
      });
    },

    async get(id) {
      const row = await prisma.mealPhoto.findFirst({
        where: { id, userId },
      });

      if (!row) return null;

      return {
        id: row.id,
        status: row.status,
        storagePath: row.storagePath,
        /* `detectedJson` is Json, so it is unknown as far as types go. It was
           schema-validated on the way in; callers that display it validate
           again rather than trusting the column. */
        detected: (row.detectedJson as FoodAnalysisPayload | null) ?? null,
        /* MANUAL is not a provider, so it reads as "no provider" here. Only
           the two photo sources can legitimately appear on a photo row. */
        source:
          row.source === "PHOTO_GEMINI" || row.source === "PHOTO_LOGMEAL" ? row.source : null,
        failureNote: row.failureNote,
        url: row.storagePath ? await storage.signedUrl(row.storagePath) : null,
      };
    },

    async discard(id) {
      const row = await prisma.mealPhoto.findFirst({
        where: { id, userId },
        select: { id: true, storagePath: true, mealLogId: true },
      });

      if (!row) return;

      /* A confirmed photo backs items in a log; deleting the object would
         leave those rows unable to show where their numbers came from. The
         meal has to be deleted instead, which is a different action. */
      if (row.mealLogId) return;

      await prisma.mealPhoto.deleteMany({ where: { id, userId } });
      if (row.storagePath) await storage.remove(row.storagePath);
    },
  };
}

/**
 * Demo mode.
 *
 * Writes nothing and reads nothing. `create` throws rather than returning a
 * fake id, because the caller's next step is to upload an object: handing back
 * an id that no row backs would turn a clear refusal into a confusing
 * half-success further down the request.
 */
export const demoMealPhotoRepo: MealPhotoRepo = {
  async create(): Promise<{ id: string; storagePath: string }> {
    throw new Error("Demo mode does not store photos.");
  },

  async markAnalyzing() {},
  async saveAnalysis() {},
  async markFailed() {},

  async get() {
    return null;
  },

  async discard() {},
};
