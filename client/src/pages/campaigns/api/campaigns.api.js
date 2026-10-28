import { request, qs } from '../../../api/client.js';

export const campaignsApi = {
  accounts: () => request('/accounts'), // connected inbox accounts
  quota: () => request('/campaigns/quota'),
  list: (params) => request('/campaigns?' + qs(params)),
  create: (body) => request('/campaigns', { method: 'POST', body }),
  recipients: (id, page = 1) => request(`/campaigns/${id}/recipients?page=${page}`),
  remove: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
  eligible: (step) => request(`/campaigns/followups/eligible?step=${step}`),
  createFollowUp: (body) => request('/campaigns/followups', { method: 'POST', body }),
};
