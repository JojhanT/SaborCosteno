import express from 'express';
import { HttpError } from '../../core/http-error.js';
import { broadcast } from '../../core/events.js';
import { can, requirePermission } from '../auth/permissions.js';
import { getCatalog, savers, archive, reorder } from './catalog.service.js';

export const catalogRouter = express.Router();

const requireCatalog = requirePermission('catalog.manage');

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador no válido');
  return id;
};

catalogRouter.get('/catalog', (req, res) => res.json(getCatalog({ withCost: can(req.user, 'catalog.manage') })));

for (const entity of Object.keys(savers)) {
  catalogRouter.post(`/${entity}/reorder`, requireCatalog, (req, res) => {
    reorder(entity, req.body?.ids);
    broadcast('catalog', {});
    res.json({ ok: true });
  });
  catalogRouter.post(`/${entity}`, requireCatalog, (req, res) => {
    const id = savers[entity](null, req.body ?? {});
    broadcast('catalog', {});
    res.status(201).json({ id });
  });
  catalogRouter.put(`/${entity}/:id`, requireCatalog, (req, res) => {
    const id = savers[entity](idParam(req), req.body ?? {});
    broadcast('catalog', {});
    res.json({ id });
  });
  catalogRouter.delete(`/${entity}/:id`, requireCatalog, (req, res) => {
    archive(entity, idParam(req));
    broadcast('catalog', {});
    res.json({ ok: true });
  });
}
