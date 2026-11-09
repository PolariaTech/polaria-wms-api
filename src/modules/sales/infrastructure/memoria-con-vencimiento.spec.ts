import { MemoriaConVencimiento } from './memoria-con-vencimiento';

describe('MemoriaConVencimiento', () => {
  let ahora: jest.SpyInstance;

  beforeEach(() => {
    ahora = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });
  afterEach(() => {
    ahora.mockRestore();
  });

  it('lee una sola vez mientras la entrada siga vigente', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 5);
    const cargar = jest.fn().mockResolvedValue('valor');

    await memoria.leer('a', cargar);
    ahora.mockReturnValue(1_000 + 9_999);
    await expect(memoria.leer('a', cargar)).resolves.toBe('valor');

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('vuelve a leer cuando se cumple la vigencia', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 5);
    const cargar = jest.fn().mockResolvedValue('valor');

    await memoria.leer('a', cargar);
    ahora.mockReturnValue(1_000 + 10_000);
    await memoria.leer('a', cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('claves distintas no se mezclan', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 5);
    const cargar = jest
      .fn()
      .mockResolvedValueOnce('uno')
      .mockResolvedValueOnce('dos');

    await expect(memoria.leer('a', cargar)).resolves.toBe('uno');
    await expect(memoria.leer('b', cargar)).resolves.toBe('dos');
  });

  it('dos lecturas a la vez de la misma clave comparten una sola carga', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 5);
    const cargar = jest.fn().mockResolvedValue('valor');

    const resultados = await Promise.all([
      memoria.leer('a', cargar),
      memoria.leer('a', cargar),
    ]);

    expect(resultados).toEqual(['valor', 'valor']);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('un fallo no se guarda ni deja la clave bloqueada', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 5);
    const cargar = jest
      .fn()
      .mockRejectedValueOnce(new Error('caído'))
      .mockResolvedValue('valor');

    await expect(memoria.leer('a', cargar)).rejects.toThrow('caído');
    await expect(memoria.leer('a', cargar)).resolves.toBe('valor');
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('al pasar del máximo descarta la menos usada, no la más vieja', async () => {
    const memoria = new MemoriaConVencimiento<string>(10_000, 2);
    const cargar = jest.fn((clave: string) => Promise.resolve(clave));
    const leer = (clave: string) => memoria.leer(clave, () => cargar(clave));

    await leer('a');
    await leer('b');
    await leer('a'); // 'a' se usa de nuevo: 'b' pasa a ser la menos usada
    await leer('c'); // entra 'c' y se descarta 'b'
    expect(cargar).toHaveBeenCalledTimes(3);

    await leer('a');
    await leer('c');
    expect(cargar).toHaveBeenCalledTimes(3);
    await leer('b');
    expect(cargar).toHaveBeenCalledTimes(4);
  });
});
