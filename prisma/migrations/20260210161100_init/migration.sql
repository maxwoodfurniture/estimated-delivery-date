-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "warehouseStreet" TEXT,
    "warehouseCity" TEXT NOT NULL,
    "warehouseState" TEXT NOT NULL,
    "warehousePostalCode" TEXT NOT NULL,
    "warehouseCountryCode" TEXT NOT NULL DEFAULT 'US',
    "handlingTimeDays" INTEGER NOT NULL DEFAULT 1,
    "processingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "cutoffTime" TEXT NOT NULL DEFAULT '14:00',
    "fedexApiKey" TEXT,
    "fedexSecretKey" TEXT,
    "fedexAccountNumber" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showExactDates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
