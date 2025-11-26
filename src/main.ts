import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Research & Search API')
    .setDescription(
      'API for web search and deep research functionality with Parallel AI Task API integration. ' +
      'Supports web search (lite, base processors), quick deep research (base, core processors), ' +
      'deep research (core, pro processors), ultra deep research (pro, ultra, ultra2x, ultra4x, ultra8x processors), ' +
      'and FindAll entity discovery (base, core, pro generators).',
    )
    .setVersion('1.0')
    .addTag('web-search', 'Web search operations')
    .addTag('quick-deep-research', 'Quick deep research operations')
    .addTag('deep-research', 'Deep research operations')
    .addTag('ultra-deep-research', 'Ultra deep research operations')
    .addTag('findall', 'FindAll entity discovery operations')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger UI available at: http://localhost:${port}/api-docs`);
}
bootstrap();
