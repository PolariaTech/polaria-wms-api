import { PrismaService } from './prisma.service';

describe('PrismaService tenant search_path helpers', () => {
  it('arma search_path sin espacios (libpq options)', () => {
    const searchPathFor = (schemaName: string | null) =>
      schemaName
        ? `${schemaName},public,mateo_support`
        : 'public,mateo_support';

    expect(searchPathFor(null)).toBe('public,mateo_support');
    expect(searchPathFor('emp_andino')).toBe('emp_andino,public,mateo_support');
  });

  it('expone runWithSchema / forSchema / provisionEmpresaSchema en la clase', () => {
    expect(typeof PrismaService.prototype.runWithSchema).toBe('function');
    expect(typeof PrismaService.prototype.forSchema).toBe('function');
    expect(typeof PrismaService.prototype.provisionEmpresaSchema).toBe(
      'function',
    );
  });
});
