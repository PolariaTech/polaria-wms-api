import type { ArchivoExtraido } from '../file-extractors';
import {
  buildTextoOrigenPedido,
  cleanCorreoBodyForNotas,
} from './texto-origen-pedido';

/** Estructura del caso OV-1124: nota del vendedor, forward y un Cc partido en dos líneas. */
const CORREO_REENVIADO = [
  'Antojarte',
  '',
  '---------- Forwarded message ---------',
  'De: <cocina@cliente.example>',
  'Date: vie, 30 de oct de 2026, 1:28 p.m.',
  'Subject: pedido de aguacate para el dia 31-10-26',
  'To: <ventas@vendedor.example>',
  'Cc: <gerencia@empresa.example>, <',
  'operaciones@empresa.example>, Almacen <almacen@empresa.example>',
  '',
  '',
  'Aguacate  hass  9 kilos',
  '',
  '',
  '',
  'Gracias…',
].join('\n');

describe('texto de origen con nota del vendedor antes del forward (REQ-258)', () => {
  it('cleanCorreoBodyForNotas conserva la nota escrita antes del mensaje reenviado', () => {
    const resultado = cleanCorreoBodyForNotas(CORREO_REENVIADO);
    expect(resultado.startsWith('Antojarte')).toBe(true);
    expect(resultado).toMatch(/Aguacate\s+hass\s+9 kilos/);
    expect(resultado).not.toMatch(/Forwarded message/i);
  });

  it('cleanCorreoBodyForNotas no cambia un correo reenviado sin nota previa', () => {
    const sinNota = CORREO_REENVIADO.split('\n').slice(2).join('\n');
    const resultado = cleanCorreoBodyForNotas(sinNota);
    expect(resultado.startsWith('Aguacate')).toBe(true);
  });

  it('buildTextoOrigenPedido guarda la nota y no deja la continuación del Cc', () => {
    const archivos: ArchivoExtraido[] = [
      {
        tipo: 'texto',
        nombre: 'correo.eml — cuerpo',
        contenido: CORREO_REENVIADO,
      },
    ];
    const resultado = buildTextoOrigenPedido('', archivos);
    expect(resultado).toContain('Antojarte');
    expect(resultado).toMatch(/Aguacate\s+hass\s+9 kilos/);
    expect(resultado).not.toContain('operaciones@empresa.example');
    expect(resultado).not.toContain('almacen@empresa.example');
  });
});
