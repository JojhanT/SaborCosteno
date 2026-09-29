import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../../core/db.js';
import { HttpError } from '../../core/http-error.js';
import { requirePermission } from '../auth/permissions.js';

export const uploadsRouter = express.Router();

uploadsRouter.post('/uploads', requirePermission('catalog.manage'), (req, res) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl ?? '');
  if (!match) throw new HttpError(400, 'La imagen debe ser PNG, JPG o WEBP');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 6_000_000) throw new HttpError(413, 'La imagen es demasiado pesada');
  const file = `${crypto.randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, file), buffer);
  res.status(201).json({ url: `/uploads/${file}` });
});
