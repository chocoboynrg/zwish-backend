// ⚠️ dotenv DOIT être chargé avant tout autre import NestJS
// Node.js résout les imports dans l'ordre — ce fichier garantit
// que process.env est peuplé avant que les décorateurs soient évalués
import * as dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import * as express from 'express';

async function bootstrap() {
  console.log('ENV CHECK =>', {
    cwd: process.cwd(),
    jwt: process.env.JWT_SECRET ? 'OK' : 'MISSING',
    mailHost: process.env.MAIL_HOST,
    mailPort: process.env.MAIL_PORT,
    mailUser: process.env.MAIL_USER,
  });

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ JWT_SECRET manquant — utilisation fallback dev');
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());

  const port = process.env.PORT ?? 3000;

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');

  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();
