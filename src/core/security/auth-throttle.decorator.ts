import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/** Límite estricto para prelogin/login/exchange (anti credential stuffing). */
export function AuthThrottle() {
  return applyDecorators(
    Throttle({
      auth: { limit: 15, ttl: 60_000 },
      default: { limit: 30, ttl: 60_000 },
    }),
  );
}
