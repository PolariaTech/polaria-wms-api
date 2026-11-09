interface Guardado<T> {
  valor: T;
  expira: number;
}

/**
 * Guarda en memoria el resultado de una lectura lenta unos segundos. Dos peticiones a la vez
 * por la misma clave comparten una sola lectura, un fallo nunca se guarda, y al pasar del
 * máximo se descarta la entrada menos usada.
 */
export class MemoriaConVencimiento<T> {
  private readonly guardados = new Map<string, Guardado<T>>();
  private readonly enCamino = new Map<string, Promise<T>>();

  constructor(
    private readonly vigenciaMs: number,
    private readonly maximo: number,
  ) {}

  leer(clave: string, cargar: () => Promise<T>): Promise<T> {
    const guardado = this.vigente(clave);
    if (guardado) return Promise.resolve(guardado.valor);

    const enCamino = this.enCamino.get(clave);
    if (enCamino) return enCamino;

    const lectura = cargar()
      .then((valor) => {
        this.guardar(clave, valor);
        return valor;
      })
      .finally(() => {
        this.enCamino.delete(clave);
      });
    this.enCamino.set(clave, lectura);
    return lectura;
  }

  private vigente(clave: string): Guardado<T> | null {
    const ahora = Date.now();
    for (const [otra, entrada] of this.guardados) {
      if (entrada.expira <= ahora) this.guardados.delete(otra);
    }
    const entrada = this.guardados.get(clave);
    if (!entrada) return null;
    this.guardados.delete(clave);
    this.guardados.set(clave, entrada); // la más usada queda al final
    return entrada;
  }

  private guardar(clave: string, valor: T): void {
    this.guardados.set(clave, { valor, expira: Date.now() + this.vigenciaMs });
    while (this.guardados.size > this.maximo) {
      for (const masVieja of this.guardados.keys()) {
        this.guardados.delete(masVieja);
        break;
      }
    }
  }
}
