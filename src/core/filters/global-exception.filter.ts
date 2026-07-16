import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      const raw = exception.getResponse();
      const body: ErrorBody =
        typeof raw === 'string'
          ? {
              statusCode: status,
              message: raw,
              error: HttpStatus[status] ?? 'Error',
            }
          : {
              statusCode: status,
              message:
                (raw as { message?: string | string[] }).message ??
                exception.message,
              error:
                (raw as { error?: string }).error ??
                HttpStatus[status] ??
                'Error',
            };

      response.status(status).json(body);
      return;
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2021'
    ) {
      this.logger.error(
        'Tabla Prisma ausente (¿migración pendiente?)',
        exception.stack,
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Esquema de base de datos incompleto. Aplica la migración widget_conversacion.',
        error: 'Service Unavailable',
      });
      return;
    }

    this.logger.error(
      'Error no controlado',
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
    });
  }
}
