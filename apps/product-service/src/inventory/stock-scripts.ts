/** Key Redis lưu số lượng còn bán được của một SKU (tổng mọi kho) */
export const stockKey = (skuId: string): string => `stock:${skuId}`;

/**
 * Giữ hàng nhiều SKU nguyên tử: kiểm tra đủ hàng cho TẤT CẢ trước, đủ hết mới trừ.
 * KEYS = các key stock:{skuId}, ARGV = số lượng tương ứng.
 * Trả 0 nếu thành công; trả i (1-based) là vị trí SKU đầu tiên không đủ hàng / chưa có key.
 * Lưu ý: nếu chuyển sang Redis Cluster, các key phải cùng hash slot (vd dùng hash tag {stock}).
 */
export const RESERVE_MULTI_LUA = `
for i = 1, #KEYS do
  local current = tonumber(redis.call('get', KEYS[i]))
  if (not current) or current < tonumber(ARGV[i]) then
    return i
  end
end
for i = 1, #KEYS do
  redis.call('decrby', KEYS[i], ARGV[i])
end
return 0
`;

/**
 * Cộng trả tồn còn bán được, CHỈ với key đã tồn tại.
 * Key chưa có sẽ được khởi tạo lại từ database khi cần, nên không được tạo key mới từ số cộng trả.
 */
export const RESTORE_MULTI_LUA = `
for i = 1, #KEYS do
  if redis.call('exists', KEYS[i]) == 1 then
    redis.call('incrby', KEYS[i], ARGV[i])
  end
end
return 1
`;
