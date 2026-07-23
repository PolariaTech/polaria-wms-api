import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PolariaThrottlerGuard } from './polaria-throttler.guard';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 200 },
        { name: 'auth', ttl: 60_000, limit: 15 },
      ],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: PolariaThrottlerGuard,
    },
  ],
})
export class SecurityModule {}
