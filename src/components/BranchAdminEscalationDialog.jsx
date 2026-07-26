import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Mic, MicOff, Send, Loader2, Check, LifeBuoy, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const CATEGORIES = [
  { key: 'stuck', label: "I'm stuck / jammed", hint: "Something in the app won't let me proceed and I can't work around it." },
  { key: 'ai_proposal', label: "AI proposal I can't resolve", hint: "The AI assistant proposed a change I'm not sure how to handle." },
  { key: 'data', label: 'Data or record issue', hint: 'A record, relationship, or upload looks wrong and I need help fixing it.' },
  { key: 'other', label: 'Other request', hint: 'Anything else you need the global admin to look at.' },
];

/**
 * Lets a branch admin escalate a request to the global admin — the oversight
 * capacity that acts as a backdoor into the archive for things the branch admin
 * can't resolve on their own (stuck workflows, unresolvable AI proposals, etc.).
 * Creates a ProblemReport tagged source: 'branch_admin_request'.
 */
export default function BranchAdminEscalationDialog({ open, onClose, branches, user }) {
  const [category, setCategory] = useState('stuck');
  const [branchId, setBranchId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');

  useEffect(() => {
    if (open && branches?.length && !branchId) setBranchId(branches[0].id);
    if (!open) {
      setCategory('stuck');
      setDescription('');
      setSubmitted(false);
    }
  }, [open]);

  const startListening = () => {
    if (!SpeechRecognition) return;
    baseTextRef.current = description;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      const base = baseTextRef.current;
      setDescription(base + (base && !base.endsWith(' ') ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const branch = (branches || []).find(b => b.id === branchId);
      const cat = CATEGORIES.find(c => c.key === category);
      await base44.entities.ProblemReport.create({
        title: `${cat?.label || 'Escalation'} — ${branch?.name || 'Branch'}`,
        description: description.trim(),
        source: 'branch_admin_request',
        branch_id: branch?.id || null,
        branch_name: branch?.name || null,
        status: 'open',
        priority: category === 'stuck' || category === 'ai_proposal' ? 'high' : 'medium',
        reported_by_id: user?.id || null,
        reported_by_name: user?.full_name || user?.email || 'Branch Admin',
      });
      setSubmitted(true);
    } catch (e) {
      // error
    }
    setSubmitting(false);
  };

  const handleOpenChange = (val) => {
    if (!val) onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#1A1614] border-[rgba(201,145,58,0.25)]">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-gold" />
            </div>
            <h2 className="font-display text-xl text-parchment mb-2">Escalation Sent</h2>
            <p className="text-parchment/50 text-sm mb-6">The global admin has been notified. They'll review your request and respond in your inbox.</p>
            <button onClick={() => handleOpenChange(false)}
              className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              Close
            </button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-parchment flex items-center gap-2">
                <LifeBuoy size={20} className="text-gold" />
                Escalate to Global Admin
              </DialogTitle>
              <DialogDescription className="text-parchment/50">
                The global admin is an oversight capacity — a backdoor into the archive for things you can't resolve on your own. Use this when you're stuck, jammed, or can't action an AI proposal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {(branches || []).length > 1 && (
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Branch</label>
                  <select value={branchId} onChange={e => setBranchId(e.target.value)}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm text-parchment/60 mb-2 block">What kind of request?</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${category === c.key ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/60 hover:border-[rgba(201,145,58,0.3)]'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-parchment/40 mt-2">{CATEGORIES.find(c => c.key === category)?.hint}</p>
              </div>

              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Describe the issue</label>
                <div className="relative">
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed resize-none"
                    placeholder="What's happening, what you've tried, and what you need the global admin to do..." />
                  {SpeechRecognition && (
                    <button type="button" onClick={listening ? stopListening : startListening}
                      className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${listening ? 'bg-[#C9913A] text-charcoal animate-pulse' : 'bg-[rgba(201,145,58,0.1)] text-gold border border-[rgba(201,145,58,0.2)] hover:bg-[rgba(201,145,58,0.2)]'}`}
                      title={listening ? 'Stop voice input' : 'Start voice input'}>
                      {listening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)]">
                <AlertTriangle size={14} className="text-amber-light mt-0.5 flex-shrink-0" />
                <p className="text-xs text-parchment/50">This reaches the global admin directly. For routine member questions, use the in-app comment or AI assistant first.</p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <button className="px-5 py-2.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/60 text-sm hover:text-parchment transition-colors">
                  Cancel
                </button>
              </DialogClose>
              <button onClick={handleSubmit} disabled={submitting || !description.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send to Global Admin
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}