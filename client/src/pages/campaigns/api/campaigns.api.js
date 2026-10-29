// client/src/pages/campaigns/api/campaigns.api.js
import { request, qs } from '../../../api/client.js';

export const campaignsApi = {
  accounts: () => request('/accounts'), // connected inbox accounts
  folders: () => request('/folders'), // inbox account folders (grouping in the From list)
  accountUsage: () => request('/campaigns/account-usage'), // sent today / last hour per account + default limits
  quota: () => request('/campaigns/quota'),
  list: (params) => request('/campaigns?' + qs(params)),
  create: (body) => request('/campaigns', { method: 'POST', body }),
  recipients: (id, page = 1) => request(`/campaigns/${id}/recipients?page=${page}`),
  remove: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
  eligible: (step) => request(`/campaigns/followups/eligible?step=${step}`),
  createFollowUp: (body) => request('/campaigns/followups', { method: 'POST', body }),
  signature: (accountId) => request(`/campaigns/signature?accountId=${encodeURIComponent(accountId)}`), // auto-added signature
  followUpQuote: (id) => request(`/campaigns/${id}/followup-quote`), // earlier email(s) quoted under a follow-up
};