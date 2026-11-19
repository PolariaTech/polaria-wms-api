# workflows

Definiciones de GitHub Actions del repositorio.

## Archivos

| Archivo | Descripción |
|---|---|
| `ci.yml` | Pipeline de integración continua. Se ejecuta automáticamente en cada push o pull request a `main`. Job `build-and-test`: instala dependencias, compila y corre los tests (unitarios y e2e). Job `dependency-audit`: corre `npm audit` sobre las dependencias de producción; es **informativo** (`continue-on-error`) hasta que se resuelva POL-434. Job `docker-image`: construye la imagen `linux/arm64` en un runner ARM, la prueba con `scripts/docker-smoke.sh` y la escanea con Trivy (falla con vulnerabilidades críticas que ya tengan corrección). Todas las acciones de terceros están fijadas por SHA de commit |
| `deploy.yml` | Despliegue **manual** a ECS Fargate (POL-357, ADR-006). Solo se ejecuta cuando alguien lo lanza desde la pestaña Actions, siempre desde la rama `main` (los roles de AWS solo confían en `main`), e indicando en el campo obligatorio `ref` el tag a desplegar (por ejemplo `v2.9.16`). Job `build`: construye ese código, lo prueba y lo sube a ECR con el SHA completo del commit como etiqueta; si esa imagen ya existe, la reutiliza. Job `deploy`: espera la aprobación del Environment `production` (Daniel o Lucho), registra una revisión nueva de la task definition con esa imagen y actualiza el servicio. Nunca cambia `desired_count`. Se autentica en AWS por OIDC, sin llaves de acceso |
| `auto-rebase-stacked-prs.yml` | Se ejecuta cuando se cierra un PR fusionado: reapunta a la nueva base los PR abiertos que apuntaban a su rama (PRs apilados) y les deja un comentario con los comandos para actualizar su rama |
