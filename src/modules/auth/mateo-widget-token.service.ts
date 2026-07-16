import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { WmsRol } from '../../generated/prisma/client';

export const MATEO_WIDGET_JWT_TTL_SECONDS = 300;

/** Defaults alineados al mock / guard POL-71 de n8n (iss/aud/kid). */
export const MATEO_WIDGET_JWT_DEFAULT_ISSUER = 'bodega-frio-v2';
export const MATEO_WIDGET_JWT_DEFAULT_AUDIENCE = 'mateo-support-widget';
export const MATEO_WIDGET_JWT_DEFAULT_KID = 'local-dev-v1';

export interface MateoWidgetTokenUsuario {
  idAuth: string;
  idUsuario: string;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  idRol: WmsRol;
  correo: string;
  /** Nombre completo WMS → claim `given_name` para n8n. */
  nombre?: string | null;
}

export interface MateoWidgetJwtPayload {
  sub: string;
  jti: string;
  idUsuario: string;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  idRol: WmsRol;
  email: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
export class MateoWidgetTokenService {
  private readonly logger = new Logger(MateoWidgetTokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateToken(usuario: MateoWidgetTokenUsuario): {
    token: string;
    expiresIn: number;
  } {
    const jti = randomUUID();
    const { givenName, familyName } = splitNombre(usuario.nombre);

    const token = this.jwtService.sign(
      {
        sub: usuario.idAuth,
        jti,
        idUsuario: usuario.idUsuario,
        codigoEmpresa: usuario.codigoEmpresa,
        codigoCuenta: usuario.codigoCuenta,
        idRol: usuario.idRol,
        email: usuario.correo,
        ...(givenName ? { given_name: givenName } : {}),
        ...(familyName ? { family_name: familyName } : {}),
      } satisfies MateoWidgetJwtPayload,
      {
        secret: this.getSecret(),
        expiresIn: MATEO_WIDGET_JWT_TTL_SECONDS,
        algorithm: 'HS256',
        issuer: this.getIssuer(),
        audience: this.getAudience(),
        keyid: this.getKid(),
      },
    );

    this.logger.log(
      `Widget token generado para idAuth=${usuario.idAuth} idUsuario=${usuario.idUsuario}`,
    );

    return {
      token,
      expiresIn: MATEO_WIDGET_JWT_TTL_SECONDS,
    };
  }

  private getSecret(): string {
    return this.configService.getOrThrow<string>('MATEO_WIDGET_JWT_SECRET');
  }

  private getIssuer(): string {
    return (
      this.configService.get<string>('MATEO_WIDGET_JWT_ISSUER')?.trim() ||
      MATEO_WIDGET_JWT_DEFAULT_ISSUER
    );
  }

  private getAudience(): string {
    return (
      this.configService.get<string>('MATEO_WIDGET_JWT_AUDIENCE')?.trim() ||
      MATEO_WIDGET_JWT_DEFAULT_AUDIENCE
    );
  }

  private getKid(): string {
    return (
      this.configService.get<string>('MATEO_WIDGET_JWT_KID')?.trim() ||
      MATEO_WIDGET_JWT_DEFAULT_KID
    );
  }
}

function splitNombre(nombre?: string | null): {
  givenName?: string;
  familyName?: string;
} {
  const trimmed = nombre?.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { givenName: parts[0] };
  return {
    givenName: parts[0],
    familyName: parts.slice(1).join(' '),
  };
}
