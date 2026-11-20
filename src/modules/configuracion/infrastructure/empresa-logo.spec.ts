import { createClient } from '@supabase/supabase-js';
import {
  LOGO_EMPRESA_MAX_BYTES,
  subirLogoEmpresa,
  validarLogoEmpresa,
} from './empresa-logo';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const crearCliente = createClient as jest.MockedFunction<typeof createClient>;

describe('validarLogoEmpresa', () => {
  it.each(['image/jpeg', 'image/png'])('acepta un %s de 1 MB', (mimetype) => {
    expect(
      validarLogoEmpresa({
        size: LOGO_EMPRESA_MAX_BYTES,
        mimetype,
      }),
    ).toBeNull();
  });

  it('rechaza un archivo de 1048577 bytes', () => {
    expect(
      validarLogoEmpresa({
        size: LOGO_EMPRESA_MAX_BYTES + 1,
        mimetype: 'image/jpeg',
      }),
    ).toBe('El logo supera 1 MB.');
  });

  it('rechaza un MIME que no es JPEG ni PNG', () => {
    expect(
      validarLogoEmpresa({ size: 100, mimetype: 'image/gif' }),
    ).toBe('El logo debe ser JPEG o PNG.');
  });
});

describe('subirLogoEmpresa', () => {
  const entornoOriginal = { ...process.env };

  afterEach(() => {
    process.env = { ...entornoOriginal };
    jest.clearAllMocks();
  });

  it('devuelve fallo si no puede borrar el logo anterior', async () => {
    process.env.SUPABASE_URL = 'https://ejemplo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
    const quitar = jest.fn().mockResolvedValue({
      error: { message: 'No se pudo reemplazar el logo anterior.' },
    });
    const subir = jest.fn().mockResolvedValue({ error: null });
    crearCliente.mockReturnValue({
      storage: { from: () => ({ upload: subir, remove: quitar }) },
    } as unknown as ReturnType<typeof createClient>);

    const resultado = await subirLogoEmpresa({
      codigoEmpresa: 'Y9IHZ',
      buffer: Buffer.from('png'),
      mimetype: 'image/png',
      size: 3,
      logoPathAnterior: 'Y9IHZ/logo.jpg',
    });

    expect(quitar).toHaveBeenCalledWith(['Y9IHZ/logo.jpg']);
    expect(resultado).toEqual({
      ok: false,
      message: 'No se pudo reemplazar el logo anterior.',
    });
  });
});
