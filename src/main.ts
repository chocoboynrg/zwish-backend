import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import * as dotenv from 'dotenv';
import { join } from 'path';
import * as express from 'express';
dotenv.config({ path: join(process.cwd(), '.env') });

async function bootstrap() {
  // 🔥 charge .env AVANT tout
  dotenv.config();

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
    // origin: [
    //   'http://localhost:4200',
    //   'http://127.0.0.1:4200',
    //   'http://localhost:50935',
    // ],
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
