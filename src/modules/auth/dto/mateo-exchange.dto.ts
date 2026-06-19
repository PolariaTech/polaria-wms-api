import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MateoExchangeDto {
  @ApiProperty({
    description: 'Código de un solo uso obtenido en POST /auth/mateo-handoff',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
