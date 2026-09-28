ALTER TABLE "Business"
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN "mpSubscriptionId" TEXT,
ADD COLUMN "proStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Business_mpSubscriptionId_key"
ON "Business"("mpSubscriptionId");
