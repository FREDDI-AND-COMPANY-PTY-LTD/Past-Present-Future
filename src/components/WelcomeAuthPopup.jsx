import React from 'react';
import { ScrollText, ArrowRight, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Branded welcome overlay shown to unauthenticated visitors when the app
 * requires authentication. Instead of immediately redirecting to the hosted
 * login page, we greet the visitor with a "Log in or register" prompt and
 * only redirect on their action.
 */
export default function WelcomeAuthPopup({ onContinue }) {
  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      base44.auth.redirectToLogin(window.location.href);
    }
  };

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
          come together. Please log in or register to continue.
        </p>

        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Log In or Register
          <ArrowRight size={16} />
        </button>

        <div className="mt-6 flex items-start justify-center gap-2.5 text-left">
          <ShieldCheck size={16} className="text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-parchment/40 leading-relaxed">
            Your family's history stays private and yours. Only invited family
            members can access the archive.
          </p>
        </div>
      </div>
    </div>
  );
}