import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_TOKEN_TTL_SECONDS, loadEnv } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      // Pull the secret from the validated env contract (loadEnv exits the
      // process if AUTH_TOKEN_SECRET is missing) — never a hardcoded fallback.
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.AUTH_TOKEN_SECRET,
          signOptions: { algorithm: 'HS256', expiresIn: AUTH_TOKEN_TTL_SECONDS },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
