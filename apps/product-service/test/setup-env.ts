import { getTestOrderDatabaseUrl, getTestProductDatabaseUrl, getTestRedisUrl } from './test-env';

const productDatabaseUrl = getTestProductDatabaseUrl();
const orderDatabaseUrl = getTestOrderDatabaseUrl();
const redisUrl = getTestRedisUrl();

process.env.PRODUCT_DATABASE_URL = productDatabaseUrl;
process.env.ORDER_DATABASE_URL = orderDatabaseUrl;
process.env.REDIS_URL = redisUrl;
