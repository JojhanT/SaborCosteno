#!/bin/sh
set -e

# La carpeta de datos (base y fotos) debe ser del usuario "node". Puede venir de
# una copia hecha como root (scp, docker cp) o ser una carpeta recién creada.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$SABOR_DATA"
  find "$SABOR_DATA" ! -user node -exec chown node:node {} +
  exec su-exec node "$@"
fi

exec "$@"
