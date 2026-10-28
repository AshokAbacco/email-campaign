import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(80).optional(),
});
const sign = (u) => jwt.sign({ sub: u.id }, config.jwtSecret, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, email: u.email, name: u.name });

export const register = asyncHandler(async (req, res) => {
  const d = schema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new HttpError(409, 'Email already registered');
  const user = await prisma.user.create({
    data: { email: d.email, name: d.name || d.email.split('@')[0], passwordHash: await bcrypt.hash(d.password, 12) },
  });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

export const login = asyncHandler(async (req, res) => {
  const d = schema.pick({ email: true }).extend({ password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: d.email } });
  if (!user || !(await bcrypt.compare(d.password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: sign(user), user: pub(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(401, 'User not found');
  res.json({ user: pub(user) });
});
