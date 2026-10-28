import { ZodError } from 'zod';
import { HttpError } from '../utils/http.js';

export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

export const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return res.status(400).json({ error: `${i.path.join('.') || 'input'}: ${i.message}` });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
