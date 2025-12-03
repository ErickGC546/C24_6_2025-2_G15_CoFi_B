-- AlterTable
ALTER TABLE "public"."AiRecommendation" ADD COLUMN     "conversation_id" TEXT;

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_user_id_idx" ON "public"."Conversation"("user_id");

-- CreateIndex
CREATE INDEX "Conversation_created_at_idx" ON "public"."Conversation"("created_at");

-- CreateIndex
CREATE INDEX "AiRecommendation_conversation_id_idx" ON "public"."AiRecommendation"("conversation_id");

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiRecommendation" ADD CONSTRAINT "AiRecommendation_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
