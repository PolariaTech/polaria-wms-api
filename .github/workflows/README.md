# workflows

Definiciones de GitHub Actions que se ejecutan automáticamente en cada push o pull request.

## Archivos

| Archivo | Descripción |
|---|---|
| `ci.yml` | Pipeline de integración continua. Job `build-and-test`: instala dependencias, compila y corre los tests (unitarios y e2e). Job `docker-image`: construye la imagen `linux/arm64` en un runner ARM y la prueba con `scripts/docker-smoke.sh` |
