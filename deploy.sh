#!/bin/sh
# Actualiza el sistema en el servidor y comprueba que quedó andando.
# Lo ejecuta GitHub Actions por SSH en cada push a main, y también sirve a mano.
set -eu

cd /opt/sabor

echo "→ bajando los cambios"
git pull --ff-only

echo "→ reconstruyendo"
docker compose up -d --build

echo "→ esperando a que la app quede sana"
i=0
while [ "$i" -lt 60 ]; do
  estado=$(docker inspect -f '{{.State.Health.Status}}' sabor-app-1 2>/dev/null || echo "sin-contenedor")
  case "$estado" in
    healthy)
      echo "✓ desplegado: $(git rev-parse --short HEAD)"
      docker image prune -f >/dev/null 2>&1 || true
      exit 0
      ;;
    unhealthy)
      echo "✗ la app quedó en mal estado. Últimas líneas del registro:"
      docker compose logs app --tail=40
      exit 1
      ;;
  esac
  i=$((i + 1))
  sleep 2
done

echo "✗ la app no quedó sana en 2 minutos. Últimas líneas del registro:"
docker compose logs app --tail=40
exit 1
