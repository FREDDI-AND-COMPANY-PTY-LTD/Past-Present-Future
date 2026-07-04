import React, { useState, useEffect } from 'react';
import { Inbox, AlertCircle, Flag, Upload, Loader2, ShieldAlert, Brain } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AdminProblems from '@/components/admin/AdminProblems';
import AdminApprovals from '@/components/admin/AdminApprovals';
import AdminUploads from '@/components/admin/AdminUploads';
import AdminUncategorized from '@/components/admin/AdminUncategorized';

const TABS = [
  { key: 'problems', label: 'Inbox Problems', icon: AlertCircle },
  { key: 'approvals', label: 'Admin for Approval', icon: Flag },
  { key: 'uploads', label: 'Review Uploads', icon: Upload },
  { key: 'uncategorized', label: 'Uncategorized', icon: Brain },
];

export default function AdminInbox() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState('problems');
  const [refreshKey, setRefreshKey] = useState(0);
  const [counts, setCounts] = useState({ problems: 0, approvals: 0, uploads: 0, uncategorized: 0 });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    Promise.all([
      base44.entities.ProblemReport.filter({ status: 'open' }).catch(() => []),
      base44.entities.ConflictFlag.filter({ status: 'open' }).catch(() => []),
      base44.entities.ContentItem.list('-created_date', 50).catch(() => []),
      base44.entities.ContentItem.filter({ content_type: 'uncategorized' }).catch(() => []),
    ]).then(([probs, flags, items, uncategorized]) => {
      setCounts({
        problems: (probs || []).length,
        approvals: (flags || []).length,
        uploads: (items || []).filter(i => !i.review_status || i.review_status === 'pending').length,
        uncategorized: (uncategorized || []).length,
      });
    }).catch(() => {});
  }, [user, refreshKey]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="text-gold animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <ShieldAlert size={48} className="text-gold/50 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-parchment mb-2">Admin Access Required</h1>
          <p className="text-parchment/50 text-sm">You need administrator privileges to view the admin inbox.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Inbox size={28} className="text-gold" />
          <h1 className="font-display text-3xl text-parchment">Admin Inbox</h1>
        </div>
        <p className="text-parchment/50 text-sm mb-8">Collated administrative tasks awaiting your attention.</p>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {TABS.map(t => {
            const Icon = t.icon;
            const count = counts[t.key] || 0;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`aged-card rounded-xl p-5 text-left transition-all ${isActive ? 'border-[rgba(201,145,58,0.5)] gold-glow' : 'hover:border-[rgba(201,145,58,0.3)]'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={20} className="text-gold" />
                  <span className="font-display text-2xl text-parchment">{count}</span>
                </div>
                <p className="text-sm text-parchment/60">{t.label}</p>
              </button>
            );
          })}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-[rgba(201,145,58,0.15)]">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'text-gold border-[#C9913A]'
                    : 'text-parchment/50 border-transparent hover:text-parchment'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'problems' && <AdminProblems refreshKey={refreshKey} />}
        {tab === 'approvals' && <AdminApprovals refreshKey={refreshKey} />}
        {tab === 'uploads' && <AdminUploads refreshKey={refreshKey} />}
        {tab === 'uncategorized' && <AdminUncategorized refreshKey={refreshKey} />}
      </div>
    </Layout>
  );
}