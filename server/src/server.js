import app from './app.js';
import { config } from './config/env.js';
import { startCampaignWorker } from './services/campaignSender.js';

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
app.listen(config.port, () => {
  console.log(`API running on ${config.backendUrl}`);
  startCampaignWorker();
});