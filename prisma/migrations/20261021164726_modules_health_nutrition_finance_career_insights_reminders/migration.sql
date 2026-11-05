/*
  Warnings:

  - You are about to drop the column `renewsOn` on the `expense` table. All the data in the column will be lost.
  - You are about to drop the column `carbsG` on the `meal_log` table. All the data in the column will be lost.
  - You are about to drop the column `estimated` on the `meal_log` table. All the data in the column will be lost.
  - You are about to drop the column `fatG` on the `meal_log` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `meal_log` table. All the data in the column will be lost.
  - You are about to drop the column `kcal` on the `meal_log` table. All the data in the column will be lost.
  - You are about to drop the column `proteinG` on the `meal_log` table. All the data in the column will be lost.
  - The `mealType` column on the `meal_log` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `dailyReminderCap` on the `profile` table. All the data in the column will be lost.
  - You are about to drop the column `quietHoursEnd` on the `profile` table. All the data in the column will be lost.
  - You are about to drop the column `quietHoursStart` on the `profile` table. All the data in the column will be lost.
  - You are about to drop the `workout_log` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `kind` on the `investment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `meal_log` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('VEGETARIAN', 'EGGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'JAIN');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'NETBANKING', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "InvestmentKind" AS ENUM ('STOCK', 'MUTUAL_FUND', 'FD', 'SIP');

-- CreateEnum
CREATE TYPE "PlacementStage" AS ENUM ('PREPARING', 'APPLYING', 'INTERVIEWING', 'OFFER', 'PLACED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IDEA', 'BUILDING', 'SHIPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('DEADLINE', 'ATTENDANCE', 'WORKOUT', 'WATER', 'WEEKLY_REVIEW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');

-- DropForeignKey
ALTER TABLE "workout_log" DROP CONSTRAINT "workout_log_userId_fkey";

-- AlterTable
ALTER TABLE "expense" DROP COLUMN "renewsOn",
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UPI';

-- AlterTable
ALTER TABLE "investment" ADD COLUMN     "interestRate" DOUBLE PRECISION,
ADD COLUMN     "sipAmountMinor" INTEGER,
ADD COLUMN     "sipDay" INTEGER,
ADD COLUMN     "startDate" DATE,
DROP COLUMN "kind",
ADD COLUMN     "kind" "InvestmentKind" NOT NULL;

-- AlterTable
ALTER TABLE "meal_log" DROP COLUMN "carbsG",
DROP COLUMN "estimated",
DROP COLUMN "fatG",
DROP COLUMN "items",
DROP COLUMN "kcal",
DROP COLUMN "proteinG",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "mealType",
ADD COLUMN     "mealType" "MealType" NOT NULL DEFAULT 'SNACK';

-- AlterTable
ALTER TABLE "profile" DROP COLUMN "dailyReminderCap",
DROP COLUMN "quietHoursEnd",
DROP COLUMN "quietHoursStart";

-- DropTable
DROP TABLE "workout_log";

-- CreateTable
CREATE TABLE "health_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'LIGHT',
    "plannedPerWeek" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_set" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "servingLabel" TEXT NOT NULL,
    "servingGrams" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "fibreG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietType" "DietType" NOT NULL DEFAULT 'VEGETARIAN',
    "allergies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealLogId" TEXT NOT NULL,
    "foodId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "kcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meal_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_meal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_meal_item" (
    "id" TEXT NOT NULL,
    "savedMealId" TEXT NOT NULL,
    "foodId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "kcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "saved_meal_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyIncomeMinor" INTEGER NOT NULL DEFAULT 0,
    "monthlyBudgetMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "nextRenewal" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetMinor" INTEGER NOT NULL,
    "savedMinor" INTEGER NOT NULL DEFAULT 0,
    "deadline" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_skill_requirement" (
    "id" TEXT NOT NULL,
    "careerGoalId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "role_skill_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "date" DATE,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "skills" TEXT[],
    "url" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'BUILDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "PlacementStage" NOT NULL DEFAULT 'PREPARING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerGoalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pulse_snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "academic" INTEGER NOT NULL,
    "fitness" INTEGER NOT NULL,
    "productivity" INTEGER NOT NULL,
    "career" INTEGER NOT NULL,
    "routine" INTEGER NOT NULL,
    "momentum" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pulse_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "wentWell" TEXT[],
    "slipped" TEXT[],
    "nextFocus" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 22,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 7,
    "dailyCap" INTEGER NOT NULL DEFAULT 3,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "leadMinutes" INTEGER NOT NULL DEFAULT 60,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'IN_APP',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_email" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_profile_userId_key" ON "health_profile"("userId");

-- CreateIndex
CREATE INDEX "workout_session_userId_date_idx" ON "workout_session"("userId", "date");

-- CreateIndex
CREATE INDEX "workout_set_userId_exercise_idx" ON "workout_set"("userId", "exercise");

-- CreateIndex
CREATE INDEX "workout_set_sessionId_idx" ON "workout_set"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "food_name_key" ON "food"("name");

-- CreateIndex
CREATE INDEX "food_name_idx" ON "food"("name");

-- CreateIndex
CREATE UNIQUE INDEX "diet_profile_userId_key" ON "diet_profile"("userId");

-- CreateIndex
CREATE INDEX "meal_item_mealLogId_idx" ON "meal_item"("mealLogId");

-- CreateIndex
CREATE INDEX "meal_item_userId_idx" ON "meal_item"("userId");

-- CreateIndex
CREATE INDEX "saved_meal_userId_idx" ON "saved_meal"("userId");

-- CreateIndex
CREATE INDEX "saved_meal_item_savedMealId_idx" ON "saved_meal_item"("savedMealId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_profile_userId_key" ON "finance_profile"("userId");

-- CreateIndex
CREATE INDEX "subscription_userId_nextRenewal_idx" ON "subscription"("userId", "nextRenewal");

-- CreateIndex
CREATE INDEX "savings_goal_userId_idx" ON "savings_goal"("userId");

-- CreateIndex
CREATE INDEX "career_goal_userId_idx" ON "career_goal"("userId");

-- CreateIndex
CREATE INDEX "role_skill_requirement_careerGoalId_idx" ON "role_skill_requirement"("careerGoalId");

-- CreateIndex
CREATE UNIQUE INDEX "role_skill_requirement_careerGoalId_skill_key" ON "role_skill_requirement"("careerGoalId", "skill");

-- CreateIndex
CREATE INDEX "user_skill_userId_idx" ON "user_skill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_skill_userId_skill_key" ON "user_skill"("userId", "skill");

-- CreateIndex
CREATE INDEX "certification_userId_idx" ON "certification"("userId");

-- CreateIndex
CREATE INDEX "project_userId_idx" ON "project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "placement_status_userId_key" ON "placement_status"("userId");

-- CreateIndex
CREATE INDEX "roadmap_item_careerGoalId_order_idx" ON "roadmap_item"("careerGoalId", "order");

-- CreateIndex
CREATE INDEX "roadmap_item_userId_idx" ON "roadmap_item"("userId");

-- CreateIndex
CREATE INDEX "pulse_snapshot_userId_date_idx" ON "pulse_snapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "pulse_snapshot_userId_date_key" ON "pulse_snapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "weekly_review_userId_weekStart_idx" ON "weekly_review"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_review_userId_weekStart_key" ON "weekly_review"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "achievement_userId_idx" ON "achievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_userId_key_key" ON "achievement"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_userId_key" ON "notification_prefs"("userId");

-- CreateIndex
CREATE INDEX "reminder_rule_userId_idx" ON "reminder_rule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_rule_userId_kind_label_key" ON "reminder_rule"("userId", "kind", "label");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "dev_email_to_createdAt_idx" ON "dev_email"("to", "createdAt");

-- CreateIndex
CREATE INDEX "expense_userId_category_idx" ON "expense"("userId", "category");

-- AddForeignKey
ALTER TABLE "health_profile" ADD CONSTRAINT "health_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_profile" ADD CONSTRAINT "diet_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "meal_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meal" ADD CONSTRAINT "saved_meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meal_item" ADD CONSTRAINT "saved_meal_item_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "saved_meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meal_item" ADD CONSTRAINT "saved_meal_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_profile" ADD CONSTRAINT "finance_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_goal" ADD CONSTRAINT "career_goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_skill_requirement" ADD CONSTRAINT "role_skill_requirement_careerGoalId_fkey" FOREIGN KEY ("careerGoalId") REFERENCES "career_goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification" ADD CONSTRAINT "certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_status" ADD CONSTRAINT "placement_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_careerGoalId_fkey" FOREIGN KEY ("careerGoalId") REFERENCES "career_goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pulse_snapshot" ADD CONSTRAINT "pulse_snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_review" ADD CONSTRAINT "weekly_review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_rule" ADD CONSTRAINT "reminder_rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
