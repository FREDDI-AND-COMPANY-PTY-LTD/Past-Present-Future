import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Flag, Upload, Edit, Trash2, GitBranch, UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

const actionIcons = {
  upload: Upload,
  edit: Edit,
  delete: Trash2,
  branch_create: GitBranch,
  conflict_flag: Flag,
  registration: UserPlus,
  conflict_resolve: CheckCircle,
  approval: CheckCircle,
};

const statusBadges = {
  open: { label: 'Open', class: 'bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]' },
  resolved: { label: 'Resolved', class: 'bg-green-900/20 text-green-400 border-green-800/30' },
  dismissed: { label: 'Dismissed', class: 'bg-[rgba(245,236,215,0.05)] text-parchment/40 border-[rgba(245,236,215,0.1)]' },
};

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [tab, setTab] = useState('activity');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ActivityLog.list('-created_date', 50),
      base44.entities.ConflictFlag.filter({ status: 'open' }),
    ]).then(([lg, fl]) => {
      setLogs(lg || []);
      setFlags(fl || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const resolveFlag = async (flagId, resolution) => {
    try {
      await base44.entities.ConflictFlag.update(flagId, {
        status: resolution,
        resolution_note: resolution === 'resolved' ? 'Resolved by admin' : 'Dismissed by admin',
      });
      setFlags(flags.filter(f => f.id !== flagId));
    } catch (e) {}
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <Activity size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Admin Dashboard</h1>
            <p className="text-parchment/50 text-sm">Monitor activity and resolve conflicts across the archive</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Actions', value: logs.length, icon: Activity },
            { label: 'Uploads', value: logs.filter(l => l.action_type === 'upload').length, icon: Upload },
            { label: 'Open Flags', value: flags.length, icon: Flag },
            { label: 'Branches', value: logs.filter(l => l.action_type === 'branch_create').length, icon: GitBranch },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="aged-card rounded-xl p-5">
                <Icon size={20} className="text-gold/60 mb-2" />
                <p className="font-display text-3xl text-parchment">{stat.value}</p>
                <p className="text-xs text-parchment/40 mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('activity')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'activity' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Activity Log
          </button>
          <button onClick={() => setTab('flags')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'flags' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Conflict Flags {flags.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{flags.length}</span>}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="aged-card rounded-lg h-16 animate-pulse" />)}</div>
        ) : tab === 'activity' ? (
          <div className="aged-card rounded-2xl overflow-hidden">
            {logs.length > 0 ? (
              <div className="divide-y divide-[rgba(201,145,58,0.08)]">
                {logs.map(log => {
                  const Icon = actionIcons[log.action_type] || Activity;
                  return (
                    <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-[rgba(201,145,58,0.03)] transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(201,145,58,0.08)] flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment">{log.description}</p>
                        <div className="flex items-center gap-3 text-xs text-parchment/40 mt-0.5">
                          {log.user_name && <span>{log.user_name}</span>}
                          {log.created_date && <span>{new Date(log.created_date).toLocaleString('en-AU')}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-parchment/40 capitalize hidden sm:block px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.06)]">{log.action_type.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="p-8 text-center text-parchment/50 text-sm">No activity recorded yet.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {flags.length > 0 ? (
              flags.map(flag => (
                <div key={flag.id} className="aged-card rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Flag size={18} className="text-amber-light" />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadges[flag.status]?.class || statusBadges.open.class}`}>
                        {statusBadges[flag.status]?.label || 'Open'}
                      </span>
                      {flag.bloodline && <span className="text-xs text-parchment/40">{flag.bloodline}</span>}
                    </div>
                    <span className="text-xs text-parchment/40">{flag.created_date ? new Date(flag.created_date).toLocaleString('en-AU') : ''}</span>
                  </div>
                  <p className="text-sm text-parchment/70 mb-3">{flag.dispute_description}</p>
                  {flag.content_item_id && (
                    <Link to={`/content/${flag.content_item_id}`} className="text-xs text-amber-light hover:text-gold">View content item →</Link>
                  )}
                  {flag.status === 'open' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => resolveFlag(flag.id, 'resolved')} className="px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors flex items-center gap-1">
                        <CheckCircle size={14} /> Resolve
                      </button>
                      <button onClick={() => resolveFlag(flag.id, 'dismissed')} className="px-3 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors flex items-center gap-1">
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="aged-card rounded-xl p-12 text-center">
                <Flag size={32} className="text-gold/30 mx-auto mb-3" />
                <p className="text-parchment/50">No open conflict flags.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}