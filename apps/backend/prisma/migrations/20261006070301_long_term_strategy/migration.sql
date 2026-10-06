-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "breakevenStep" DECIMAL(65,30),
ADD COLUMN     "dailySpeed" DECIMAL(65,30),
ADD COLUMN     "initialStopLoss" DECIMAL(65,30),
ADD COLUMN     "stage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "takeProfit1" DECIMAL(65,30),
ADD COLUMN     "takeProfit2" DECIMAL(65,30),
ADD COLUMN     "takeProfit3" DECIMAL(65,30),
ADD COLUMN     "targetsHit" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Trade_strategy_status_idx" ON "Trade"("strategy", "status");
