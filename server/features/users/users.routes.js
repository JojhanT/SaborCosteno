import express from 'express';
import { HttpError } from '../../core/http-error.js';
import { connectedSessions } from '../../core/events.js';
import { requirePermission } from '../auth/permissions.js';
import { activeSessions, revokeSessions, revokeUserSessions } from '../auth/sessions.js';
import { createUser, getUserRow, listUsers, resetPassword, updateUser } from './users.service.js';

export const usersRouter = express.Router();
usersRouter.use(['/users', '/sessions'], requirePermission('users.manage'));

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador no válido');
  return id;
};

usersRouter.get('/users', async (req, res) => {
  const online = connectedSessions();
  res.json({
    users: await listUsers(),
    sessions: (await activeSessions()).map((s) => ({ ...s, online: online.has(s.id), current: s.id === req.session.id })),
  });
});

usersRouter.post('/users', async (req, res) => {
  const id = await createUser(req.body ?? {});
  res.status(201).json({ id });
});

usersRouter.put('/users/:id', async (req, res) => {
  const id = await updateUser(idParam(req), req.body ?? {}, req.user);
  res.json({ id });
});

usersRouter.post('/users/:id/password', async (req, res) => {
  const id = idParam(req);
  if (id === req.user.id) throw new HttpError(400, 'Para tu propia contraseña usa “Cambiar mi contraseña”');
  await resetPassword(id, req.body ?? {});
  res.json({ ok: true });
});

/** Cierra la sesión del usuario en todos sus equipos. */
usersRouter.post('/users/:id/logout', async (req, res) => {
  const row = await getUserRow(idParam(req));
  const closed = await revokeUserSessions(row.id, row.id === req.user.id ? req.session.id : null);
  res.json({ ok: true, closed });
});

usersRouter.delete('/sessions/:id', async (req, res) => {
  await revokeSessions([String(req.params.id)]);
  res.json({ ok: true });
});
