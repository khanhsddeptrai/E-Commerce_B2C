-- Đồng bộ ràng buộc với schema: shipping_method bắt buộc (mặc định STANDARD)
ALTER TABLE "orders" ALTER COLUMN "shipping_method" SET NOT NULL;
