import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, X, ArrowRight } from 'lucide-react';
import { getBranchAdminExplainer } from '@/lib/branchAdminExplainer';
import BranchCloudBackupSetup from '@/components/BranchCloudBackupSetup';

// One-time in-app overlay shown at branch claim time explaining the branch-admin
// role and how the branch functions. A matching email is sent alongside it.
export default function BranchAdminOnboardingIntro({ branch, user, onClose }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const e = getBranchAdminExplainer(branch?.name || 'your branch', user?.full_name, appUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">You're a Branch Admin</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-parchment/80 text-sm">{e.greeting}</p>
          <p className="text-parchment text-sm leading-relaxed">
            You're now the <span className="text-gold font-medium">Branch Admin</span> for{' '}
            <span className="font-medium">{e.branchName}</span>. As the sole authority over this branch, you can:
          </p>

          <ul className="space-y-2">
            {e.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-parchment/70">
                <Check size={14} className="text-gold mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <p className="text-parchment/60 text-xs leading-relaxed">{e.closing}</p>

          <div className="rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.15)] p-4">
            <BranchCloudBackupSetup
              branch={branch}
              compact
              onSaved={(updated) => {
                if (onClose) onClose();
              }}
            />
          </div>

          <p className="text-xs text-parchment/50">
            Your <span className="text-amber-light">Branch Admin dashboard</span> (sidebar &rarr; Branch Admin) is where you manage nominations, invitations, and branch-scoped review queues.
          </p>

          <div className="pt-3 border-t border-[rgba(201,145,58,0.12)] flex items-center justify-between gap-2">
            <Link to={e.dashboardPath} onClick={onClose} className="flex items-center gap-1.5 text-sm text-gold hover:text-amber-light transition-colors">
              Open Branch Admin <ArrowRight size={14} />
            </Link>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}