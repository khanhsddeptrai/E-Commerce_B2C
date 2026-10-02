-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HOLD', 'COMMITTED', 'RELEASED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('INBOUND', 'OUTBOUND', 'RETURN', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_code" VARCHAR(50) NOT NULL,
    "sku_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HOLD',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "ref_type" VARCHAR(30) NOT NULL,
    "ref_id" VARCHAR(100) NOT NULL,
    "note" TEXT,
    "created_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_receipts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_name" VARCHAR(200),
    "note" TEXT,
    "created_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost_price" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "inventory_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "inventory_stocks_warehouse_id_idx" ON "inventory_stocks"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_sku_id_warehouse_id_key" ON "inventory_stocks"("sku_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_sku_id_status_idx" ON "inventory_reservations"("sku_id", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "inventory_reservations_order_code_idx" ON "inventory_reservations"("order_code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_order_id_sku_id_warehouse_id_key" ON "inventory_reservations"("order_id", "sku_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_sku_id_created_at_idx" ON "inventory_transactions"("sku_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_warehouse_id_created_at_idx" ON "inventory_transactions"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_created_at_idx" ON "inventory_transactions"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_ref_type_ref_id_type_sku_id_warehous_key" ON "inventory_transactions"("ref_type", "ref_id", "type", "sku_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_receipts_code_key" ON "inventory_receipts"("code");

-- CreateIndex
CREATE INDEX "inventory_receipts_created_at_idx" ON "inventory_receipts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_receipt_items_receipt_id_sku_id_key" ON "inventory_receipt_items"("receipt_id", "sku_id");

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipts" ADD CONSTRAINT "inventory_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inventory_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ràng buộc nghiệp vụ ở tầng database (Prisma không mô hình hóa CHECK nên viết tay)
-- Lớp bảo vệ cuối cùng: dù code có lỗi, tồn kho cũng không thể âm
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_on_hand_non_negative" CHECK ("on_hand" >= 0);
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_reserved_non_negative" CHECK ("reserved" >= 0);
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_quantity_non_zero" CHECK ("quantity" <> 0);
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_balance_non_negative" CHECK ("balance_after" >= 0);
ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_cost_price_non_negative" CHECK ("cost_price" >= 0);
