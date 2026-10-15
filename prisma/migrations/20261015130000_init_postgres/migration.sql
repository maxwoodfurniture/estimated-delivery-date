-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "warehouseStreet" TEXT,
    "warehouseCity" TEXT NOT NULL,
    "warehouseState" TEXT NOT NULL,
    "warehousePostalCode" TEXT NOT NULL,
    "warehouseCountryCode" TEXT NOT NULL DEFAULT 'US',
    "warehouseTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "handlingTimeDays" INTEGER NOT NULL DEFAULT 1,
    "processingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "cutoffTime" TEXT NOT NULL DEFAULT '14:00',
    "fedexApiKey" TEXT,
    "fedexSecretKey" TEXT,
    "fedexAccountNumber" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showExactDates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

