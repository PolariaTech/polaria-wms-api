import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { EmpresaFichaFiscalDto } from './empresa-ficha-fiscal.dto';

describe('EmpresaFichaFiscalDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  it('acepta el RFC de la factura con espacios', async () => {
    const dto = await pipe.transform(
      { rfc: 'APU 210325 668' },
      { type: 'body', metatype: EmpresaFichaFiscalDto },
    );

    expect(dto.rfc).toBe('APU 210325 668');
  });

  it('rechaza un régimen que no tiene 3 dígitos', async () => {
    const error = await pipe
      .transform(
        { regimenFiscal: '61' },
        { type: 'body', metatype: EmpresaFichaFiscalDto },
      )
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    expect(body.message).toContain('El régimen fiscal no es válido.');
  });
});
