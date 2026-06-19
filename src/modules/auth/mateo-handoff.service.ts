import {
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

export const MATEO_HANDOFF_TTL_SECONDS = 60;

interface MateoHandoffPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class MateoHandoffService implements OnModuleDestroy {
  private readonly logger = new Logger(MateoHandoffService.name);
  private readonly usedJtis = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.cleanupTimer = setInterval(() => this.purgeExpiredJtis(), 30_000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  generateCode(idAuth: string): { code: string; expiresIn: number } {
    const jti = randomUUID();

    const code = this.jwtService.sign(
      { sub: idAuth, jti } satisfies MateoHandoffPayload,
      {
        secret: this.getSecret(),
        expiresIn: MATEO_HANDOFF_TTL_SECONDS,
      },
    );

    this.logger.log(`Handoff generado para idAuth=${idAuth}`);

    return {
      code,
      expiresIn: MATEO_HANDOFF_TTL_SECONDS,
    };
  }

  redeemCode(code: string): string {
    let payload: MateoHandoffPayload;

    try {
      payload = this.jwtService.verify<MateoHandoffPayload>(code, {
        secret: this.getSecret(),
      });
    } catch {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    if (this.usedJtis.has(payload.jti)) {
      throw new UnauthorizedException('Código ya utilizado');
    }

    const expiresAt =
      (payload as MateoHandoffPayload & { exp?: number }).exp ??
      Math.floor(Date.now() / 1000) + MATEO_HANDOFF_TTL_SECONDS;

    this.usedJtis.set(payload.jti, expiresAt * 1000);

    return payload.sub;
  }

  private getSecret(): string {
    return this.configService.getOrThrow<string>('MATEO_HANDOFF_SECRET');
  }

  private purgeExpiredJtis(): void {
    const now = Date.now();

    for (const [jti, expiresAt] of this.usedJtis.entries()) {
      if (expiresAt <= now) {
        this.usedJtis.delete(jti);
      }
    }
  }
}
