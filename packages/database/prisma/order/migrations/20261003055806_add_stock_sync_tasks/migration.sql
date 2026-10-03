-- CreateEnum
CREATE TYPE "StockSyncAction" AS ENUM ('COMMIT', 'RELEASE', 'SHIP', 'RETURN');

-- CreateEnum
CREATE TYPE "StockSyncStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "stock_sync_tasks" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "action" "StockSyncAction" NOT NULL,
    "status" "StockSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "performed_by" VARCHAR(100) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_sync_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_sync_tasks_seq_key" ON "stock_sync_tasks"("seq");

-- CreateIndex
CREATE INDEX "stock_sync_tasks_status_next_retry_at_idx" ON "stock_sync_tasks"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "stock_sync_tasks_order_id_seq_idx" ON "stock_sync_tasks"("order_id", "seq");

-- AddForeignKey
ALTER TABLE "stock_sync_tasks" ADD CONSTRAINT "stock_sync_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ràng buộc nghiệp vụ
ALTER TABLE "stock_sync_tasks" ADD CONSTRAINT "stock_sync_tasks_attempts_non_negative" CHECK ("attempts" >= 0);
