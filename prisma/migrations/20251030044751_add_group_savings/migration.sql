-- AlterTable
ALTER TABLE "public"."SavingsGoal" ADD COLUMN     "group_id" TEXT;

-- CreateIndex
CREATE INDEX "SavingsGoal_group_id_idx" ON "public"."SavingsGoal"("group_id");

-- AddForeignKey
ALTER TABLE "public"."SavingsGoal" ADD CONSTRAINT "SavingsGoal_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
