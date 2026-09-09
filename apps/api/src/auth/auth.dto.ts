import { createZodDto } from 'nestjs-zod';
import { loginRequest } from '@hubday/contracts';

export class LoginDto extends createZodDto(loginRequest) {}
