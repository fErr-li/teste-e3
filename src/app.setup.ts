import { INestApplication, ValidationPipe } from '@nestjs/common';

// Usado pelo main.ts e pelos testes, para a aplicação testada ser igual à de produção.
export function configurarApp(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
