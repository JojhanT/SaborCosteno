# Sabor Costeño ¡ajá! · Sistema de pedidos

Caja, cocina y repartidores conectados en tiempo real por la red del local. Cada persona entra con **su usuario y contraseña** y solo ve lo que su rol le permite.

| Pantalla | Dirección | Quién la usa | Para qué |
|---|---|---|---|
| Inicio | `/` | Administrador | Accesos a todas las pantallas y enlaces para TV y celulares |
| **Caja** | `/caja` | Cajero, administrador | Tomar pedidos, cobrar, despachar domicilios y ver la contabilidad |
| **Cocina** (TV / tablet) | `/cocina` | Cocinero, administrador | Ver los pedidos y marcarlos **listos** (la caja recibe el aviso) |
| **Reparto** (celular) | `/reparto` | Repartidor, administrador | Ver sus domicilios asignados y marcarlos **entregados** |
| Menú y ajustes | `/admin` | Administrador | Productos, precios, salsas, adiciones, ajustes y **usuarios** |
| Turnos (TV clientes) | `/turnos` | — | **Oculta.** Se activa en Menú y ajustes → Ajustes → Pantalla de turnos |

## Cómo arrancarlo

1. Instala **Node.js 22 o superior** desde <https://nodejs.org> (una sola vez).
2. Haz doble clic en **`iniciar.bat`**.
   La primera vez instala y prepara todo (tarda un par de minutos). Después abre el navegador en la caja.
3. Deja esa ventana negra abierta mientras el local esté funcionando. Si la cierras, se apaga el sistema.
4. **La primera vez**, en ese mismo computador aparece *Protejamos el sistema*: crea la **cuenta del administrador** (nombre, usuario y contraseña).
5. Entra a **Menú y ajustes → Usuarios** y crea una cuenta para cada persona: cajeros, cocineros y repartidores.

La consola muestra la dirección de red, por ejemplo `http://192.168.1.57:3000`. En los TV, tablets o celulares que estén en el **mismo wifi** abre:

- Cocina: `http://192.168.1.57:3000/cocina`
- Repartidores: `http://192.168.1.57:3000/reparto`

> La primera vez, Windows puede preguntar si permite el acceso de red a Node.js. Acepta en **redes privadas**; si no, los TV y celulares no se podrán conectar.

Por línea de comandos es lo mismo: `npm install`, `npm run build` y luego `npm start`.
Para cambiar el puerto: `set PORT=8080 && npm start`.

### En un servidor (VPS, Contabo)

Con Docker y HTTPS automático: `cp .env.example .env`, pon tu dominio y ejecuta `docker compose up -d --build`. La guía completa (dominio, datos existentes, copias de seguridad, actualizaciones) está en **[DESPLIEGUE.md](DESPLIEGUE.md)**.

### Si vienes de la versión con PIN

Al arrancar esta versión, el sistema **guarda una copia de la base** en `data/` (`respaldo-antes-de-actualizar-…db`) y la actualiza sola. Los pedidos, el menú y las fotos se conservan. Los PIN desaparecen: crea la cuenta del administrador en la caja y luego los usuarios. Cada equipo (caja, TV, celular) tendrá que iniciar sesión una vez con su usuario.

## Roles y permisos

| Rol | Qué puede hacer |
|---|---|
| **Administrador** (dueño) | Todo: caja, cocina, reparto, menú, precios, ajustes, usuarios y equipos conectados |
| **Cajero** | Caja: tomar, editar, cobrar y cancelar pedidos, despachar domicilios y ver la contabilidad. No cambia precios ni ajustes |
| **Cocinero** | Pantalla de cocina: ve los pedidos y los marca listos. No cobra ni ve la contabilidad |
| **Repartidor** | Solo **sus** domicilios en camino: dirección, teléfono, cuánto cobrar, y marcarlos entregados |

El servidor revisa cada permiso: aunque alguien escriba la dirección de otra pantalla, no puede ver ni cambiar lo que no le corresponde. Un repartidor ni siquiera recibe los pedidos de los demás.

## Usuarios, contraseñas y seguridad

- **Menú y ajustes → Usuarios**: crear, editar, cambiar el rol, desactivar y asignar contraseñas nuevas. Al desactivar a alguien o cambiarle el rol, su sesión se cierra al instante en todos sus equipos.
- **Contraseñas**: mínimo 8 caracteres, con letras y números, y sin el nombre de usuario. Se guardan cifradas (scrypt con sal propia); nadie puede leerlas, ni el administrador.
- **Contraseña temporal**: al crear o restablecer una contraseña se puede marcar *pedir que la cambie al entrar*. Esa persona no podrá hacer nada hasta ponerse una propia.
- **Cambiar mi contraseña**: en el menú con las iniciales (arriba a la derecha). Cierra la sesión en los demás equipos de esa persona.
- **Sesiones**: cada equipo queda recordado y la sesión se renueva sola mientras se usa. Vence si no se usa durante: administrador 12 horas, cajero 7 días, repartidor 30 días, cocinero 180 días (los TV).
- **Equipos con sesión abierta**: en Usuarios se ve cada equipo conectado (quién, navegador, IP, última actividad) y se puede **desconectar** cualquiera, por ejemplo un celular desconocido.
- **Intentos fallidos**: tras 5 contraseñas incorrectas, ese equipo se bloquea 5 minutos (y sube hasta 1 hora). Un mismo usuario que falla 10 veces desde cualquier lado se bloquea 15 minutos. La consola del servidor registra los ingresos y los intentos fallidos.
- La cuenta del administrador se crea **desde el computador donde está instalado el sistema** o, desde otro equipo, escribiendo el **código de instalación** que aparece en la ventana del servidor (en Docker: `docker compose logs app`). Así nadie en el wifi o en internet se adelanta.
- **¿Se te olvidó la contraseña del administrador?** En el computador de la caja ejecuta **`restablecer-claves.bat`** (en Docker: `docker compose exec -u node app npm run -s reset-claves`). Desconecta todos los equipos, muestra un código nuevo y abre la pantalla para crear un administrador nuevo o ponerle contraseña nueva a uno existente (escribe su mismo usuario): en ese computador directamente, o desde otro en `/recuperar` con el código. **No** borra pedidos, menú, fotos ni los demás usuarios.
- Recomendado: deja a los clientes en la **red de invitados** del router, separada de la red de la caja, los TV y los celulares del personal.

## El flujo del día a día

1. **Caja → Nuevo pedido.** Toca los productos (cada tarjeta muestra su foto).
   Al tocar uno se abre su ventana para elegir:
   - tamaño o sabor;
   - **ingredientes**: un toque lo quita (**SIN**), otro lo pone **APARTE**;
   - **salsas**: un toque la pone encima, otro aparte, otro la quita;
   - **adiciones** con precio;
   - una nota para la cocina.
2. Elige **Mesa** (con número), **Para llevar** o **Domicilio**. En domicilio se piden el cliente, el teléfono, la dirección, el barrio y el **valor del envío**.
3. **Enviar** (se cobra después) o **Cobrar y enviar**. El cobro puede ser en efectivo con cálculo de cambio, Nequi, Daviplata, tarjeta o transferencia.
4. El pedido recibe su **turno** (#1, #2… se reinicia cada jornada) y aparece al instante en la cocina, con campana y voz.
5. **Cocina → Listo.** El cocinero toca **Listo** en la tarjeta: el pedido sale de la cocina y **la caja recibe un aviso con sonido** («¡Turno #16 listo! · lo marcó Tomás»). Si se tocó por error, el aviso trae **Deshacer**.
6. **Caja → Pedidos**: tablero con cuatro columnas, *En cocina → Listos → En camino → Por cobrar*.
   - **Entregar** (mesa o para llevar): si ya está pagado, el pedido se cierra. Si no, pasa a *Por cobrar*.
   - **Despachar** (domicilio): se elige el **repartidor**. El pedido pasa a *En camino* y le llega al celular del repartidor con sonido. Se puede **pasar a otro repartidor** mientras va en camino. Si no hay repartidor (lo llevó alguien del local), *Sin repartidor* lo marca entregado de una vez.
   - 📣 vuelve a llamar un turno. ✏️ edita un pedido: la cocina lo ve marcado como *Modificado* y resalta lo agregado.
7. **Reparto (celular del repartidor)**: ve sus domicilios con la dirección (botón **Mapa**), el teléfono (**Llamar** / **WhatsApp**), la nota y **cuánto debe cobrar**. Al llegar toca **Marcar entregado**. La caja recibe el aviso; si no estaba pagado, queda en *Por cobrar* hasta que el repartidor entregue la plata.
8. **Caja → Contabilidad**: el cuadre del día (ventas, ticket promedio, lo que falta por cobrar, total por medio de pago, lo más vendido, **domicilios por repartidor** y cuánto debe cada uno) y todos los pedidos, con quién los tomó y quién los cobró. Se puede consultar cualquier día.

## Televisores y tablets de la cocina

- La cocina se abre con un usuario **cocinero** (se puede crear uno compartido para el TV, por ejemplo `tv.cocina`).
- **Sonido:** los navegadores no permiten sonar sin un primer toque. Al abrir la pantalla aparece el botón **"Toca para activar el sonido"**: tócalo una vez con el mouse o el control del TV.
- **Ajustes de cada TV:** mueve el mouse y aparece el engranaje (arriba a la derecha). El panel se desplaza con el mouse, el dedo o las **flechas del control remoto**. Ahí se configura:
  - la voz, su velocidad y el volumen, con botón para probarla;
  - las columnas y el tamaño de letra;
  - qué categorías muestra ese TV (por ejemplo, uno para la freidora y otro para bebidas);
  - el **botón «Listo»** en cada pedido (apágalo en un TV que nadie toca);
  - pantalla completa y cerrar sesión.

  Cada TV recuerda sus propios ajustes.
- Las salsas, adiciones e ingredientes se muestran como **pastillas que bajan de línea**: aunque un producto lleve todas las salsas, la tarjeta crece hacia abajo en vez de salirse.
- **Voz en español:** Microsoft Edge trae voces naturales de Colombia (Salomé, Gonzalo). Elígelas en el engranaje. En Chrome se usa la voz de Google en español.
- **Modo kiosco** (se abre solo, sin barras y con sonido sin tocar). Por ejemplo, en un mini PC conectado al TV:

  ```
  msedge --kiosk http://IP-DE-LA-CAJA:3000/cocina --autoplay-policy=no-user-gesture-required
  ```

- La cocina **nunca hace scroll**. Muestra todos los pedidos que caben, en orden de llegada. Si hay más, abajo aparece "+N en espera" con sus turnos. Los colores del cronómetro son:
  - verde: a tiempo;
  - amarillo: demorado (10 minutos por defecto);
  - rojo: atrasado (20 minutos por defecto).

  Los dos tiempos se cambian en Ajustes.

## Menú, fotos y ajustes (`/admin`)

- **Productos:** nombre, categoría y precio. Además:
  - **costo** (opcional, sirve para calcular ganancias; solo lo ve el administrador);
  - opciones con precio propio (Personal / Mediana / Familiar);
  - ingredientes por defecto;
  - si lleva salsas o adiciones;
  - destacado, y disponible o **agotado** (un interruptor).
- **Fotos:** arrastra, pega o elige la imagen. Se optimiza sola antes de subirse.
  - **Llenar**: la foto cubre toda la tarjeta.
  - **Completa**: para fotos recortadas sin fondo (PNG).

  Sin foto se muestra la ilustración que elijas.
- **Categorías** con foto o ilustración, en el orden que quieras. **Salsas** con su color. **Adiciones** con precio.
- **Ajustes:**
  - número de mesas y hora en que empieza la jornada;
  - valores rápidos de domicilio;
  - tiempos de la cocina;
  - **activar u ocultar la pantalla de turnos**, sus frases de voz y los mensajes de la cinta.
- **Usuarios:** cuentas del personal y equipos conectados (ver arriba).

## Datos y copias de seguridad

La base de datos vive en MySQL (contenedor `mysql` de `compose.yaml`, con su propio volumen `mysql_data`). Las fotos quedan en la carpeta **`data/uploads/`**.
Para hacer una copia de seguridad, ejecuta `npm run respaldo` con el sistema andando: guarda un volcado (`mysqldump`) en `data/respaldos/` y deja los últimos 30. Para pasar el sistema a otro servidor, copia el volumen `mysql_data` (o restaura el último respaldo) y la carpeta `data/uploads/`.

## Para desarrolladores

- **Servidor:** Node.js + Express 5 + MySQL (`mysql2`). El tiempo real va por Server‑Sent Events (`/api/stream`): cada cambio envía el estado de los pedidos activos **filtrado por rol** y el evento que lo causó (con quién lo hizo).
- **Cliente:** React 19 + TypeScript + Vite, con animaciones en `motion`. Las ilustraciones son SVG propias (`client/src/shared/components/Art.tsx`).
- `npm run dev` levanta el servidor con recarga en caliente en el mismo puerto. `npm run typecheck` revisa los tipos.
- Los precios siempre se recalculan en el servidor a partir del catálogo. Cada línea del pedido guarda una copia fija de nombre, categoría, precio y **costo unitario**, y modificaciones: los reportes históricos no cambian aunque luego se editen o borren productos.
- Los permisos viven en un solo lugar: `server/features/auth/permissions.js`. El cliente recibe la lista del usuario en `/api/auth/me` y la usa para mostrar u ocultar pantallas y botones.
- Seguridad: cookie de sesión `HttpOnly` + `SameSite=Lax` con token aleatorio (en la base solo se guarda su hash), cambios solo en JSON y desde el mismo origen (freno a CSRF), cabeceras `nosniff` / `X-Frame-Options`.

Variables de entorno del servidor: `PORT`, `SABOR_DATA` (carpeta de fotos), `PUBLIC_URL` (dirección pública), `TRUST_PROXY` (detrás de un proxy) y `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` (conexión a MySQL). Ver `server/core/net.js`, `server/core/db.js` y [DESPLIEGUE.md](DESPLIEGUE.md).

Arquitectura por **features**: cada carpeta agrupa sus rutas, servicios, pantallas y estilos.

```
server/
  index.js            arranque (Express, archivos estáticos, errores)
  api.js              une las rutas de cada feature
  core/               db.js (migraciones y respaldo) · events.js (SSE por usuario) · security.js · net.js · build.js
  features/
    auth/             permisos, contraseñas, sesiones, freno a intentos, /auth/*
    users/            gestión de usuarios y sesiones abiertas
    orders/           pedidos, estados, cobros y el feed en vivo filtrado por rol
    delivery/         despachar con repartidor, entregar, /delivery/mine
    catalog/          productos, categorías, salsas, adiciones y menú de ejemplo
    settings/         ajustes del negocio
    uploads/          fotos
  scripts/            reset-claves.js (recuperación del administrador) · respaldo.js (copia en caliente)

client/src/
  app/                App.tsx (sesión y enrutado) · routes.ts (pantallas y permisos)
  shared/             components (ui, Art, ItemMods, TvSettings, PasswordInput…) · lib (api, live, session, voz…) · styles · types.ts
  features/
    auth/             login, configuración inicial, cambio de contraseña, menú del usuario
    home/             inicio
    pos/              caja: menú, carrito, cobro
    orders/           tablero de pedidos y detalle
    accounting/       contabilidad (historial y cuadre)
    kitchen/          pantalla de cocina
    delivery/         pantalla del repartidor y ventana para despachar
    turns/            pantalla de turnos (oculta por defecto)
    admin/            Menú y ajustes (contenedor con pestañas)
    catalog/          productos, categorías, salsas, adiciones, fotos
    settings/         ajustes
    users/            usuarios y equipos conectados
```

### Base de datos

Las tablas `orders` y `order_items` guardan lo necesario para reportes de ganancias, productos más vendidos y gráficas por hora, día, medio de pago o repartidor:

- `business_day`, `created_at`, `ready_at`, `dispatched_at`, `delivered_at`, `paid_at`;
- `payment_method`, `total`, `delivery_fee`, `courier_id`, `created_by`, `paid_by`;
- `qty`, `unit_price`, `unit_cost`, `category_id`.

Los usuarios están en `users` y las sesiones en `sessions`. Las migraciones nuevas se agregan en `server/core/db.js`, en la lista `MIGRATIONS`.
