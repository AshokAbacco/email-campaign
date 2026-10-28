import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const COLORS = ['emerald', 'sky', 'violet', 'orange', 'rose', 'teal', 'indigo', 'amber', 'slate'];
const schema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(40),
  color: z.enum(COLORS).default('emerald'),
});

const dupe = (e) => {
  if (e.code === 'P2002') throw new HttpError(409, 'A folder with this name already exists');
  throw e;
};

export const createFolder = asyncHandler(async (req, res) => {
  const d = schema.parse(req.body);
  const folder = await prisma.accountFolder.create({ data: { userId: req.userId, ...d } }).catch(dupe);
  res.status(201).json({ folder });
});

export const updateFolder = asyncHandler(async (req, res) => {
  const d = schema.parse(req.body);
  const r = await prisma.accountFolder.updateMany({ where: { id: req.params.id, userId: req.userId }, data: d }).catch(dupe);
  if (!r.count) throw new HttpError(404, 'Folder not found');
  res.json({ ok: true });
});

export const deleteFolder = asyncHandler(async (req, res) => {
  const f = await prisma.accountFolder.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: { id: true, _count: { select: { accounts: true } } },
  });
  if (!f) throw new HttpError(404, 'Folder not found');
  if (f._count.accounts > 0) {
    throw new HttpError(409, `This folder still has ${f._count.accounts} account(s). Move or disconnect them first.`);
  }
  await prisma.accountFolder.delete({ where: { id: f.id } });
  res.json({ ok: true });
});