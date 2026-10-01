-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'STOP_LOSS');

-- CreateEnum
CREATE TYPE "TradeResult" AS ENUM ('PROFIT', 'STOP_LOSS', 'MANUAL_CLOSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingSession" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'TROYKA',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "highDemand" DECIMAL(65,30) NOT NULL,
    "lowDemand" DECIMAL(65,30) NOT NULL,
    "rangePoints" DECIMAL(65,30) NOT NULL,
    "upperLevel" DECIMAL(65,30) NOT NULL,
    "lowerLevel" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "strategy" TEXT NOT NULL DEFAULT 'TROYKA',
    "timeframe" TEXT NOT NULL DEFAULT '5m',
    "sessionId" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "highDemand" DECIMAL(65,30) NOT NULL,
    "lowDemand" DECIMAL(65,30) NOT NULL,
    "rangePoints" DECIMAL(65,30) NOT NULL,
    "upperLevel" DECIMAL(65,30) NOT NULL,
    "lowerLevel" DECIMAL(65,30) NOT NULL,
    "movementStartTime" TIMESTAMP(3) NOT NULL,
    "movementStartPrice" DECIMAL(65,30) NOT NULL,
    "confirmationTime" TIMESTAMP(3) NOT NULL,
    "entryPrice" DECIMAL(65,30) NOT NULL,
    "stopLoss" DECIMAL(65,30) NOT NULL,
    "exitPrice" DECIMAL(65,30),
    "exitTime" TIMESTAMP(3),
    "pnlPoints" DECIMAL(65,30),
    "result" "TradeResult",
    "signalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_signalId_key" ON "Trade"("signalId");

-- CreateIndex
CREATE INDEX "Trade_symbol_status_idx" ON "Trade"("symbol", "status");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt");

-- CreateIndex
CREATE INDEX "Trade_direction_idx" ON "Trade"("direction");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TradingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
