/**
 * POST /api/nutrition/analyze — read a meal photo.
 *
 * A route handler rather than a server action because the payload is an image:
 * actions are fine for form fields, but this wants explicit control over the
 * size limit, the content type and the status codes, and it has to be able to
 * refuse before reading the whole body.
 *
 * What it does NOT do is write to the log. It stores the photo, stores what
 * the provider made of it, and returns draft rows for the user to confirm.
 * The only thing that writes a meal is the `logMeal` action, after the confirm
 * form. That separation is the feature's main safety property, and it is why
 * this endpoint has no access to `logMeal` at all.
 *
 * Every failure path returns 200 with `ok: false` and a sentence for the user,
 * except the ones that are genuinely about the request (413, 415, 429, 401).
 * A provider outage is not a client error, and the client's job on hearing
 * about one is to offer the manual composer — not to retry.
 */

import { requireWriter } from "@/lib/auth/session";
import { getFoods } from "@/lib/data/nutrition.repo";
import { mealPhotoRepoForUser } from "@/lib/data/meal-photo.repo";
import { analysisToDraft } from "@/lib/domain/calc/food-vision";
import { getFoodVision } from "@/lib/integrations/food-vision";
import { getMealPhotoStorage } from "@/lib/integrations/meal-photo-storage";
import { consume, PHOTO_ANALYSIS_LIMIT, photoAnalysisKey } from "@/lib/rate-limit";
import {
  ALLOWED_PHOTO_TYPES,
  foodAnalysisSchema,
  MAX_PHOTO_BYTES,
} from "@/lib/validation/food-vision";

export async function POST(request: Request) {
  /* Re-checks the real session. The proxy's cookie check is optimistic and is
     not authority for anything that costs money. */
  let writer;
  try {
    writer = await requireWriter();
  } catch {
    return Response.json({ ok: false, error: "Sign in to read a photo." }, { status: 401 });
  }

  if (writer.kind === "demo") {
    return Response.json(
      {
        ok: false,
        error: "Demo mode cannot read photos — nothing is stored in demo. Try typing the meal.",
      },
      { status: 200 },
    );
  }

  const { userId } = writer;

  const vision = getFoodVision();
  const storage = getMealPhotoStorage();

  /* Refuse before touching the body or the limiter when the feature cannot
     work at all: charging a user's hourly quota for a request that was never
     going to succeed is its own small injustice. */
  if (vision.kind === "null") {
    return Response.json(
      {
        ok: false,
        error: "Photo reading is not switched on yet — you can still type this meal in.",
      },
      { status: 200 },
    );
  }

  if (storage.kind === "null") {
    return Response.json(
      {
        ok: false,
        error: "Photo storage is not configured yet — you can still type this meal in.",
      },
      { status: 200 },
    );
  }

  const verdict = await consume(
    photoAnalysisKey(userId),
    PHOTO_ANALYSIS_LIMIT.limit,
    PHOTO_ANALYSIS_LIMIT.windowSeconds,
  );

  if (!verdict.ok) {
    return Response.json(
      {
        ok: false,
        error: `That is a lot of photos in one hour. Try again in ${Math.ceil(
          verdict.retryAfterSeconds / 60,
        )} minutes, or type the meal in.`,
      },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }

  /* ---------------------------------------------------------------------- */
  /*                              read the image                            */
  /* ---------------------------------------------------------------------- */

  let bytes: Uint8Array;
  let contentType: string;

  try {
    const form = await request.formData();
    const file = form.get("photo");

    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No photo was attached." }, { status: 400 });
    }

    contentType = file.type;

    if (!ALLOWED_PHOTO_TYPES.includes(contentType as (typeof ALLOWED_PHOTO_TYPES)[number])) {
      return Response.json(
        { ok: false, error: "That file is not a JPEG, PNG or WebP image." },
        { status: 415 },
      );
    }

    /* The browser compresses before sending, so this is a backstop against a
       direct POST rather than the normal path. It matches the bucket's own
       file_size_limit, so a pass here cannot fail at upload for size. */
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json(
        { ok: false, error: "That photo is too large. Try again with a smaller one." },
        { status: 413 },
      );
    }

    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return Response.json({ ok: false, error: "That upload did not arrive intact." }, { status: 400 });
  }

  /* ---------------------------------------------------------------------- */
  /*                        store, analyse, draft                           */
  /* ---------------------------------------------------------------------- */

  const photos = mealPhotoRepoForUser(userId);
  const photo = await photos.create();

  const stored = await storage.put(photo.storagePath, bytes, contentType);

  if (!stored) {
    await photos.markFailed(photo.id, "upload to meal-photos failed");

    return Response.json(
      { ok: false, error: "That photo could not be saved. You can still type the meal in." },
      { status: 200 },
    );
  }

  await photos.markAnalyzing(photo.id);

  const hints = { cuisine: "indian" as const, dietType: undefined, mealType: undefined };
  const result = await vision.analyze(bytes, hints);

  if (!result.ok) {
    await photos.markFailed(photo.id, result.detail ?? result.reason);

    return Response.json(
      { ok: false, error: result.reason, mealPhotoId: photo.id },
      { status: 200 },
    );
  }

  /* Validate the provider's own reply before it is stored or shown. `analyze`
     already parses, but this endpoint is the boundary that must not be
     bypassed if a future provider is sloppier than the interface promises. */
  const parsed = foodAnalysisSchema.safeParse({
    items: result.analysis.items.map((item) => ({ ...item })),
    assumptions: result.analysis.assumptions,
  });

  if (!parsed.success) {
    await photos.markFailed(photo.id, `provider reply failed validation: ${parsed.error.message}`);

    return Response.json(
      {
        ok: false,
        error: "Couldn't read this clearly — add it manually?",
        mealPhotoId: photo.id,
      },
      { status: 200 },
    );
  }

  await photos.saveAnalysis(photo.id, parsed.data, result.analysis.provider);

  const foods = await getFoods();
  const draft = analysisToDraft({ ...result.analysis, items: parsed.data.items }, foods);

  return Response.json({
    ok: true,
    mealPhotoId: photo.id,
    draft,
    /* Said once here and shown on every row: these are estimates. */
    disclaimer: "Estimated from the photo. Check the numbers before saving.",
  });
}
