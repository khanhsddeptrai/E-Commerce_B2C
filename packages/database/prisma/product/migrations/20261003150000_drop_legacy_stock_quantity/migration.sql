-- WMS Bước 5 (docs/06-wms-implementation-plan.md): tồn kho chỉ còn nằm ở inventory_stocks.

-- 1. Kho mặc định luôn tồn tại (trước đây do script backfill tạo)
INSERT INTO "warehouses" ("id", "code", "name", "is_default", "is_active", "updated_at")
SELECT gen_random_uuid(), 'HCM-01', 'Kho tổng Hồ Chí Minh', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "warehouses" WHERE "is_default" = true);

-- 2. Chặn mất dữ liệu: SKU còn tồn ở cột cũ nhưng chưa có dòng tồn nào trong inventory_stocks
--    (chưa chạy backfill) → dừng migration để chuyển đổi trước
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "product_skus" s
  WHERE s."stock_quantity" > 0
    AND NOT EXISTS (SELECT 1 FROM "inventory_stocks" i WHERE i."sku_id" = s."id");
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Có % SKU còn tồn ở product_skus.stock_quantity nhưng chưa có inventory_stocks – chạy script backfill-inventory.js (bản trước commit dọn dẹp WMS) rồi migrate lại', missing_count;
  END IF;
END $$;

-- 3. Xóa cột tồn kho cũ
ALTER TABLE "product_skus" DROP COLUMN "stock_quantity";
