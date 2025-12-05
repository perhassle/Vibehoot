import { createClient } from 'redis';

const globalForRedis = global as unknown as { redis: ReturnType<typeof createClient> };

export const redis = globalForRedis.redis || createClient({
    url: process.env.REDIS_URL
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

redis.on('error', (err) => console.log('Redis Client Error', err));

if (!redis.isOpen) {
    redis.connect();
}

export default redis;
