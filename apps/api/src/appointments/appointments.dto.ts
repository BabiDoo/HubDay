import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  createAppointmentRequest,
  listAppointmentsQuery,
  rescheduleAppointmentRequest,
  uuid,
} from '@hubday/contracts';

export class CreateAppointmentDto extends createZodDto(createAppointmentRequest) {}
export class RescheduleAppointmentDto extends createZodDto(rescheduleAppointmentRequest) {}
export class ListAppointmentsQueryDto extends createZodDto(listAppointmentsQuery) {}
export class AppointmentIdParamDto extends createZodDto(z.object({ id: uuid }).strict()) {}
