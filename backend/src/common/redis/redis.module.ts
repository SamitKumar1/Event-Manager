import { Global, Module, DynamicModule, Provider, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisLockService } from './redis-lock.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({})
export class RedisModule implements OnModuleDestroy {
  private static redisClient?: Redis;

  static forRoot(): DynamicModule {
    const redisProvider: Provider = {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 50, 2000),
          enableReadyCheck: true,
          lazyConnect: true,
        });
        client.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('Redis connection error', err);
        });
        RedisModule.redisClient = client;
        return client;
      },
      inject: [ConfigService],
    };

    const lockProvider: Provider = {
      provide: RedisLockService,
      useFactory: (client: Redis) => new RedisLockService(client),
      inject: [REDIS_CLIENT],
    };

    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [redisProvider, lockProvider],
      exports: [REDIS_CLIENT, RedisLockService],
    };
  }

  async onModuleDestroy() {
    if (RedisModule.redisClient) {
      await RedisModule.redisClient.quit();
      RedisModule.redisClient = undefined;
    }
  }
}