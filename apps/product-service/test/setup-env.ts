import { getTestProductDatabaseUrl, getTestRedisUrl } from './test-env';

const productDatabaseUrl = getTestProductDatabaseUrl();
const redisUrl = getTestRedisUrl();

process.env.PRODUCT_DATABASE_URL = productDatabaseUrl;
process.env.REDIS_URL = redisUrl;
