import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisLockService {
  private readonly defaultTtlMs = 10000; // 10 seconds

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Acquire a distributed lock.
   * @param key lock key, e.g. reservation:lock:{ticketTypeId}
   * @param ttlMs lock time-to-live in milliseconds
   * @returns token string if lock acquired, otherwise null
   */
  async acquireLock(key: string, ttlMs = this.defaultTtlMs): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return token;
    }
    return null;
  }

  /**
   * Release a lock only if we own it (token matches).
   * Uses Lua script for atomic check-and-delete.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, token);
    return result === 1;
  }
}