// TODO (go-to-market): Implement the full dispute resolution process — a mediated resolution
// workflow between bloodlines, formal branch-admin authority review, and an appeals escalation
// ladder. The category intake below is the reporting structure; the resolution process itself
// is to be designed before public launch.
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Mic, MicOff, Send, Loader2, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const CATEGORY_OPTIONS = [
  { value: 'general_problem', label: 'General Problem' },
  { value: 'dispute_between_bloodlines', label: 'Dispute Between Bloodlines' },
  { value: 'dispute_branch_authority', label: 'Branch Admin Authority' },
  { value: 'appeal_global_admin', label: 'Appeal to Global Admin' },
];

export default function ReportProblemDialog({ children }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('general_problem');
  const [connectedBranchId, setConnectedBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');

  useEffect(() => { base44.entities.Branch.list().then(setBranches).catch(() => {}); }, []);

  const startListening = () => {
    if (!SpeechRecognition) return;
    baseTextRef.current = description;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
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

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('general_problem');
    setConnectedBranchId('');
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      await base44.entities.ProblemReport.create({
        title: title.trim() || 'Reported Problem',
        description: description.trim(),
        category,
        connected_branch_id: category === 'dispute_between_bloodlines' ? (connectedBranchId || null) : null,
        connected_branch_name: (category === 'dispute_between_bloodlines' && connectedBranchId) ? ((branches.find(b => b.id === connectedBranchId)?.name) || '') : null,
        status: 'open',
        reported_by_id: user?.id || null,
        reported_by_name: user?.full_name || user?.email || 'Anonymous',
      });
      setSubmitted(true);
      setTitle('');
      setDescription('');
      setCategory('general_problem');
      setConnectedBranchId('');
    } catch (e) {
      // error
    }
    setSubmitting(false);
  };

  const handleOpenChange = (val) => {
    setOpen(val);
    if (!val) setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="bg-[#1A1614] border-[rgba(201,145,58,0.25)]">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-gold" />
            </div>
            <h2 className="font-display text-xl text-parchment mb-2">Problem Reported</h2>
            <p className="text-parchment/50 text-sm mb-6">Thank you — an administrator will review your report shortly.</p>
            <button
              onClick={() => handleOpenChange(false)}
              className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-parchment flex items-center gap-2">
                <AlertCircle size={20} className="text-gold" />
                Report a Problem
              </DialogTitle>
              <DialogDescription className="text-parchment/50">
                Describe the issue you're experiencing and an administrator will look into it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Report Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setCategory(o.value)}
                      className={`px-3 py-2 rounded-lg text-xs border text-left transition-all ${category === o.value ? 'bg-[rgba(201,145,58,0.1)] border-[#C9913A] text-gold' : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {category === 'dispute_between_bloodlines' && branches.length > 0 && (
                  <select value={connectedBranchId} onChange={e => setConnectedBranchId(e.target.value)}
                    className="mt-2 w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]">
                    <option value="">Connected branch (optional)...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                {category === 'appeal_global_admin' && (
                  <p className="mt-2 text-xs text-amber-light/70 bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] rounded-lg p-3">Your appeal will be routed to the Global Admin of the family complex for review.</p>
                )}
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Title (optional)</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Brief summary of the problem"
                />
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Description</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={5}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed resize-none"
                    placeholder="Describe what happened, what you expected, and what you saw..."
                  />
                  {SpeechRecognition && (
                    <button
                      type="button"
                      onClick={listening ? stopListening : startListening}
                      className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${
                        listening
                          ? 'bg-[#C9913A] text-charcoal animate-pulse'
                          : 'bg-[rgba(201,145,58,0.1)] text-gold border border-[rgba(201,145,58,0.2)] hover:bg-[rgba(201,145,58,0.2)]'
                      }`}
                      title={listening ? 'Stop voice input' : 'Start voice input'}
                    >
                      {listening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                </div>
                {SpeechSupported && (
                  <p className="text-xs text-parchment/30 mt-1.5 flex items-center gap-1">
                    <Mic size={11} />
                    {listening ? 'Listening...' : 'Tap the mic to dictate'}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <button className="px-5 py-2.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/60 text-sm hover:text-parchment transition-colors">
                  Cancel
                </button>
              </DialogClose>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Report
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SpeechSupported = SpeechRecognition !== null;