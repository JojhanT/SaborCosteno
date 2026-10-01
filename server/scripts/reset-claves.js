// Recuperación del administrador: desconecta todos los equipos y permite crear
// (o restablecer) la cuenta del administrador desde el PC donde está instalado
// el sistema, o desde otro equipo con el código que se muestra aquí.
// No borra pedidos, menú, fotos ni los demás usuarios.
import { pool } from '../core/db.js';
import { startRecovery } from '../features/auth/auth.routes.js';

const code = await startRecovery();
await pool.end();
console.log('\n  ✓ Equipos desconectados y modo de recuperación activado.');
console.log('    En el computador del sistema abre http://localhost:3000, o desde');
console.log('    cualquier equipo entra a la dirección de la app + /recuperar');
console.log(`    y escribe el código de instalación:   ${code}`);
console.log('    Si escribes un usuario que ya existe, se vuelve administrador');
console.log('    con la contraseña nueva.\n');
process.exit(0);
