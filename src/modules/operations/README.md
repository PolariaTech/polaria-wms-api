# modules/operations

Operaciones de bodega alineadas al flujo de [frio](https://github.com/eldani13/frio).

## Documentación

Ver [API.md](./API.md) para endpoints, roles y mapeo de flujos.

## Responsabilidad

- Órdenes de trabajo: entrada (`a_bodega`), salida (`a_salida`), revisión (`revisar`)
- Cola de tareas para operario/custodio
- Alertas operativas (temperatura, demora, orden reportada)
- Llamadas al jefe de bodega desde operario/procesador
