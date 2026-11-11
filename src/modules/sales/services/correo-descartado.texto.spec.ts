import { BadRequestException } from '@nestjs/common';
import { armarTexto, mensajeDe } from './correo-descartado.texto';

describe('correo-descartado.texto', () => {
  it('usa el HTML sin etiquetas cuando no hay texto plano', () => {
    const texto = armarTexto({
      asunto: 'Pedido',
      de: 'a@b.com',
      para: 'c@d.com',
      fecha: '2026-11-11',
      texto: '',
      html: '<p>5&nbsp;cajas</p><style>p{}</style>',
      adjuntos: [],
    });
    expect(texto).toContain('5 cajas');
    expect(texto).not.toContain('<p>');
    expect(texto).not.toContain('p{}');
  });

  it('saca el mensaje de una HttpException', () => {
    expect(mensajeDe(new BadRequestException('sin adjuntos'))).toContain(
      'sin adjuntos',
    );
    expect(mensajeDe(new Error('falló'))).toBe('falló');
  });
});
