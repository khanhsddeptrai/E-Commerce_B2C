import { getTestOrderDatabaseUrl, getTestRedisUrl } from './test-env';

const orderDatabaseUrl = getTestOrderDatabaseUrl();
const redisUrl = getTestRedisUrl();

process.env.ORDER_DATABASE_URL = orderDatabaseUrl;
process.env.REDIS_URL = redisUrl;
