import { createZodDto } from 'nestjs-zod';
import { availabilityQuery } from '@hubday/contracts';

export class AvailabilityQueryDto extends createZodDto(availabilityQuery) {}
