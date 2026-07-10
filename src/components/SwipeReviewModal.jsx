import React, { useState, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Check, Flag, Loader2, Rocket, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SwipeReviewForm from '@/components/SwipeReviewForm';
import InviteFamilyDialog from '@/components/InviteFamilyDialog';

export default function SwipeReviewModal({ onClose }) {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [exitDir, setExitDir] = useState(null);
  const [session, setSession] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [stats, setStats] = useState({ confirmed: 0, flagged: 0 });
  const [formData, setFormData] = useState({});
  const dragControls = useDragControls();

  const loadInitial = async () => {
    try {
      const user = await base44.auth.me();
      const allItems = await base44.entities.ContentItem.list('-created_date', 200);
      const pending = (allItems || []).filter(i =>
        !i.review_status || i.review_status === 'pending' || i.review_status === 'flagged'
      );
      setItems(pending);

      const ancList = await base44.entities.Ancestor.list();
      setAncestors(ancList || []);

      const sessions = await base44.entities.GoLiveSession.list().catch(() => []);
      const activeSession = (sessions || []).find(s => s.status !== 'completed');
      if (activeSession) {
        const updated = await base44.entities.GoLiveSession.update(activeSession.id, {
          status: 'in_progress',
          total_items: pending.length,
          started_by_id: user.id,
          started_by_name: user.full_name,
        });
        setSession(updated);
      } else if (!sessions || sessions.length === 0) {
        const created = await base44.entities.GoLiveSession.create({
          status: 'in_progress',
          total_items: pending.length,
          started_by_id: user.id,
          started_by_name: user.full_name,
          confirmed_count: 0,
          flagged_count: 0,
        });
        setSession(created);
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, []);

  useEffect(() => {
    const item = items[currentIndex];
    if (item) {
      setFormData({
        title: item.title || '',
        content_type: item.content_type || 'uncategorized',
        description: item.description || '',
        date: item.date || '',
        era: item.era || '',
        location_name: item.location_name || '',
        latitude: item.latitude != null ? String(item.latitude) : '',
        longitude: item.longitude != null ? String(item.longitude) : '',
        ancestor_ids: item.ancestor_ids || [],
        transcribed_text: item.transcribed_text || '',
        extracted_fields: item.extracted_fields || {},
        tags: item.tags || [],
      });
    }
  }, [currentIndex, items]);

  const currentItem = items[currentIndex];

  const triggerSwipe = useCallback(async (direction) => {
    if (processing || !currentItem) return;
    setProcessing(true);
    setExitDir(direction);

    await new Promise(r => setTimeout(r, 300));

    try {
      const newStatus = direction === 'right' ? 'reviewed' : 'flagged';
      await base44.entities.ContentItem.update(currentItem.id, {
        title: formData.title,
        content_type: formData.content_type,
        description: formData.description,
        date: formData.date || null,
        era: formData.era || null,
        location_name: formData.location_name || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        ancestor_ids: formData.ancestor_ids,
        transcribed_text: formData.transcribed_text || null,
        extracted_fields: formData.extracted_fields && Object.keys(formData.extracted_fields).length > 0 ? formData.extracted_fields : null,
        tags: formData.tags,
        review_status: newStatus,
      });

      const newStats = {
        confirmed: stats.confirmed + (direction === 'right' ? 1 : 0),
        flagged: stats.flagged + (direction === 'left' ? 1 : 0),
      };
      setStats(newStats);

      if (currentIndex + 1 >= items.length) {
        if (session) {
          await base44.entities.GoLiveSession.update(session.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            confirmed_count: newStats.confirmed,
            flagged_count: newStats.flagged,
          });
        }
        setShowInvite(true);
      } else {
        setCurrentIndex(i => i + 1);
      }
    } catch (e) {}
    setExitDir(null);
    setProcessing(false);
  }, [processing, currentItem, formData, currentIndex, items.length, session, stats]);

  const handleDragEnd = (e, info) => {
    if (info.offset.x > 100 || info.velocity.x > 500) {
      triggerSwipe('right');
    } else if (info.offset.x < -100 || info.velocity.x < -500) {
      triggerSwipe('left');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-charcoal flex items-center justify-center">
        <Loader2 size={32} className="text-gold animate-spin" />
      </div>
    );
  }

  if (showInvite) {
    return <InviteFamilyDialog open={true} onClose={onClose} stats={stats} />;
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-charcoal flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-gold" />
          </div>
          <h2 className="font-display text-2xl text-parchment mb-2">All Events Reviewed</h2>
          <p className="text-parchment/50 text-sm mb-6">There are no pending events to review. You're ready to go live and invite family members.</p>
          <button
            onClick={async () => {
              if (session) {
                await base44.entities.GoLiveSession.update(session.id, {
                  status: 'completed', completed_at: new Date().toISOString(), confirmed_count: 0, flagged_count: 0,
                });
              }
              setShowInvite(true);
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold hover:opacity-90 transition-opacity mx-auto"
          >
            <Rocket size={18} /> Proceed to Going Live
          </button>
        </div>
      </div>
    );
  }

  const progress = (currentIndex / items.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-charcoal flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(201,145,58,0.15)]">
        <div className="flex items-center gap-2">
          <Rocket size={20} className="text-gold" />
          <span className="font-display text-lg text-parchment">Going Live Review</span>
        </div>
        <button onClick={onClose} className="text-parchment/50 hover:text-parchment p-2">
          <X size={20} />
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-parchment/50">{currentIndex + 1} of {items.length}</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400 flex items-center gap-1"><Check size={12} /> {stats.confirmed}</span>
            <span className="text-amber-light flex items-center gap-1"><Flag size={12} /> {stats.flagged}</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-[rgba(245,236,215,0.1)] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {/* Swipe indicators */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`absolute right-8 transition-opacity duration-200 ${exitDir === 'right' ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-20 h-20 rounded-full border-4 border-green-400 flex items-center justify-center">
              <Check size={40} className="text-green-400" />
            </div>
          </div>
          <div className={`absolute left-8 transition-opacity duration-200 ${exitDir === 'left' ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-20 h-20 rounded-full border-4 border-amber-light flex items-center justify-center">
              <Flag size={40} className="text-amber-light" />
            </div>
          </div>
        </div>

        {processing && !exitDir && (
          <div className="absolute inset-0 flex items-center justify-center bg-charcoal/50 z-10">
            <Loader2 size={32} className="text-gold animate-spin" />
          </div>
        )}

        {/* Swipeable card */}
        <motion.div
          key={currentItem?.id || currentIndex}
          drag={!exitDir && !processing}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={exitDir === 'right' ? { x: window.innerWidth + 500, opacity: 0 } : exitDir === 'left' ? { x: -window.innerWidth - 500, opacity: 0 } : { x: 0, opacity: 1, scale: 1 }}
          transition={{ duration: exitDir ? 0.3 : 0.2 }}
          className="aged-card rounded-2xl w-full max-w-lg max-h-full overflow-hidden flex flex-col"
        >
          {/* Drag handle area (image + swipe hints) */}
          <div onPointerDown={(e) => dragControls.start(e)} className="cursor-grab active:cursor-grabbing">
            {currentItem?.file_url && (
              <div className="relative h-44 bg-[#0D0B0A] flex-shrink-0 overflow-hidden">
                {currentItem.file_url.match(/\.(pdf)$/i) ? (
                  <iframe src={currentItem.file_url} title="preview" className="w-full h-full bg-parchment" />
                ) : (
                  <img src={currentItem.file_url} alt={currentItem.title} className="w-full h-full object-contain sepia-tint" />
                )}
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs text-amber-light">
                  {currentItem.content_type}
                </div>
              </div>
            )}
            <div className="px-4 py-1.5 flex items-center justify-between bg-[rgba(201,145,58,0.05)]">
              <span className="text-xs text-amber-light/50 flex items-center gap-1"><Flag size={11} /> Swipe left to flag</span>
              <span className="text-xs text-green-400/50 flex items-center gap-1">Swipe right to confirm <Check size={11} /></span>
            </div>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto">
            <SwipeReviewForm item={currentItem} formData={formData} setFormData={setFormData} ancestors={ancestors} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 p-3 border-t border-[rgba(201,145,58,0.15)] flex-shrink-0">
            <button
              onClick={() => triggerSwipe('left')}
              disabled={processing}
              className="flex-1 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Flag size={16} /> Flag
            </button>
            <button
              onClick={() => triggerSwipe('right')}
              disabled={processing}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Confirm Details
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}