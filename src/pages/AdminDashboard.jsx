import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ClipboardCheck, Lightbulb, Shield, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AdminProposals from '@/components/admin/AdminProposals';
import AdminActivityFeed from '@/components/admin/AdminActivityFeed';

// Disputes, escalations, duplicates, family links and edit requests all live in
// the unified Review queue now — this dashboard keeps the override-only controls.
const TOP_TABS = [
  { key: 'proposals', label: 'AI Proposals', icon: Lightbulb },
  { key: 'activity', label: 'Activity', icon: Activity },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('disputes');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState(null);

  const [logs, setLogs] = useState([]);
  const [proposalCount, setProposalCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    Promise.all([
      base44.entities.ActivityLog.list('-created_date', 50),
      base44.entities.Proposal.filter({ status: 'pending' }),
    ]).then(([lg, props]) => {
      setLogs(lg || []);
      setProposalCount((props || []).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey]);

  const topCounts = {
    proposals: proposalCount,
    activity: logs.length,
  };

  if (!loading && user && user.role !== 'admin') {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto text-center">
          <div className="aged-card rounded-xl p-10">
            <Shield size={32} className="text-gold/40 mx-auto mb-3" />
            <p className="text-parchment font-medium mb-1">Global admin only</p>
            <p className="text-parchment/50 text-sm mb-5">This is the override surface for the app developer. Day-to-day branch management lives in the Branch Admin dashboard.</p>
            <Link to="/" className="inline-flex items-center gap-1 text-amber-light hover:text-gold text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <Shield size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Global Admin — Override</h1>
            <p className="text-parchment/50 text-sm">The global admin steps in only when a branch admin escalates a problem they can't solve within their branch. All day-to-day controls — uploads, edits, duplicates, crop re-edit — belong to each branch's admin.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8 mb-4">
          {TOP_TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`aged-card rounded-xl p-4 text-left transition-all ${isActive ? 'border-[rgba(201,145,58,0.5)] gold-glow' : 'hover:border-[rgba(201,145,58,0.3)]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} className="text-gold flex-shrink-0" />
                  <span className="font-display text-2xl text-parchment leading-none">{topCounts[t.key]}</span>
                </div>
                <p className="text-xs text-parchment/60 leading-tight">{t.label}</p>
              </button>
            );
          })}
        </div>

        <Link to="/app/review"
          className="flex items-center gap-3 aged-card rounded-xl p-4 mb-8 hover:border-[rgba(201,145,58,0.4)] transition-colors">
          <ClipboardCheck size={18} className="text-gold flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-parchment font-medium">Open the Review queue</p>
            <p className="text-xs text-parchment/50">Disputes, escalations, duplicates, family links, edit requests and tagged comments are all reviewed there.</p>
          </div>
          <ArrowRight size={16} className="text-amber-light flex-shrink-0" />
        </Link>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="aged-card rounded-lg h-16 animate-pulse" />)}</div>
        ) : (
          <>
            {tab === 'proposals' && <AdminProposals refreshKey={refreshKey} />}
            {tab === 'activity' && <AdminActivityFeed logs={logs} />}
          </>
        )}
      </div>
    </Layout>
  );
}