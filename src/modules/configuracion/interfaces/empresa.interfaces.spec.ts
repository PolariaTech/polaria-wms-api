import type { UpdateEmpresaResult } from './empresa.interfaces';

describe('EmpresaFichaFiscal', () => {
  it('incluye la ficha fiscal y el logo en la empresa', () => {
    const empresa: UpdateEmpresaResult = {
      codigoEmpresa: 'Y9IHZ',
      razonSocial: 'Aguacates de puebla',
      telefono: null,
      estaActiva: true,
      rfc: 'APU210325668',
      regimenFiscal: '601',
      codigoPostalExpedicion: '77560',
      nombreCuentaBancaria: 'Aguacates de Puebla',
      banco: 'BBVA',
      clabe: '012528001186364430',
      correoCobranza: 'cobranza@aguacatesdepuebla.com',
      serieFactura: 'CS-',
      logoPath: 'Y9IHZ/logo.jpg',
    };

    expect(empresa.logoPath).toBe('Y9IHZ/logo.jpg');
    expect(empresa.clabe).toHaveLength(18);
  });
});
