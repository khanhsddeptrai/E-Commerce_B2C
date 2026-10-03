import { getTestOrderDatabaseUrl } from './test-env';

process.env.ORDER_DATABASE_URL = getTestOrderDatabaseUrl();
// Order Service không kết nối product_db hay Redis nữa (mọi thao tác kho qua InventoryService)
process.env.PRODUCT_GRPC_URL = 'localhost:59999';
