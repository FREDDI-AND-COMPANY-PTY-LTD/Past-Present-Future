import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ClipboardCheck, Copy, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import ReviewToolbar from '@/components/review/ReviewToolbar';
import ReviewStateTabs from '@/components/review/ReviewStateTabs';
import ReviewCard from '@/components/review/ReviewCard';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { sortItems } from '@/lib/reviewMeta';

const ACTION_TITLES = {
  resolve: 'Resolved',
  dismiss: 'Dismissed',
  later: 'Moved to Later',
  reopen: 'Moved back to Open',
};

export default function Review() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [branchNames, setBranchNames] = useState([]);
  const [access, setAccess] = useState('checking');
  const [scope, setScope] = useState('branch');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [sort, setSort] = useState('confidence');
  const [focused, setFocused] = useState(0);
  const [dismissFor, setDismissFor] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const { items, counts, loading, error, reload, removeItem } = useReviewQueue({
    scope,
    type,
    status,
    enabled: access === 'allowed',
  });

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      if (!me) { setAccess('denied'); return; }
      const branches = await base44.entities.Branch.list().catch(() => []);
      const mine = (branches || []).filter((b) => b.admin_user_id && b.admin_user_id === me.id);
      setBranchNames(mine.map((b) => b.name));
      const isBranchAdmin = mine.length > 0 || (me.data?.admin_branch_ids || []).length > 0;
      setAccess(me.role === 'admin' || isBranchAdmin ? 'allowed' : 'denied');
    })();
  }, []);

  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);
  const branchLabel = branchNames[0] || 'my branch';

  useEffect(() => {
    setFocused(0);
    setDismissFor(null);
    setSelected(new Set());
  }, [scope, type, status, sort]);

  useEffect(() => {
    const el = document.getElementById(`review-card-${sorted[focused]?.id}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focused, sorted]);

  const runAction = useCallback(async (item, action, extra = {}) => {
    try {
      await base44.functions.invoke('resolveReviewItem', {
        source_entity: item.source_entity,
        id: item.id,
        action,
        note: extra.note || '',
        survivor_id: extra.survivor_id,
      });
      removeItem(item.id);
      setDismissFor(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      reload(true);
      toast({
        title: ACTION_TITLES[action] || 'Updated',
        description: item.title,
        action: action === 'reopen' ? undefined : (
          <ToastAction altText="Undo" onClick={() => undo(item)}>Undo</ToastAction>
        ),
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'That action did not go through',
        description: e?.response?.data?.error || 'Please try again.',
      });
    }
  }, [reload, removeItem, toast]);

  const undo = async (item) => {
    try {
      await base44.functions.invoke('resolveReviewItem', {
        source_entity: item.source_entity,
        id: item.id,
        action: 'reopen',
      });
      reload(true);
      toast({ title: 'Restored to Open', description: item.title });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not undo', description: 'The item could not be moved back.' });
    }
  };

  useEffect(() => {
    if (status !== 'open') return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (!sorted.length) return;
      const item = sorted[Math.min(focused, sorted.length - 1)];
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((i) => Math.min(sorted.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((i) => Math.max(0, i - 1));
      } else if (key === 'y' && item) {
        e.preventDefault();
        runAction(item, 'resolve', item.type === 'duplicate' ? { survivor_id: item.survivor_options?.[1]?.id } : {});
      } else if (key === 'l' && item) {
        e.preventDefault();
        runAction(item, 'later');
      } else if (key === 'n' && item) {
        e.preventDefault();
        setDismissFor(item.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sorted, focused, status, runAction]);

  const highMatches = useMemo(
    () => sorted.filter((i) => i.type === 'duplicate' && (i.confidence || 0) >= 0.9),
    [sorted]
  );

  const selectAllHigh = () => setSelected(new Set(highMatches.map((i) => i.id)));

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const mergeSelected = async () => {
    const targets = sorted.filter((i) => selected.has(i.id));
    if (!targets.length) return;
    setBulkBusy(true);
    let merged = 0;
    let failed = 0;
    for (const item of targets) {
      try {
        await base44.functions.invoke('resolveReviewItem', {
          source_entity: item.source_entity,
          id: item.id,
          action: 'resolve',
          survivor_id: item.survivor_options?.[1]?.id,
        });
        removeItem(item.id);
        merged += 1;
      } catch (e) {
        failed += 1;
      }
    }
    setSelected(new Set());
    setBulkBusy(false);
    reload(true);
    toast({
      title: `Merged ${merged} duplicate${merged === 1 ? '' : 's'}`,
      description: failed ? `${failed} could not be merged and remain in the queue.` : undefined,
    });
  };

  if (access === 'checking') {
    return <Layout><div className="flex justify-center py-16"><Loader2 size={24} className="text-gold animate-spin" /></div></Layout>;
  }

  if (access === 'denied') {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
          <div className="aged-card rounded-2xl p-12 text-center">
            <ClipboardCheck size={32} className="text-gold/40 mx-auto mb-3" />
            <h1 className="font-display text-2xl text-parchment mb-2">Review is for administrators</h1>
            <p className="text-parchment/50 text-sm">
              This queue is open to the global admin and to branch admins for their own bloodline.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <ClipboardCheck size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Review</h1>
            <p className="text-parchment/50 text-sm">
              One queue for every pending decision — duplicates, contested facts, links, edits, reports and tags.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <ReviewToolbar
            scope={scope}
            onScopeChange={setScope}
            branchLabel={branchLabel}
            sort={sort}
            onSortChange={setSort}
            type={type}
            onTypeChange={setType}
            counts={counts.by_type}
          />
          <ReviewStateTabs status={status} onStatusChange={setStatus} counts={counts.by_state} />
        </div>

        {status === 'open' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={selectAllHigh}
              disabled={highMatches.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-amber-light/80 text-xs hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-40"
            >
              <Copy size={12} /> Select all ≥90% matches ({highMatches.length})
            </button>
            <button
              onClick={mergeSelected}
              disabled={selected.size === 0 || bulkBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : null}
              Merge selected duplicates ({selected.size})
            </button>
            <span className="text-[11px] text-parchment/30 ml-auto hidden sm:block">
              ↑/↓ move · Y resolve · N dismiss · L later
            </span>
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="aged-card rounded-xl h-24 animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="aged-card rounded-xl p-10 text-center">
              <AlertCircle size={28} className="text-gold/50 mx-auto mb-2" />
              <p className="text-sm text-parchment/60">{error}</p>
              <button onClick={() => reload()} className="mt-4 px-4 py-2 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-xs hover:bg-[rgba(201,145,58,0.08)] transition-colors">
                Try again
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="aged-card rounded-xl p-12 text-center">
              <CheckCircle2 size={32} className="text-gold/40 mx-auto mb-3" />
              <p className="text-parchment/50 text-sm">
                {status === 'open' ? 'Nothing waiting for review in this scope — you are all caught up.' : `No ${status} items here.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {sorted.map((item, idx) => (
                  <motion.div
                    key={`${item.source_entity}-${item.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
                  >
                    <ReviewCard
                      item={item}
                      focused={idx === focused}
                      past={status !== 'open'}
                      forceDismissOpen={dismissFor === item.id}
                      selectable={status === 'open' && item.type === 'duplicate'}
                      selected={selected.has(item.id)}
                      onToggleSelect={toggleSelect}
                      onAction={runAction}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}