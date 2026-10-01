# Desplegar en un VPS (Contabo)

El sistema corre en Docker con tres contenedores:

- **app**: el servidor de Sabor Costeño (Node 24 + MySQL vía `mysql2`). No queda expuesto a internet.
- **mysql**: la base de datos. Tampoco queda expuesta a internet, solo la alcanza `app`.
- **caddy**: recibe el tráfico por los puertos 80/443 y saca y renueva solo el certificado **HTTPS** (Let's Encrypt).

La base de datos vive en el volumen `mysql_data` (gestionado por Docker). Las fotos y los respaldos quedan en la carpeta `data/` del servidor, fuera de los contenedores: reconstruir o actualizar no los toca.

> **Ojo:** en un VPS la caja, la cocina y los repartidores se conectan **por internet**. Si se cae el internet del local, las pantallas del local dejan de recibir pedidos hasta que vuelva (se reconectan solas).

## Qué necesitas

- Un VPS con **Ubuntu 22.04 o 24.04** (el más pequeño de Contabo sobra).
- Un **dominio o subdominio**, por ejemplo `pedidos.saborcosteno.com`, con un **registro A** que apunte a la IP del VPS. Créalo antes de arrancar para que Caddy pueda sacar el certificado.
  - Para probar sin dominio puedes usar `TU-IP-CON-GUIONES.sslip.io` (ej. `203-0-113-7.sslip.io`).

## 1 · Preparar el servidor (una sola vez)

Entra por SSH con los datos que te mandó Contabo:

```bash
ssh root@IP-DEL-VPS
```

Instala Docker y abre solo los puertos necesarios:

```bash
curl -fsSL https://get.docker.com | sh

ufw allow OpenSSH
ufw allow 80,443/tcp
ufw allow 443/udp
ufw enable
```

## 2 · Subir el proyecto

**Opción A (recomendada): con Git.** Sube el proyecto a un repositorio privado (GitHub, GitLab…) y en el servidor:

```bash
git clone https://github.com/TU-USUARIO/sabor.git /opt/sabor
cd /opt/sabor
```

**Opción B: copiando desde Windows.** En PowerShell, dentro de la carpeta del proyecto (sin `node_modules` ni `data`):

```powershell
ssh root@IP-DEL-VPS "mkdir -p /opt/sabor"
scp -r client server docker package.json package-lock.json Dockerfile compose.yaml .dockerignore .env.example root@IP-DEL-VPS:/opt/sabor/
```

## 3 · Configurar el dominio

```bash
cd /opt/sabor
cp .env.example .env
nano .env          # DOMINIO=pedidos.saborcosteno.com
```

## 4 · (Opcional) Llevar los datos que ya tienes

Si ya usas el sistema en el computador de la caja y quieres conservar el menú, las fotos, los usuarios y los pedidos:

1. **Cierra** la ventana negra del sistema en la caja (así la base queda guardada completa).
2. Desde PowerShell, en la carpeta del proyecto:

   ```powershell
   scp -r data root@IP-DEL-VPS:/opt/sabor/
   ```

Con los datos copiados ya existe el administrador: entras con tu mismo usuario y contraseña (salta el paso 6).

## 5 · Arrancar

```bash
cd /opt/sabor
docker compose up -d --build
docker compose ps          # los dos deben quedar "running" (app pasa a "healthy")
```

La primera vez tarda unos minutos compilando. Luego abre `https://TU-DOMINIO`.

## 6 · Crear la cuenta del administrador

En un servidor nadie está "en el mismo computador", así que la app pide un **código de instalación**. Solo lo ve quien tiene acceso al servidor:

```bash
docker compose logs app | grep -i código
```

Escribe ese código en la pantalla *Protejamos el sistema*, junto con tu nombre, usuario y contraseña. El código sirve una sola vez. Cada vez que el contenedor se reinicia sin administrador, se genera uno nuevo (usa siempre el último).

Luego, en **Menú y ajustes → Usuarios**, crea las cuentas de cajeros, cocineros y repartidores.

## Pantallas del local

Abre desde cualquier TV, tablet o celular con internet:

- Caja: `https://TU-DOMINIO/caja`
- Cocina: `https://TU-DOMINIO/cocina`
- Repartidores: `https://TU-DOMINIO/reparto`

Modo kiosco para el TV de la cocina:

```
msedge --kiosk https://TU-DOMINIO/cocina --autoplay-policy=no-user-gesture-required
```

## El día a día en el servidor

| Para… | Comando (dentro de `/opt/sabor`) |
|---|---|
| Ver el registro (ingresos, errores) | `docker compose logs -f app` |
| Reiniciar | `docker compose restart app` |
| Apagar / encender | `docker compose down` / `docker compose up -d` |
| Actualizar a una versión nueva | `git pull && docker compose up -d --build` |
| Copia de seguridad ahora | `docker compose exec -u node app npm run -s respaldo` |
| Olvidé la clave del administrador | `docker compose exec -u node app npm run -s reset-claves` |

**Actualizar:** las pantallas abiertas detectan la versión nueva y se recargan solas (la caja ofrece un botón para no interrumpir un cobro). Si subiste el proyecto con `scp`, vuelve a copiar `client`, `server` y los demás archivos y ejecuta `docker compose up -d --build`.

**Recuperar el administrador:** el comando `reset-claves` desconecta todos los equipos y muestra un código. Entra a `https://TU-DOMINIO/recuperar` (o, en el login, toca *Soy el administrador: recuperar con el código*). Escribe un usuario nuevo, o uno existente para ponerle contraseña nueva. No se borra nada más.

## Copias de seguridad

`npm run respaldo` guarda un volcado completo de MySQL (`mysqldump`) en `data/respaldos/sabor-AAAA-MM-DD-HHMM.sql` **sin apagar el sistema**, y deja los últimos 30. Para que se haga solo todos los días a las 4 a. m., ejecuta `crontab -e` en el servidor y agrega:

```
0 4 * * * cd /opt/sabor && docker compose exec -T -u node app npm run -s respaldo >> /var/log/sabor-respaldo.log 2>&1
```

Las fotos están en `data/uploads` (no cambian una vez subidas). Para bajar todo a tu computador, desde PowerShell:

```powershell
scp -r root@IP-DEL-VPS:/opt/sabor/data .\respaldo-servidor
```

Guarda copias **fuera** del VPS: si el servidor se pierde, las copias que están dentro se pierden con él.

**Volver a una copia:**

```bash
cd /opt/sabor
docker compose exec -T mysql mysql -u root -p"$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2)" sabor < data/respaldos/sabor-2026-09-28-0400.sql
docker compose restart app
```

## Configuración (variables del contenedor `app`)

Ya vienen puestas en `compose.yaml`. Solo cámbialas si sabes lo que haces.

| Variable | Valor en Docker | Para qué |
|---|---|---|
| `PUBLIC_URL` | `https://${DOMINIO}` | Dirección que muestra el inicio para abrir las pantallas |
| `TRUST_PROXY` | `uniquelocal` | Cree la IP real del cliente que reporta Caddy (freno a intentos, equipos conectados, cookie segura) |
| `SABOR_DATA` | `/data` | Carpeta de fotos y respaldos (montada en `./data`) |
| `TZ` | `America/Bogota` | Hora del registro y de los nombres de los respaldos |
| `PORT` | `3000` | Puerto interno de la app |
| `RESPALDOS_MAX` | `30` | Cuántas copias de `npm run respaldo` se guardan |
| `DB_HOST` / `DB_PORT` | `mysql` / `3306` | Dirección del contenedor de MySQL |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | desde `.env` | Credenciales de la base (variables `MYSQL_*` del `.env`) |

## Si algo falla

- **El navegador dice que el sitio no es seguro o no abre:** revisa que el dominio apunte a la IP del VPS (`ping TU-DOMINIO`) y mira `docker compose logs caddy`. Caddy reintenta solo el certificado.
- **`app` no pasa a "healthy":** `docker compose logs app` muestra el error.
- **"Falta DOMINIO en el archivo .env":** falta crear `.env` (paso 3).
- **Usas otro proxy en vez de Caddy (nginx, Cloudflare Tunnel…):** debe enviar las cabeceras `Host`, `X-Forwarded-For` y `X-Forwarded-Proto`, no debe guardar en búfer `/api/stream` (conexión en vivo) y `TRUST_PROXY` debe apuntar a su IP.
