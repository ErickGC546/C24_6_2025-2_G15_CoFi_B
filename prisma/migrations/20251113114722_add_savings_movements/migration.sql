-- CreateEnum
CREATE TYPE "public"."SavingMovementType" AS ENUM ('deposit', 'withdraw');

-- CreateTable
CREATE TABLE "public"."SavingsMovement" (
    "id" TEXT NOT NULL,
    "savings_goal_id" TEXT NOT NULL,
    "user_id" TEXT,
    "group_id" TEXT,
    "type" "public"."SavingMovementType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsMovement_savings_goal_id_idx" ON "public"."SavingsMovement"("savings_goal_id");

-- CreateIndex
CREATE INDEX "SavingsMovement_user_id_idx" ON "public"."SavingsMovement"("user_id");

-- CreateIndex
CREATE INDEX "SavingsMovement_group_id_idx" ON "public"."SavingsMovement"("group_id");

-- AddForeignKey
ALTER TABLE "public"."SavingsMovement" ADD CONSTRAINT "SavingsMovement_savings_goal_id_fkey" FOREIGN KEY ("savings_goal_id") REFERENCES "public"."SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavingsMovement" ADD CONSTRAINT "SavingsMovement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavingsMovement" ADD CONSTRAINT "SavingsMovement_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
