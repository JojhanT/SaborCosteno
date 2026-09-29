import express from 'express';
import { broadcast } from '../../core/events.js';
import { requirePermission } from '../auth/permissions.js';
import { publicSettings, updateSettings } from './settings.service.js';

export const settingsRouter = express.Router();

settingsRouter.get('/settings', (_req, res) => res.json(publicSettings()));

settingsRouter.put('/settings', requirePermission('settings.manage'), (req, res) => {
  updateSettings(req.body);
  broadcast('settings', {});
  res.json(publicSettings());
});
