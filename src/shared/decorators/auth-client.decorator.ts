import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AUTH_CLIENT,
  AUTH_CLIENT_HEADER,
  type AuthClient,
} from '../constants/auth-client.constants';

function parseAuthClient(value: unknown): AuthClient | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === AUTH_CLIENT.WMS || normalized === AUTH_CLIENT.MATEO) {
    return normalized;
  }

  return null;
}

export const AuthClientParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthClient | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, string | string[] | undefined>;
    }>();

    const headerValue = request.headers[AUTH_CLIENT_HEADER];
    const queryValue = request.query.client;

    return (
      parseAuthClient(
        Array.isArray(headerValue) ? headerValue[0] : headerValue,
      ) ?? parseAuthClient(Array.isArray(queryValue) ? queryValue[0] : queryValue)
    );
  },
);
