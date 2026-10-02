import * as dotenv from 'dotenv';
import * as path from 'path';
import { TEST_REDIS_DB } from './helpers';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Redis DB riêng cho test của order-service (product-service dùng DB 15)
const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
redisUrl.pathname = `/${TEST_REDIS_DB}`;
process.env.REDIS_URL = redisUrl.toString();
