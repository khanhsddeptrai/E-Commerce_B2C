-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('COD', 'VNPAY', 'MOMO', 'STRIPE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "public"."payment_logs" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_code" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL DEFAULT 'VNPAY',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_no" VARCHAR(100),
    "bank_code" VARCHAR(50),
    "bank_tran_no" VARCHAR(100),
    "card_type" VARCHAR(50),
    "vnp_response_code" VARCHAR(10),
    "pay_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_logs_action_idx" ON "public"."payment_logs"("action" ASC);

-- CreateIndex
CREATE INDEX "payment_logs_payment_id_idx" ON "public"."payment_logs"("payment_id" ASC);

-- CreateIndex
CREATE INDEX "payments_order_code_idx" ON "public"."payments"("order_code" ASC);

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "public"."payments"("order_id" ASC);

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status" ASC);

-- AddForeignKey
ALTER TABLE "public"."payment_logs" ADD CONSTRAINT "payment_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

