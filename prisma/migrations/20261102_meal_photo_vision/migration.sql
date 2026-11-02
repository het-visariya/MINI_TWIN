-- CreateEnum
CREATE TYPE "MealItemSource" AS ENUM ('MANUAL', 'FOOD_TABLE', 'PHOTO_GEMINI', 'PHOTO_LOGMEAL');

-- CreateEnum
CREATE TYPE "MealPhotoStatus" AS ENUM ('PENDING', 'ANALYZING', 'READY', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "meal_item" ADD COLUMN     "mealPhotoId" TEXT,
ADD COLUMN     "source" "MealItemSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "meal_photo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealLogId" TEXT,
    "storagePath" TEXT NOT NULL,
    "status" "MealPhotoStatus" NOT NULL DEFAULT 'PENDING',
    "detectedJson" JSONB,
    "source" "MealItemSource",
    "failureNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_photo_userId_idx" ON "meal_photo"("userId");

-- CreateIndex
CREATE INDEX "meal_photo_mealLogId_idx" ON "meal_photo"("mealLogId");

-- CreateIndex
CREATE INDEX "meal_item_mealPhotoId_idx" ON "meal_item"("mealPhotoId");

-- AddForeignKey
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_mealPhotoId_fkey" FOREIGN KEY ("mealPhotoId") REFERENCES "meal_photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_photo" ADD CONSTRAINT "meal_photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_photo" ADD CONSTRAINT "meal_photo_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "meal_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

