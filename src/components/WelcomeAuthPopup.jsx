import React from 'react';
import { ScrollText, ArrowRight, UserPlus, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Branded welcome overlay shown to unauthenticated visitors.
 * The archive is private — no content is visible until the visitor logs in
 * or registers. Both buttons navigate to the in-app auth routes.
 */
export default function WelcomeAuthPopup() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal animate-fade-in">
      {/* Soft gold radial backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(201,145,58,0.12) 0%, rgba(13,11,10,0) 60%)',
        }}
      />

      <div className="relative w-full max-w-md aged-card rounded-2xl p-8 text-center animate-fade-in-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(201,145,58,0.3)] bg-[rgba(201,145,58,0.08)] gold-glow">
          <ScrollText size={30} className="text-gold" />
        </div>

        <h1 className="font-display text-2xl text-parchment mb-2">
          The Freddi Family Archive
        </h1>
        <p className="text-sm text-parchment/60 leading-relaxed mb-6">
          A private family history platform where Present, Past, and Future
          come together. This archive is private — please log in or register
          to continue.
        </p>

        <button
          onClick={() => navigate('/login')}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity mb-3"
        >
          Log In
          <ArrowRight size={16} />
        </button>

        <button
          onClick={() => navigate('/register')}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-[rgba(201,145,58,0.4)] text-amber-light text-sm font-semibold hover:bg-[rgba(201,145,58,0.08)] transition-colors"
        >
          <UserPlus size={16} />
          Register
        </button>

        <div className="mt-6 flex items-start justify-center gap-2.5 text-left">
          <ShieldCheck size={16} className="text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-parchment/40 leading-relaxed">
            Your family's history stays private and yours. Only invited family
            members can register and access the archive.
          </p>
        </div>
      </div>
    </div>
  );
}