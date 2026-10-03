import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pool, ROOT, UPLOADS_DIR, DATA_DIR } from './core/db.js';
import { lanUrls, PORT, PUBLIC_URL, trustProxy } from './core/net.js';
import { securityHeaders } from './core/security.js';
import { setupRequired } from './features/auth/auth.routes.js';
import { issueSetupCode } from './features/auth/setup-code.js';
import { getSettings } from './features/settings/settings.service.js';
import { api } from './api.js';

const dev = process.argv.includes('--dev');
const CLIENT_DIR = path.join(ROOT, 'client');
const DIST_DIR = path.join(CLIENT_DIR, 'dist');

const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');
// detrás de Caddy/nginx: IP real del cliente y HTTPS (ver TRUST_PROXY en server/core/net.js)
app.set('trust proxy', trustProxy());
app.use(securityHeaders);
app.use(express.json({ limit: '12mb' }));
app.use('/api', api);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(CLIENT_DIR, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error('\n  ✗ No se encontró la app compilada. Ejecuta primero:  npm run build\n');
    process.exit(1);
  }
  app.use(
    express.static(DIST_DIR, {
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  // un archivo de una versión anterior ya no existe: 404 real (no la página),
  // así la app detecta la actualización y se recarga en vez de quedar en blanco
  app.get(/^\/assets\//, (_req, res) => res.status(404).type('text/plain').send('No encontrado'));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : err.message });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ El puerto ${PORT} ya está en uso. ¿La app ya está abierta en otra ventana?\n`);
    process.exit(1);
  }
  throw err;
});

// Docker (o Ctrl+C) pide apagar: se cierra la base ordenadamente antes de salir
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    try {
      await pool.end();
    } catch {
      /* ya estaba cerrada */
    }
    process.exit(0);
  });
}

server.listen(PORT, '0.0.0.0', async () => {
  const lan = lanUrls();
  const line = '─'.repeat(58);
  console.log(`\n  ${line}`);
  console.log('   SABOR COSTEÑO ¡ajá!  ·  sistema de pedidos' + (dev ? '  (desarrollo)' : ''));
  console.log(`  ${line}`);
  if (PUBLIC_URL) console.log(`   Dirección        ${PUBLIC_URL}`);
  else {
    console.log(`   Este equipo      http://localhost:${PORT}`);
    for (const url of lan) console.log(`   Red local        ${url}`);
  }
  console.log('');
  console.log('   Caja             /caja');
  console.log('   Cocina (TV)      /cocina');
  console.log('   Repartidores     /reparto');
  if ((await getSettings()).turnsScreenEnabled) console.log('   Turnos (TV)      /turnos');
  console.log('   Administración   /admin');
  console.log(`   Datos            ${DATA_DIR}`);
  if (await setupRequired()) {
    console.log('\n   ⚠ Falta la cuenta del administrador. Ábrela en este equipo o, desde');
    console.log(`     otro, escribe el código de instalación:   ${await issueSetupCode()}`);
  }
  console.log(`  ${line}\n`);
});
