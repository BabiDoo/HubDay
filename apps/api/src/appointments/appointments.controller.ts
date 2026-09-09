import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Appointment, ListAppointmentsResponse } from '@hubday/contracts';
import { AppointmentsService } from './appointments.service.js';
import {
  AppointmentIdParamDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from './appointments.dto.js';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments for the current company' })
  list(@Query() query: ListAppointmentsQueryDto): Promise<ListAppointmentsResponse> {
    return this.appointments.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one appointment by id' })
  getOne(@Param() params: AppointmentIdParamDto): Promise<Appointment> {
    return this.appointments.getById(params.id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an appointment (revalidates availability, DB enforces no overlap)' })
  create(@Body() body: CreateAppointmentDto): Promise<Appointment> {
    return this.appointments.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Reschedule a scheduled appointment' })
  reschedule(
    @Param() params: AppointmentIdParamDto,
    @Body() body: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.appointments.reschedule(params.id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a scheduled appointment (frees the interval)' })
  cancel(@Param() params: AppointmentIdParamDto): Promise<Appointment> {
    return this.appointments.cancel(params.id);
  }
}
