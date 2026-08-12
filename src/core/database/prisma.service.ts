import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';

/** Sin espacios: libpq parte `options` por whitespace y dejaba `search_path=public,`. */
const PLATFORM_SEARCH_PATH = 'public,mateo_support';

type TenantStore = {
  schemaName: string | null;
};

function buildSearchPath(schemaName: string | null): string {
  return schemaName
    ? `${schemaName},${PLATFORM_SEARCH_PATH}`
    : PLATFORM_SEARCH_PATH;
}

function poolOptionsForSearchPath(searchPath: string): string {
  return `-csearch_path=${searchPath}`;
}

/**
 * Tipado: delegates de PrismaClient (empresa, cuenta, …) vía declaration merge.
 * Runtime: Proxy redirige delegates al client con search_path del tenant (ALS).
 */
export interface PrismaService extends PrismaClient {}

/**
 * Prisma sin multi-schema: las queries respetan search_path del pool.
 * - Legacy / plataforma: public,mateo_support
 * - Empresa con schema_name: emp_xxx,public,mateo_support
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly connectionString: string;
  private readonly pools = new Map<string, Pool>();
  private readonly clients = new Map<string, PrismaClient>();
  private readonly als = new AsyncLocalStorage<TenantStore>();
  private readonly rootClient: PrismaClient;
  private readonly rootPool: Pool;

  constructor(configService: ConfigService) {
    this.connectionString = configService.getOrThrow<string>('DATABASE_URL');
    this.rootPool = new Pool({
      connectionString: this.connectionString,
      options: poolOptionsForSearchPath(PLATFORM_SEARCH_PATH),
    });
    this.rootClient = new PrismaClient({
      adapter: new PrismaPg(this.rootPool),
    });
    this.pools.set(PLATFORM_SEARCH_PATH, this.rootPool);
    this.clients.set(PLATFORM_SEARCH_PATH, this.rootClient);

    // eslint-disable-next-line no-constructor-return -- Proxy multi-tenant
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'string' && prop in target) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const client = target.forSchema();
        return Reflect.get(client, prop, client);
      },
    }) as unknown as PrismaService;
  }

  async onModuleInit(): Promise<void> {
    await this.rootClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    for (const [path, client] of this.clients) {
      await client.$disconnect();
      const pool = this.pools.get(path);
      if (pool) {
        await pool.end();
      }
    }
    this.clients.clear();
    this.pools.clear();
  }

  runWithSchema<T>(schemaName: string | null, fn: () => Promise<T>): Promise<T> {
    return this.als.run({ schemaName }, fn);
  }

  getActiveSchemaName(): string | null {
    return this.als.getStore()?.schemaName ?? null;
  }

  forSchema(schemaName?: string | null): PrismaClient {
    const resolved =
      schemaName === undefined ? this.getActiveSchemaName() : schemaName;
    const searchPath = buildSearchPath(resolved ?? null);

    const existing = this.clients.get(searchPath);
    if (existing) {
      return existing;
    }

    const pool = new Pool({
      connectionString: this.connectionString,
      options: poolOptionsForSearchPath(searchPath),
    });
    const client = new PrismaClient({
      adapter: new PrismaPg(pool),
    });
    this.pools.set(searchPath, pool);
    this.clients.set(searchPath, client);
    return client;
  }

  async provisionEmpresaSchema(codigoEmpresa: string): Promise<string> {
    const rows = await this.rootClient.$queryRaw<
      Array<{ wms_provision_empresa_schema: string }>
    >`
      SELECT public.wms_provision_empresa_schema(${codigoEmpresa}) AS wms_provision_empresa_schema
    `;
    const schema = rows[0]?.wms_provision_empresa_schema;
    if (!schema) {
      throw new Error(
        `No se pudo provisionar schema para empresa ${codigoEmpresa}`,
      );
    }
    return schema;
  }
}
