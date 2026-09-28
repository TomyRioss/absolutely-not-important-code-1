-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "takeAway" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "costPrice" DECIMAL(65,30),
ADD COLUMN "packagingPrice" DECIMAL(65,30),
ADD COLUMN "sku" TEXT,
ADD COLUMN "stockQty" INTEGER,
ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN "pointsSpent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rewardVariantId" TEXT,
ADD COLUMN "selectedModifiers" JSONB;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "banner" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "categoryId" TEXT,
ADD COLUMN "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductModifierGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RewardCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardVariant" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Único',
    "sku" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "costPrice" DECIMAL(65,30),
    "packagingPrice" DECIMAL(65,30),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RewardVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardModifierGroup" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RewardModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardModifier" (
    "id" TEXT NOT NULL,
    "rewardModifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RewardModifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "SurveyType" NOT NULL,
    "points" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "externalUrl" TEXT,
    CONSTRAINT "SurveyConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyCompletion" (
    "id" TEXT NOT NULL,
    "surveyConfigId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "attentionRating" INTEGER,
    "foodRating" INTEGER,
    "experienceRating" INTEGER,
    "pointsAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductModifierGroup_productId_modifierGroupId_key" ON "ProductModifierGroup"("productId", "modifierGroupId");
CREATE UNIQUE INDEX "SurveyConfig_businessId_type_key" ON "SurveyConfig"("businessId", "type");
CREATE UNIQUE INDEX "SurveyCompletion_surveyConfigId_customerId_key" ON "SurveyCompletion"("surveyConfigId", "customerId");

-- ReplaceForeignKeyActions
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";
ALTER TABLE "RegisterSession" DROP CONSTRAINT "RegisterSession_userId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHours" ADD CONSTRAINT "OpeningHours_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardCategory" ADD CONSTRAINT "RewardCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RewardCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardVariant" ADD CONSTRAINT "RewardVariant_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardModifierGroup" ADD CONSTRAINT "RewardModifierGroup_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardModifier" ADD CONSTRAINT "RewardModifier_rewardModifierGroupId_fkey" FOREIGN KEY ("rewardModifierGroupId") REFERENCES "RewardModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardVariantId_fkey" FOREIGN KEY ("rewardVariantId") REFERENCES "RewardVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SurveyConfig" ADD CONSTRAINT "SurveyConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyCompletion" ADD CONSTRAINT "SurveyCompletion_surveyConfigId_fkey" FOREIGN KEY ("surveyConfigId") REFERENCES "SurveyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyCompletion" ADD CONSTRAINT "SurveyCompletion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
