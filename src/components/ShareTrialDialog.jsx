import React, { useState } from 'react';
import { X, Loader2, Copy, Check, Send, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ShareTrialDialog({ open, onClose, user }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const reset = () => { setEmail(''); setName(''); setNote(''); setError(''); setResult(null); setCopied(false); };
  const handleClose = () => { reset(); onClose(); };

  const create = async () => {
    setError('');
    if (!email.trim()) { setError('Viewer email is required.'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('createGuestTrial', {
        viewer_email: email.trim(),
        viewer_name: name.trim(),
        note: note.trim(),
      });
      const d = res.data || res;
      if (d.error) { setError(d.error); }
      else {
        const url = `${window.location.origin}/trial/${d.token}`;
        setResult({ url, email: d.viewer_email, expires_at: d.expires_at });
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not create trial.');
    }
    setBusy(false);
  };

  const copy = () => {
    navigator.clipboard?.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-[#1A1614] border border-[rgba(201,145,58,0.25)] rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,145,58,0.15)]">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gold" />
            <h2 className="font-display text-xl text-parchment">Share 14-Day Trial</h2>
          </div>
          <button onClick={handleClose} className="text-parchment/60 hover:text-parchment"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-parchment/60">Create a read-only trial link for a guest. No account needed — they open the link and browse the whole archive for 14 days.</p>
              <div>
                <label className="text-xs text-amber-light uppercase tracking-wider">Viewer email *</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="guest@example.com"
                  className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div>
                <label className="text-xs text-amber-light uppercase tracking-wider">Viewer name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div>
                <label className="text-xs text-amber-light uppercase tracking-wider">Note (optional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button onClick={create} disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Create trial link
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-sm"><Check size={16} /> Trial created for {result.email}</div>
              <div>
                <label className="text-xs text-amber-light uppercase tracking-wider">Share link (valid 14 days)</label>
                <div className="flex gap-2 mt-1">
                  <input readOnly value={result.url} className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-amber-light font-mono" />
                  <button onClick={copy} className="flex items-center gap-1.5 px-4 rounded-lg bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.3)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.2)]">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-parchment/40 mt-2">Expires {new Date(result.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}. The guest needs no account — the link is their automatic pass.</p>
              </div>
              <button onClick={reset} className="text-sm text-amber-light hover:underline">Create another</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}