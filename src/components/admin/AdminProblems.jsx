import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Check, Clock, User, Sparkles, LifeBuoy } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const actionFromDesc = (desc) => {
  const m = (desc || '').match(/Suggested action:\s*(\/[^\s\n]+)/);
  return m ? m[1] : null;
};

const sourceBadge = {
  branch_admin_request: { label: 'Branch Escalation', icon: LifeBuoy, color: 'text-amber-light', bg: 'bg-[rgba(201,145,58,0.12)]', border: 'border-[rgba(201,145,58,0.25)]' },
  ai_handoff: { label: 'AI Handoff', icon: Sparkles, color: 'text-amber-light', bg: 'bg-[rgba(201,145,58,0.12)]', border: 'border-[rgba(201,145,58,0.25)]' },
  user_report: { label: 'User Report', icon: AlertCircle, color: 'text-parchment/50', bg: 'bg-[rgba(245,236,215,0.05)]', border: 'border-[rgba(245,236,215,0.1)]' },
};

const resolveSource = (problem) => {
  if (problem.source) return problem.source;
  if (String(problem.title || '').startsWith('AI Handoff:')) return 'ai_handoff';
  return 'user_report';
};

const statusConfig = {
  open: { label: 'Open', color: 'text-amber-light', bg: 'bg-[rgba(201,145,58,0.12)]', border: 'border-[rgba(201,145,58,0.25)]' },
  in_progress: { label: 'In Progress', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
  resolved: { label: 'Resolved', color: 'text-green-300', bg: 'bg-green-500/10', border: 'border-green-500/25' },
};

export default function AdminProblems({ refreshKey }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [responses, setResponses] = useState({});

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ProblemReport.list('-created_date', 50);
      setProblems(data || []);
    } catch (e) {
      // error
    }
    setLoading(false);
  };

  useEffect(() => { fetchProblems(); }, [refreshKey]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await base44.entities.ProblemReport.update(id, {
        status,
        admin_response: responses[id] || undefined,
      });
      setProblems(prev => prev.map(p => p.id === id ? { ...p, status, admin_response: responses[id] || p.admin_response } : p));
      setResponses(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      // error
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-gold animate-spin" />
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Check size={32} className="text-gold/50 mx-auto mb-3" />
        <p className="text-parchment/50">No problem reports. All clear.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {problems.map(problem => {
        const cfg = statusConfig[problem.status] || statusConfig.open;
        return (
          <div key={problem.id} className="aged-card rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg text-parchment">{problem.title}</h3>
                  {(() => {
                    const src = resolveSource(problem);
                    const badge = sourceBadge[src] || sourceBadge.user_report;
                    const BadgeIcon = badge.icon;
                    return (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.bg} ${badge.color} ${badge.border} border font-medium flex items-center gap-1`}>
                        <BadgeIcon size={9} /> {badge.label}
                      </span>
                    );
                  })()}
                  {problem.branch_name && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.06)] text-parchment/50 border border-[rgba(201,145,58,0.12)]">
                      {problem.branch_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-parchment/60 mt-1 whitespace-pre-wrap">{problem.description}</p>
                {actionFromDesc(problem.description) && (
                  <Link to={actionFromDesc(problem.description)} className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold transition-colors">
                    Open suggested action →
                  </Link>
                )}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border whitespace-nowrap`}>
                {cfg.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-parchment/40 mb-3">
              {problem.reported_by_name && (
                <span className="flex items-center gap-1">
                  <User size={12} /> {problem.reported_by_name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(problem.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {problem.admin_response && (
              <div className="mb-3 p-3 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)]">
                <p className="text-xs text-parchment/40 mb-1">Admin response:</p>
                <p className="text-sm text-parchment/70">{problem.admin_response}</p>
              </div>
            )}

            {problem.status !== 'resolved' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={responses[problem.id] || ''}
                  onChange={e => setResponses(prev => ({ ...prev, [problem.id]: e.target.value }))}
                  placeholder="Add a response note (optional)"
                  className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                />
                <div className="flex gap-2">
                  {problem.status === 'open' && (
                    <button
                      onClick={() => updateStatus(problem.id, 'in_progress')}
                      disabled={updating === problem.id}
                      className="px-3 py-2 rounded-lg text-xs bg-blue-500/10 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(problem.id, 'resolved')}
                    disabled={updating === problem.id}
                    className="px-3 py-2 rounded-lg text-xs bg-green-500/10 text-green-300 border border-green-500/25 hover:bg-green-500/20 transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    {updating === problem.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Resolve
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}