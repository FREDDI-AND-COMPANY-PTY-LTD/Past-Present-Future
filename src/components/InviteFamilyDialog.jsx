import React, { useState, useEffect } from 'react';
import { X, UserPlus, Send, Loader2, Check, AlertCircle, Mail, Rocket, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function InviteFamilyDialog({ open, onClose, stats }) {
  const [emails, setEmails] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [inviting, setInviting] = useState(false);
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!open) return null;

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
    for (const part of parts) {
      if (validateEmail(part) && !emails.includes(part)) {
        setEmails(prev => [...prev, part]);
      }
    }
    setEmailInput('');
  };

  const removeEmail = (email) => setEmails(prev => prev.filter(e => e !== email));

  const sendInvites = async () => {
    if (emails.length === 0) return;
    setInviting(true);
    setResults([]);
    const newResults = [];
    const appUrl = window.location.origin;
    const adminName = user?.full_name || 'Your Family Administrator';
    const defaultMessage = personalMessage || `You've been invited to join our private family history archive. Register now to explore the family tree, timeline, and map — and become your own ancestor.`;
    const emailBody = `Dear Family Member,

${defaultMessage}

To get started:
1. Register here: ${appUrl}/register
2. Enter your email and create a password
3. Follow the prompts to "Become Your Own Ancestor" — link your profile to your place in the family tree

We look forward to preserving our family's history together.

Warm regards,
${adminName}
Freddi Family Archive`;

    for (const email of emails) {
      try {
        await base44.users.inviteUser(email, 'user');
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: 'You\'re Invited — Join the Freddi Family Archive',
          body: emailBody,
          from_name: adminName,
        }).catch(() => {});
        newResults.push({ email, status: 'success' });
      } catch (e) {
        newResults.push({ email, status: 'failed', error: e.message || 'Unknown error' });
      }
      setResults([...newResults]);
    }
    setInviting(false);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const allDone = results.length > 0 && results.length === emails.length;

  return (
    <div className="fixed inset-0 z-50 bg-charcoal flex items-center justify-center p-4">
      <div className="aged-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">You're Going Live!</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Review summary */}
          {stats && (stats.confirmed > 0 || stats.flagged > 0) && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)]">
              <div className="flex items-center gap-1.5 text-sm text-green-400"><Check size={14} /> {stats.confirmed} confirmed</div>
              <div className="flex items-center gap-1.5 text-sm text-amber-light"><AlertCircle size={14} /> {stats.flagged} flagged for review</div>
            </div>
          )}

          {!allDone ? (
            <>
              <p className="text-sm text-parchment/60">
                Your archive is now live! Invite family members to register and become their own ancestor. Enter their email addresses below — invitations will be sent from your linked admin account.
              </p>

              {/* Email input */}
              <div>
                <label className="text-sm text-parchment/60 mb-1.5 block flex items-center gap-1.5">
                  <Mail size={14} /> Family Member Email Addresses
                </label>
                <div className="flex gap-2">
                  <input
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="Type email and press Enter (or comma-separated)..."
                  />
                  <button onClick={addEmail} className="px-4 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0">
                    Add
                  </button>
                </div>
                {emails.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {emails.map(email => (
                      <span key={email} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                        {email}
                        <button onClick={() => removeEmail(email)} className="text-parchment/30 hover:text-parchment"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Personal message */}
              <div>
                <label className="text-sm text-parchment/60 mb-1.5 block">Personal Message (optional)</label>
                <textarea
                  value={personalMessage}
                  onChange={e => setPersonalMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                  placeholder="Add a personal note to include in the invitation email..."
                />
              </div>

              {/* Send button */}
              <button
                onClick={sendInvites}
                disabled={inviting || emails.length === 0}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {inviting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {inviting ? 'Sending Invitations...' : `Send ${emails.length} Invitation${emails.length !== 1 ? 's' : ''}`}
              </button>

              {/* Live results */}
              {results.length > 0 && !allDone && (
                <div className="space-y-1.5">
                  {results.map(r => (
                    <div key={r.email} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${r.status === 'success' ? 'bg-green-500/5 text-green-400' : 'bg-red-500/5 text-red-400'}`}>
                      {r.status === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                      <span className="flex-1">{r.email}</span>
                      <span className="text-xs">{r.status === 'success' ? 'Invited' : 'Failed'}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full text-center text-sm text-parchment/40 hover:text-parchment/60 transition-colors py-2">
                Skip for now
              </button>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-gold" />
              </div>
              <h4 className="font-display text-xl text-parchment mb-2">Invitations Sent!</h4>
              <p className="text-parchment/50 text-sm mb-4">
                {successCount} of {emails.length} family member{emails.length !== 1 ? 's' : ''} successfully invited. They'll receive an email with a link to register and become their own ancestor.
              </p>
              {successCount < emails.length && (
                <p className="text-xs text-red-400/70 mb-4">{emails.length - successCount} invitation(s) failed. You can retry these later.</p>
              )}
              <button onClick={onClose} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity mx-auto">
                <Sparkles size={16} /> Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}