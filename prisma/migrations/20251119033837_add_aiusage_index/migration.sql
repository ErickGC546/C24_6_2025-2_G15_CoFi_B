-- AlterTable
ALTER TABLE "public"."AiUsage" ALTER COLUMN "provider" SET DEFAULT 'gemini';

-- CreateIndex
CREATE INDEX "AiUsage_user_id_createdAt_idx" ON "public"."AiUsage"("user_id", "createdAt");
