import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AvailabilityResponse } from '@hubday/contracts';
import { AvailabilityService } from './availability.service.js';
import { AvailabilityQueryDto } from './availability.dto.js';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Backend-generated bookable slots for a professional + service + date' })
  get(@Query() query: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    return this.availability.getAvailability(query);
  }
}
