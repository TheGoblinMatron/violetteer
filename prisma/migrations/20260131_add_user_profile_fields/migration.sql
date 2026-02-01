-- Add profile fields to User table
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "location" TEXT;
ALTER TABLE "User" ADD COLUMN "website" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "socialInstagram" TEXT;
ALTER TABLE "User" ADD COLUMN "socialFacebook" TEXT;
ALTER TABLE "User" ADD COLUMN "socialTwitter" TEXT;
ALTER TABLE "User" ADD COLUMN "profileIsPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "showEmail" BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint on username
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
