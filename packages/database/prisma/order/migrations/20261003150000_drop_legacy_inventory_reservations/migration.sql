-- WMS Bước 5 (docs/06-wms-implementation-plan.md): giữ hàng đã chuyển sang product_db.inventory_reservations,
-- bảng cũ trong order_db không còn được sử dụng.

-- DropForeignKey
ALTER TABLE "inventory_reservations" DROP CONSTRAINT "inventory_reservations_order_id_fkey";

-- DropTable
DROP TABLE "inventory_reservations";

-- DropEnum
DROP TYPE "ReservationStatus";
