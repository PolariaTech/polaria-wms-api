import { BodegaTipo, DestinoTipo } from '../../../generated/prisma/client';

export function destinoTipoToBodegaTipo(destinoTipo: DestinoTipo): BodegaTipo {
  return destinoTipo === DestinoTipo.externa
    ? BodegaTipo.externa
    : BodegaTipo.interna;
}
