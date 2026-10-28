import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.userId = jwt.verify(token, config.jwtSecret).sub;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired session'));
  }
}
