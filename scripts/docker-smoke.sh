#!/usr/bin/env bash
# Prueba de humo de la imagen Docker: arranca el contenedor con variables falsas,
# espera a que GET / responda 200 y reporta el tamaño de la imagen.
# La usan el CI (.github/workflows/ci.yml, job docker-image) y el build local.
#
# Uso: scripts/docker-smoke.sh [imagen]   (por defecto polaria-wms-api:local)
set -euo pipefail

IMAGE="${1:-polaria-wms-api:local}"
NAME="wms-api-smoke"
HOST_PORT="${SMOKE_PORT:-3000}"
ENV_FILE="$(dirname "$0")/docker-smoke.env"
MAX_SIZE_MB=400

docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" --env-file "$ENV_FILE" -p "$HOST_PORT:3000" "$IMAGE" >/dev/null

echo "Esperando GET / en localhost:$HOST_PORT ..."
for _ in $(seq 1 30); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$HOST_PORT/")" = "200" ]; then
    echo "OK: GET / respondió 200"
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != "true" ]; then
    echo "ERROR: el contenedor se detuvo"
    docker logs "$NAME"
    exit 1
  fi
  sleep 2
done

if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$HOST_PORT/")" != "200" ]; then
  echo "ERROR: GET / no respondió 200 en 60 s"
  docker logs "$NAME"
  exit 1
fi

USER_IN_CONTAINER="$(docker exec "$NAME" whoami)"
if [ "$USER_IN_CONTAINER" = "root" ]; then
  echo "ERROR: el contenedor corre como root"
  exit 1
fi
echo "OK: corre como '$USER_IN_CONTAINER'"

ARCH="$(docker image inspect -f '{{.Architecture}}' "$IMAGE")"
SIZE_MB=$(( $(docker image inspect -f '{{.Size}}' "$IMAGE") / 1024 / 1024 ))
# Aproximación de lo que se guarda en el registro y se descarga al arrancar (capas en gzip).
GZIP_MB=$(( $(docker save "$IMAGE" | gzip -1 | wc -c) / 1024 / 1024 ))
echo "Imagen: $IMAGE · arquitectura: $ARCH · ~${GZIP_MB} MB comprimida (objetivo < ${MAX_SIZE_MB} MB) · ${SIZE_MB} MB sin comprimir"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Imagen Docker"
    echo "| Arquitectura | Comprimida (aprox.) | Objetivo (comprimida) | Sin comprimir | GET / | Usuario |"
    echo "|---|---|---|---|---|---|"
    echo "| $ARCH | ~${GZIP_MB} MB | < ${MAX_SIZE_MB} MB | ${SIZE_MB} MB | 200 | $USER_IN_CONTAINER |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

# La meta es sobre el tamaño comprimido: es lo que se guarda en ECR (costo) y lo que
# Fargate descarga al arrancar (tiempo de arranque). Spec del servicio §1.
if [ "$GZIP_MB" -ge "$MAX_SIZE_MB" ]; then
  echo "ERROR: la imagen comprimida supera ${MAX_SIZE_MB} MB"
  exit 1
fi
