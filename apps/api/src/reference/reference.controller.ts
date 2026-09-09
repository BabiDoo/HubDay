import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Customer, Professional, Service } from '@hubday/contracts';
import { ReferenceService } from './reference.service.js';

@ApiTags('reference')
@ApiBearerAuth()
@Controller()
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('professionals')
  professionals(): Promise<Professional[]> {
    return this.reference.listProfessionals();
  }

  @Get('services')
  services(): Promise<Service[]> {
    return this.reference.listServices();
  }

  @Get('customers')
  customers(): Promise<Customer[]> {
    return this.reference.listCustomers();
  }
}
