// server/src/controllers/pitch.controller.js
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const PITCH_TYPES = ['FRESH', 'FOLLOW_UP'];
const TYPE_LABEL = { FRESH: 'Fresh Mail', FOLLOW_UP: 'Follow-up' };

const hasContent = (html) => !!html.replace(/<[^>]*>|&nbsp;/g, '').trim() || /<img/i.test(html);

const schema = z.object({
  name: z.string().trim().min(1, 'Pitch name is required').max(120),
  type: z.enum(PITCH_TYPES, { errorMap: () => ({ message: 'Choose the pitch type' }) }),
  bodyHtml: z.string().max(2_000_000).refine(hasContent, 'Write the pitch email content'),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(PITCH_TYPES).optional(),
});

const dupe = (e) => {
  if (e.code === 'P2002') throw new HttpError(409, 'A pitch with this name already exists');
  throw e;
};

const select = {
  id: true, name: true, type: true, bodyHtml: true, createdAt: true, updatedAt: true,
  _count: { select: { campaigns: true } },
};
const shape = ({ _count, ...p }) => ({ ...p, campaignsCount: _count.campaigns });

export const listPitches = asyncHandler(async (req, res) => {
  const { q, type } = listQuery.parse(req.query);
  const where = { userId: req.userId };
  if (type) where.type = type;
  if (q) where.name = { contains: q, mode: 'insensitive' };
  const [rows, grouped] = await Promise.all([
    prisma.pitch.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 500, select }),
    prisma.pitch.groupBy({ by: ['type'], where: { userId: req.userId }, _count: { _all: true } }),
  ]);
  const counts = { FRESH: 0, FOLLOW_UP: 0 };
  for (const g of grouped) counts[g.type] = g._count._all;
  res.json({ items: rows.map(shape), counts });
});

export const getPitch = asyncHandler(async (req, res) => {
  const p = await prisma.pitch.findFirst({ where: { id: req.params.id, userId: req.userId }, select });
  if (!p) throw new HttpError(404, 'Pitch not found');
  res.json({ pitch: shape(p) });
});

export const createPitch = asyncHandler(async (req, res) => {
  const d = schema.parse(req.body);
  const p = await prisma.pitch.create({ data: { userId: req.userId, ...d }, select }).catch(dupe);
  res.status(201).json({ pitch: shape(p) });
});

export const updatePitch = asyncHandler(async (req, res) => {
  const d = schema.parse(req.body);
  const r = await prisma.pitch.updateMany({ where: { id: req.params.id, userId: req.userId }, data: d }).catch(dupe);
  if (!r.count) throw new HttpError(404, 'Pitch not found');
  const p = await prisma.pitch.findUnique({ where: { id: req.params.id }, select });
  res.json({ pitch: shape(p) });
});

// Campaigns keep their own copy of the content, so deleting a pitch never changes what they send
export const deletePitch = asyncHandler(async (req, res) => {
  const { count } = await prisma.pitch.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (!count) throw new HttpError(404, 'Pitch not found');
  res.json({ ok: true });
});

// Shared helper for campaign / follow-up creation: the pitch must belong to the user and be of the right type
export async function findUserPitch(userId, pitchId, type) {
  if (!pitchId) return null;
  const p = await prisma.pitch.findFirst({ where: { id: pitchId, userId }, select: { id: true, name: true, type: true, bodyHtml: true } });
  if (!p) throw new HttpError(400, 'The selected pitch no longer exists');
  if (type && p.type !== type) throw new HttpError(400, `Select a ${TYPE_LABEL[type]} pitch`);
  return p;
}