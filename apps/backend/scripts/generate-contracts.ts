import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from '../src/app.module';

/**
 * Boots the app once (no HTTP listen) to emit the API contracts — today only
 * openapi.json (the REST surface, SwaggerModule + nestjs-zod). Additional
 * contracts (e.g. a GraphQL SDL) belong here too, hence the generic name.
 *
 * The app is created but never `init()`ed: nothing here opens a database
 * connection. If a future module connects at bootstrap (auth, GraphQL schema
 * build…), CI's verify job will need a database service — see verify.yml.
 */
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Rowhouse API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

  await app.close();
  console.log('openapi.json generated');
}

void generate();
