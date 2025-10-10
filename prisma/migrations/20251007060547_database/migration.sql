/*
  Warnings:

  - You are about to drop the column `photo_url` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "photo_url",
ADD COLUMN     "avatar_url" TEXT;
