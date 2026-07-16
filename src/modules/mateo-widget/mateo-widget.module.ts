import { Module } from '@nestjs/common';
import { ConversacionesController } from './controllers/conversaciones.controller';
import { ConversacionesRepository } from './infrastructure/conversaciones.repository';
import { ConversacionesService } from './services/conversaciones.service';

@Module({
  controllers: [ConversacionesController],
  providers: [ConversacionesService, ConversacionesRepository],
})
export class MateoWidgetModule {}
