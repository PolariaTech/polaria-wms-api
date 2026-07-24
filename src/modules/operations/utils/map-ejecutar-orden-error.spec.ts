import { BadRequestException, ConflictException } from '@nestjs/common';
import { mapEjecutarOrdenError } from './map-ejecutar-orden-error';

describe('mapEjecutarOrdenError', () => {
  it('mapea LOCK_REQUIRED a BadRequestException', () => {
    expect(() => mapEjecutarOrdenError(new Error('LOCK_REQUIRED'))).toThrow(
      BadRequestException,
    );
    expect(() => mapEjecutarOrdenError(new Error('LOCK_REQUIRED'))).toThrow(
      'Debe bloquear la posición del mapa antes de ejecutar la orden',
    );
  });

  it('mapea LOCK_HELD_BY_OTHER a ConflictException', () => {
    expect(() =>
      mapEjecutarOrdenError(new Error('LOCK_HELD_BY_OTHER')),
    ).toThrow(ConflictException);
    expect(() =>
      mapEjecutarOrdenError(new Error('LOCK_HELD_BY_OTHER')),
    ).toThrow('La posición está bloqueada por otro operario');
  });
});
