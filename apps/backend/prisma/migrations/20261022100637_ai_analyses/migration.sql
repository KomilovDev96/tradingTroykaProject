-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "entry" DECIMAL(65,30),
    "stopLoss" DECIMAL(65,30),
    "takeProfit" DECIMAL(65,30),
    "price" DECIMAL(65,30),
    "rejected" TEXT,
    "signalId" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(12,6),

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysis_createdAt_idx" ON "AiAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_signalId_idx" ON "AiAnalysis"("signalId");
