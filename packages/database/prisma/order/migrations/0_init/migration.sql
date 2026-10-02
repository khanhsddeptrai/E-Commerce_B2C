-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('COD', 'VNPAY', 'MOMO', 'STRIPE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ReservationStatus" AS ENUM ('HOLD', 'COMMITTED', 'RELEASED');

-- CreateTable
CREATE TABLE "public"."inventory_reservations" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "sku_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "public"."ReservationStatus" NOT NULL DEFAULT 'HOLD',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "sku_name" VARCHAR(255) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_price" DECIMAL(15,2) NOT NULL,
    "thumbnail_url" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" VARCHAR(50) NOT NULL,
    "to_status" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "changed_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" VARCHAR(255),

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(255) NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "subtotal_amount" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL DEFAULT 'COD',
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "order_status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "voucher_code" VARCHAR(50),
    "cancel_reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tracking_code" VARCHAR(100),
    "carrier_name" VARCHAR(100),
    "shipping_method" VARCHAR(50) DEFAULT 'STANDARD',
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_reservations_order_id_idx" ON "public"."inventory_reservations"("order_id" ASC);

-- CreateIndex
CREATE INDEX "inventory_reservations_sku_id_idx" ON "public"."inventory_reservations"("sku_id" ASC);

-- CreateIndex
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "public"."inventory_reservations"("status" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_sku_id_idx" ON "public"."order_items"("sku_id" ASC);

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "public"."order_status_history"("order_id" ASC);

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "public"."orders"("created_at" ASC);

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "public"."orders"("customer_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "public"."orders"("order_code" ASC);

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "public"."orders"("order_status" ASC);

-- AddForeignKey
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

