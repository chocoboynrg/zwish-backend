import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const payload = exceptionResponse as {
          message?: string | string[];
          error?: string;
          errors?: unknown;
        };

        if (Array.isArray(payload.message)) {
          message = 'Validation échouée';
          errors = payload.message;
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        } else if (typeof payload.error === 'string') {
          message = payload.error;
        }

        if (payload.errors !== undefined) {
          errors = payload.errors;
        }
      }
    }

    response.status(status).json({
      success: false,
      message,
      ...(errors !== undefined ? { errors } : {}),
      statusCode: status,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
