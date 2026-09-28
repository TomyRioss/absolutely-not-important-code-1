CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';
