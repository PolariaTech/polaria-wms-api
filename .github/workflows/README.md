# workflows

Definiciones de GitHub Actions del repositorio.

## Archivos

| Archivo | Descripción |
|---|---|
| `ci.yml` | Pipeline de integración continua. Se ejecuta automáticamente en cada push o pull request a `main`. Job `build-and-test`: instala dependencias, compila y corre los tests (unitarios y e2e). Job `dependency-audit`: corre `npm audit` sobre las dependencias de producción; es **informativo** (`continue-on-error`) hasta que se resuelva POL-434. Job `docker-image`: construye la imagen `linux/arm64` en un runner ARM, la prueba con `scripts/docker-smoke.sh` y la escanea con Trivy (falla con vulnerabilidades críticas que ya tengan corrección). Todas las acciones de terceros están fijadas por SHA de commit |
| `deploy.yml` | Despliegue **manual** a ECS Fargate (POL-357, ADR-006). Solo se ejecuta cuando alguien lo lanza desde la pestaña Actions, siempre desde la rama `main` (los roles de AWS solo confían en `main`), e indicando en el campo obligatorio `ref` el tag a desplegar (por ejemplo `v2.9.16`). Job `build`: construye ese código, lo prueba y lo sube a ECR con el SHA completo del commit como etiqueta; si esa imagen ya existe, la reutiliza. Job `deploy`: espera la aprobación del Environment `production` (Daniel o Lucho), registra una revisión nueva de la task definition con esa imagen y actualiza el servicio. Nunca cambia `desired_count`. Se autentica en AWS por OIDC, sin llaves de acceso |
| `auto-rebase-stacked-prs.yml` | Se ejecuta cuando se cierra un PR fusionado: reapunta a la nueva base los PR abiertos que apuntaban a su rama (PRs apilados) y les deja un comentario con los comandos para actualizar su rama |
| `fusion-programada.yml` | Fusión **programada** a `main` (decisión de Daniel, 2026-11-19). Todos los días a las 06:00 hora de Colombia (11:00 UTC) fusiona los PR hacia `main` que estén listos: no borrador, sin conflictos, con todas las comprobaciones en verde y sin la etiqueta `no-fusionar` (el freno manual). **Desde 2026-11-20 no exige aprobación de revisión** (decisión de Daniel: en la etapa de desarrollo estorba más de lo que ayuda); el ruleset de `main` debe tener 0 aprobaciones requeridas. Los PR que quedan fuera aparecen en el resumen de la ejecución con su motivo. Un PR **desactualizado** (el ruleset exige `strict`) lo actualiza el propio robot: mete `main` en la rama con `gh pr update-branch`, lanza `ci.yml` a mano sobre ella (por eso `ci.yml` tiene `workflow_dispatch`: un push con el token del workflow no dispara `pull_request`), espera hasta 15 minutos a que terminen las comprobaciones y, si salen en verde, lo fusiona; si no terminan a tiempo queda para la próxima ejecución, y si salen en rojo o hay conflicto es un **fallo real**. Otros fallos reales (comentarios sin resolver, otra regla del ruleset) dejan el workflow en rojo para que GitHub avise. Tras fusionar un PR padre, **reapunta a `main` los PR apilados** sobre su rama. **No despliega**: el auto-deploy de Render lo hace con cada merge. Ejecución manual con `solo_simular = true` por defecto (muestra qué fusionaría y qué ramas actualizaría, sin hacerlo) |

### Pasar a AWS (cuando llegue el cutover)

La fusión programada no despliega: Render lo hace solo con cada merge a `main`. Al migrar, el despliegue a AWS se agrega como un paso **posterior** a la fusión, no dentro de ella:

1. Apagar el auto-deploy de Render en su panel (el cutover tiene su propio runbook) para que el merge ya no despliegue allí.
2. Hacer que `deploy.yml` (el despliegue manual a AWS) se pueda llamar desde la fusión programada: hoy exige un **tag de versión** en `ref` y la **aprobación manual** del Environment de AWS; un despliegue sin nadie delante necesita aceptar el SHA de `main` y decidir si esa aprobación se mantiene (lo más seguro) o se quita.
3. Agregar a `fusion-programada.yml` un job `desplegar-aws` que dependa de `fusionar`, corra solo si se fusionó algo y lance `deploy.yml` (permiso `actions: write`).
