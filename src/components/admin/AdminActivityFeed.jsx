import React from 'react';
import { Activity, Upload, Edit, Trash2, GitBranch, Flag, UserPlus, CheckCircle } from 'lucide-react';

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

export default function AdminActivityFeed({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <Activity size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="aged-card rounded-2xl overflow-hidden">
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
    </div>
  );
}