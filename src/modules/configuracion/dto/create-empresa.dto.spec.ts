import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateEmpresaDto } from './create-empresa.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('CreateEmpresaDto', () => {
  it('exige código y razón social', async () => {
    await expect(
      pipe.transform(
        {},
        { type: 'body', metatype: CreateEmpresaDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta el alta sin ficha fiscal', async () => {
    await expect(
      pipe.transform(
        { codigoEmpresa: 'ANDINO', razonSocial: 'Andino SpA' },
        { type: 'body', metatype: CreateEmpresaDto },
      ),
    ).resolves.toMatchObject({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
    });
  });
});
