import express from 'express';
import { broadcast } from '../../core/events.js';
import { requirePermission } from '../auth/permissions.js';
import { publicSettings, updateSettings } from './settings.service.js';

export const settingsRouter = express.Router();

settingsRouter.get('/settings', async (_req, res) => res.json(await publicSettings()));

settingsRouter.put('/settings', requirePermission('settings.manage'), async (req, res) => {
  await updateSettings(req.body);
  broadcast('settings', {});
  res.json(await publicSettings());
});
