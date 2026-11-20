import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateEmpresaDto } from './update-empresa.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function validar(body: unknown) {
  return pipe.transform(body, {
    type: 'body',
    metatype: UpdateEmpresaDto,
  });
}

describe('UpdateEmpresaDto', () => {
  it('acepta una CLABE de 17 dígitos', async () => {
    await expect(validar({ clabe: '12345678901234567' })).resolves.toMatchObject({
      clabe: '12345678901234567',
    });
  });

  it('acepta la ficha fiscal completa', async () => {
    const dto = await validar({
      rfc: 'apu210325668',
      regimenFiscal: '601',
      codigoPostalExpedicion: '77560',
      nombreCuentaBancaria: 'Aguacates de Puebla',
      banco: 'BBVA',
      clabe: '012528001186364430',
      correoCobranza: 'cobranza@aguacatesdepuebla.com',
      serieFactura: 'CS-',
    });

    expect(dto).toMatchObject({
      rfc: 'apu210325668',
      regimenFiscal: '601',
      codigoPostalExpedicion: '77560',
      clabe: '012528001186364430',
      correoCobranza: 'cobranza@aguacatesdepuebla.com',
      serieFactura: 'CS-',
    });
  });

  it('convierte una CLABE vacía en null', async () => {
    await expect(validar({ clabe: '   ' })).resolves.toMatchObject({
      clabe: null,
    });
  });

  it('acepta RFC y código postal con cualquier texto', async () => {
    await expect(
      validar({ rfc: 'APU21032566', codigoPostalExpedicion: '7756' }),
    ).resolves.toMatchObject({
      rfc: 'APU21032566',
      codigoPostalExpedicion: '7756',
    });
  });

  it('rechaza un correo de cobranza inválido y no escribe', async () => {
    const error = await validar({ correoCobranza: 'cobranza-aguacates' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(BadRequestException);
    const respuesta = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    expect(respuesta.message).toContain('El correo de cobranza no es válido.');
  });
});
