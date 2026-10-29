import { useState } from 'react';
import { LayoutDashboard, Mail, Send, UserPlus } from 'lucide-react';
import QuotaCard from './components/QuotaCard.jsx';
import DashboardTab from './components/DashboardTab.jsx';
import NewCampaignTab from './components/NewCampaignTab.jsx';
import FollowUpTab from './components/FollowUpTab.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'campaign', label: 'Campaign', icon: Send },
  { id: 'followups', label: 'Follow-ups', icon: UserPlus },
];

export default function Campaigns() {
  const [tab, setTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  // after a campaign or follow-up is created: back to the list, refresh the quota
  const created = () => { setRefreshKey((k) => k + 1); setTab('dashboard'); };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-blue-50/70 to-white">
      <div className="mx-auto max-w-8xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow"><Mail size={22} /></span>
            <div><h1 className="text-3xl font-bold text-blue-700">Campaign Manager</h1><p className="text-sm text-gray-600">Manage &amp; optimize your email campaigns</p></div>
          </div>
          <QuotaCard refreshKey={refreshKey} />
        </div>

        <div className="mt-6 flex gap-1 border-b border-sky-100">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="py-6">
          {tab === 'dashboard' && <DashboardTab refreshKey={refreshKey} />}
          {tab === 'campaign' && <NewCampaignTab onCreated={created} />}
          {tab === 'followups' && <FollowUpTab onCreated={created} />}
        </div>
      </div>
    </div>
  );
}
