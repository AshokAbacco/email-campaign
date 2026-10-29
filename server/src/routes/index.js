// server/src/routes/index.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/auth.controller.js';
import * as acc from '../controllers/account.controller.js';
import * as fol from '../controllers/folder.controller.js';
import * as msg from '../controllers/message.controller.js';
import * as cmp from '../controllers/campaign.controller.js';
import * as pit from '../controllers/pitch.controller.js';

const r = Router();

r.post('/auth/register', auth.register);
r.post('/auth/login', auth.login);
r.get('/oauth/:p/callback', acc.oauthCallback); // public: provider redirect target (state is a signed JWT)

r.use(requireAuth);
r.get('/auth/me', auth.me);

r.post('/account-folders', fol.createFolder);
r.patch('/account-folders/:id', fol.updateFolder);
r.delete('/account-folders/:id', fol.deleteFolder);

r.get('/accounts', acc.listAccounts);
r.post('/accounts/imap', acc.connectImap);
r.get('/accounts/oauth/:provider/start', acc.oauthStart);
r.post('/accounts/:id/sync', acc.syncNow);
r.patch('/accounts/:id', acc.moveAccount);
r.delete('/accounts/:id', acc.disconnect);

r.get('/folders', msg.getFolders);
r.get('/messages', msg.listMessages);
r.get('/messages/search', msg.listMessages);
r.post('/messages/send', msg.send);
r.get('/messages/:id', msg.getMessage);
r.patch('/messages/:id', msg.updateFlags);
r.post('/messages/:id/archive', msg.archive);
r.post('/messages/:id/trash', msg.trash);
r.get('/messages/:id/attachments/:attId', msg.downloadAttachment);

r.get('/campaigns/quota', cmp.quota);
r.get('/campaigns/signature', cmp.signaturePreview);
r.get('/campaigns/account-usage', cmp.accountUsage);
r.get('/campaigns/followups/eligible', cmp.eligibleFollowUps);
r.post('/campaigns/followups', cmp.createFollowUp);
r.get('/campaigns', cmp.listCampaigns);
r.post('/campaigns', cmp.createCampaign);
r.get('/campaigns/:id/recipients', cmp.listRecipients);
r.get('/campaigns/:id/followup-quote', cmp.followUpQuotePreview);
r.delete('/campaigns/:id', cmp.deleteCampaign);

r.get('/pitches', pit.listPitches);
r.post('/pitches', pit.createPitch);
r.get('/pitches/:id', pit.getPitch);
r.put('/pitches/:id', pit.updatePitch);
r.delete('/pitches/:id', pit.deletePitch);

export default r;