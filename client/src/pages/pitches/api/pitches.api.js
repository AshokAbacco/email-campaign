// client/src/pages/pitches/api/pitches.api.js
import { Send, UserPlus } from 'lucide-react';
import { request, qs } from '../../../api/client.js';

// FRESH pitches are offered in New Campaign, FOLLOW_UP pitches in Follow-ups
export const PITCH_TYPES = [
  { id: 'FRESH', label: 'Fresh Mail', short: 'Fresh', hint: 'First email of a new campaign', icon: Send, badge: 'border-sky-200 bg-sky-50 text-sky-700' },
  { id: 'FOLLOW_UP', label: 'Follow-up', short: 'Follow-up', hint: 'Sent as a reply to an earlier campaign', icon: UserPlus, badge: 'border-violet-200 bg-violet-50 text-violet-700' },
];
export const pitchType = (id) => PITCH_TYPES.find((t) => t.id === id) || PITCH_TYPES[0];

export const pitchesApi = {
  list: (params = {}) => request('/pitches?' + qs(params)),
  get: (id) => request(`/pitches/${id}`),
  create: (body) => request('/pitches', { method: 'POST', body }),
  update: (id, body) => request(`/pitches/${id}`, { method: 'PUT', body }),
  remove: (id) => request(`/pitches/${id}`, { method: 'DELETE' }),
};