-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('RESCHEDULE_TASK', 'COMPLETE_TASK', 'CREATE_TASK', 'REBUILD_DAY', 'ADJUST_GOAL');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPLIED', 'DECLINED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "twin_suggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" "SuggestionKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "diff" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twin_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_action" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "previous" JSONB NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "twin_suggestion_userId_status_idx" ON "twin_suggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "twin_suggestion_userId_kind_createdAt_idx" ON "twin_suggestion"("userId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "applied_action_suggestionId_key" ON "applied_action"("suggestionId");

-- CreateIndex
CREATE INDEX "applied_action_userId_createdAt_idx" ON "applied_action"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "suggestion_feedback_userId_kind_createdAt_idx" ON "suggestion_feedback"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "twin_suggestion" ADD CONSTRAINT "twin_suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_action" ADD CONSTRAINT "applied_action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_action" ADD CONSTRAINT "applied_action_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "twin_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Deny-all RLS on the new tables.
--
-- 20261103000000_lock_down_data_api enabled RLS on every table that existed
-- at that moment, and changed DEFAULT PRIVILEGES so new tables are not
-- granted to anon/authenticated. The grants are therefore already handled —
-- but RLS is per-table and does not apply retroactively to tables created
-- later, so without these three lines the suggestion tables would ship as the
-- only ones in the schema with row security off.
--
-- No policies on purpose: enabled with no policy is deny-all, which is the
-- intent. Prisma connects as the owner (rolbypassrls) and is unaffected.
ALTER TABLE "twin_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applied_action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suggestion_feedback" ENABLE ROW LEVEL SECURITY;
