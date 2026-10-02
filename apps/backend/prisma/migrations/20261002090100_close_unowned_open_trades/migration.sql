-- Positions opened before per-account trading have no owner: nobody can close them manually and
-- they would block new signals until their stop loss. Close them at break-even.
UPDATE "Trade"
SET "status" = 'CLOSED',
    "result" = 'MANUAL_CLOSE',
    "exitPrice" = "entryPrice",
    "exitTime" = NOW(),
    "pnlPoints" = 0
WHERE "accountId" IS NULL AND "status" = 'OPEN';
