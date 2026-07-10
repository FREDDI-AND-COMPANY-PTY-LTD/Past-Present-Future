import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2, GitMerge, Loader2, Check, ExternalLink, Flag, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SCALAR_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'date', label: 'Date' },
  { key: 'location_name', label: 'Location' },
  { key: 'era', label: 'Era' },
  { key: 'transcribed_text', label: 'Transcribed Text' },
];

function formatValue(val) {
  if (val == null || val === '') return '—';
  const s = String(val);
  return s.length > 150 ? s.slice(0, 150) + '…' : s;
}

function valuesDiffer(a, b) {
  return String(a ?? '').trim() !== String(b ?? '').trim();
}

function FieldRow({ field, resolution, onResolve, users, currentUser }) {
  const source = resolution?.source || 'existing';

  return (
    <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-parchment/50 font-medium capitalize">{field.label}</p>
        {field.differs && (
          <span className="text-[10px] text-amber-light/50 px-1.5 py-0.5 rounded-full bg-[rgba(201,145,58,0.06)]">values differ</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => onResolve({ source: 'new' })}
          className={`text-left p-2.5 rounded-lg border transition-all ${source === 'new' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.1)] hover:border-[rgba(201,145,58,0.25)]'}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-3 h-3 rounded-full border-2 ${source === 'new' ? 'border-[#C9913A] bg-[#C9913A]' : 'border-[rgba(201,145,58,0.3)]'}`} />
            <p className="text-[10px] text-parchment/40">Your Upload</p>
          </div>
          <p className="text-xs text-parchment break-words leading-relaxed">{formatValue(field.newValue)}</p>
        </button>
        <button
          onClick={() => onResolve({ source: 'existing' })}
          className={`text-left p-2.5 rounded-lg border transition-all ${source === 'existing' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.1)] hover:border-[rgba(201,145,58,0.25)]'}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-3 h-3 rounded-full border-2 ${source === 'existing' ? 'border-[#C9913A] bg-[#C9913A]' : 'border-[rgba(201,145,58,0.3)]'}`} />
            <p className="text-[10px] text-parchment/40">Existing Item</p>
          </div>
          <p className="text-xs text-parchment break-words leading-relaxed">{formatValue(field.existingValue)}</p>
        </button>
      </div>
      {field.differs && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onResolve({ source: source === 'contested' ? 'existing' : 'contested' })}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-colors ${source === 'contested' ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.35)]'}`}
          >
            <Flag size={10} /> Flag as Contested
          </button>
          <button
            onClick={() => onResolve({ source: source === 'query' ? 'existing' : 'query' })}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-colors ${source === 'query' ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.35)]'}`}
          >
            <HelpCircle size={10} /> Raise a Query
          </button>
        </div>
      )}
      {source === 'contested' && (
        <input
          value={resolution?.comment || ''}
          onChange={e => onResolve({ comment: e.target.value })}
          placeholder="Why is this contested? What are the competing claims?"
          className="mt-2 w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
        />
      )}
      {source === 'query' && (
        <div className="mt-2 space-y-2">
          <select
            value={resolution?.query_target_user_id || ''}
            onChange={e => onResolve({ query_target_user_id: e.target.value })}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
          >
            <option value="">Select a family member to ask…</option>
            {users.filter(u => u.id !== currentUser?.id).map(u => (
              <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
            ))}
          </select>
          <input
            value={resolution?.query_text || ''}
            onChange={e => onResolve({ query_text: e.target.value })}
            placeholder="What should they verify?"
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
          />
        </div>
      )}
    </div>
  );
}

export default function DuplicateResolutionDialog({ duplicates, newItemId, newItemTitle, user, onClose, onRemoved, onMerged }) {
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState(null);
  const [existingItems, setExistingItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [resolutions, setResolutions] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [doneAction, setDoneAction] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const ni = await base44.entities.ContentItem.get(newItemId);
        const existing = await Promise.all(
          duplicates.map(d => base44.entities.ContentItem.get(d.content_item_id).catch(() => null))
        );
        const allUsers = await base44.entities.User.list().catch(() => []);
        setNewItem(ni);
        setExistingItems(existing.filter(Boolean));
        setUsers(allUsers);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  const activeDup = duplicates[activeIdx];
  const existingItem = existingItems[activeIdx];

  const comparisonFields = [];
  if (newItem && existingItem) {
    for (const f of SCALAR_FIELDS) {
      const hasNew = newItem[f.key] != null && newItem[f.key] !== '';
      const hasExisting = existingItem[f.key] != null && existingItem[f.key] !== '';
      if (hasNew || hasExisting) {
        comparisonFields.push({
          key: f.key,
          label: f.label,
          newValue: newItem[f.key],
          existingValue: existingItem[f.key],
          differs: valuesDiffer(newItem[f.key], existingItem[f.key]),
        });
      }
    }
    const efKeys = new Set([
      ...Object.keys(newItem.extracted_fields || {}),
      ...Object.keys(existingItem.extracted_fields || {}),
    ]);
    for (const efKey of efKeys) {
      const nv = newItem.extracted_fields?.[efKey];
      const ev = existingItem.extracted_fields?.[efKey];
      if ((nv || ev) && valuesDiffer(nv, ev)) {
        comparisonFields.push({
          key: `extracted_fields.${efKey}`,
          label: efKey.replace(/_/g, ' '),
          newValue: nv,
          existingValue: ev,
          differs: true,
        });
      }
    }
  }

  const setResolution = (fieldKey, resolution) => {
    setResolutions(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], ...resolution } }));
  };

  const handleMerge = async () => {
    if (!existingItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const fieldResolutions = {};
      const contestedFields = [];
      const raisedQueries = [];

      for (const cf of comparisonFields) {
        const res = resolutions[cf.key];
        if (!res || res.source === 'existing') {
          fieldResolutions[cf.key] = { source: 'keep' };
        } else if (res.source === 'new') {
          fieldResolutions[cf.key] = { source: 'remove' };
        } else if (res.source === 'contested') {
          contestedFields.push({
            field: cf.key,
            comment: res.comment || '',
            competing_values: {
              new_value: formatValue(cf.newValue),
              existing_value: formatValue(cf.existingValue),
            },
          });
        } else if (res.source === 'query') {
          raisedQueries.push({
            field: cf.key,
            query_text: res.query_text || `Please verify the correct value for "${cf.label}" — competing values exist between merged items.`,
            target_user_id: res.query_target_user_id || null,
          });
        }
      }

      await base44.functions.invoke('resolveDuplicateMerge', {
        keep_item_id: existingItem.id,
        remove_item_id: newItemId,
        field_resolutions: fieldResolutions,
        contested_fields: contestedFields,
        raised_queries: raisedQueries,
      });

      setDoneAction({
        type: 'merged',
        keptItemId: existingItem.id,
        contestedCount: contestedFields.length,
        queryCount: raisedQueries.length,
        remainingDups: duplicates.length - activeIdx - 1,
      });
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await base44.entities.ContentItem.delete(newItemId);
      setDoneAction({ type: 'deleted' });
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(false);
  };

  const handleNextDuplicate = () => {
    setActiveIdx(prev => prev + 1);
    setResolutions({});
    setDoneAction(null);
  };

  const handleClose = () => {
    if (doneAction?.type === 'deleted') {
      onRemoved?.();
    } else if (doneAction?.type === 'merged') {
      if (doneAction.remainingDups > 0) {
        handleNextDuplicate();
        return;
      }
      onMerged?.(doneAction.keptItemId);
    } else {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={handleClose}>
      <div className="aged-card rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-light" />
            <h3 className="font-display text-lg text-parchment">Resolve Duplicate</h3>
            {duplicates.length > 1 && !doneAction && (
              <span className="text-xs text-parchment/40 ml-2">{activeIdx + 1} of {duplicates.length}</span>
            )}
          </div>
          <button onClick={handleClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={28} className="text-gold animate-spin mx-auto mb-3" />
            <p className="text-parchment/50 text-sm">Loading items for comparison…</p>
          </div>
        ) : doneAction ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-gold" />
            </div>
            <p className="font-display text-xl text-parchment mb-2">
              {doneAction.type === 'merged' ? 'Merge Complete' : 'Upload Removed'}
            </p>
            <p className="text-parchment/50 text-sm mb-2">
              {doneAction.type === 'merged'
                ? `"${newItemTitle}" has been merged into the existing item.`
                : 'Your upload has been removed from the archive to avoid duplication.'}
            </p>
            {doneAction.type === 'merged' && (doneAction.contestedCount > 0 || doneAction.queryCount > 0) && (
              <p className="text-xs text-amber-light/60 mb-2">
                {doneAction.contestedCount > 0 && `${doneAction.contestedCount} field${doneAction.contestedCount !== 1 ? 's' : ''} flagged as contested`}
                {doneAction.contestedCount > 0 && doneAction.queryCount > 0 && ' · '}
                {doneAction.queryCount > 0 && `${doneAction.queryCount} quer${doneAction.queryCount !== 1 ? 'ies' : 'y'} raised`}
              </p>
            )}
            {doneAction.type === 'merged' && doneAction.keptItemId && (
              <a href={`/content/${doneAction.keptItemId}`} className="inline-flex items-center gap-1 mt-2 text-xs text-amber-light hover:text-gold transition-colors">
                <ExternalLink size={12} /> View merged item
              </a>
            )}
            <div className="mt-6">
              <button onClick={handleClose} className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
                {doneAction.remainingDups > 0 ? 'Review Next Duplicate' : 'Done'}
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm">Close</button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Match info */}
              <div className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${activeDup.confidence >= 0.8 ? 'bg-red-500/10 text-red-300' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>
                    {Math.round(activeDup.confidence * 100)}% match
                  </span>
                  <a href={`/content/${activeDup.content_item_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-amber-light hover:text-gold transition-colors ml-auto">
                    <ExternalLink size={12} /> View existing item
                  </a>
                </div>
                <p className="text-xs text-parchment/40 leading-relaxed">{activeDup.reason}</p>
              </div>

              {/* Side-by-side preview */}
              {newItem?.file_url && existingItem?.file_url && (newItem.file_url !== existingItem.file_url) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-parchment/40 mb-1">Your Upload</p>
                    <img src={newItem.file_url} alt="" className="w-full h-28 object-cover rounded-lg sepia-tint" />
                  </div>
                  <div>
                    <p className="text-xs text-parchment/40 mb-1">Existing Item</p>
                    <img src={existingItem.file_url} alt="" className="w-full h-28 object-cover rounded-lg sepia-tint" />
                  </div>
                </div>
              )}

              {/* Field-by-field resolution */}
              <div>
                <p className="text-sm text-parchment/60 mb-1">Review each field and choose the correct value.</p>
                <p className="text-xs text-parchment/40 mb-3">Flag uncertain fields as <span className="text-amber-light">contested</span> or <span className="text-amber-light">raise a query</span> for another family member to decide.</p>
                <div className="space-y-3">
                  {comparisonFields.map(cf => (
                    <FieldRow
                      key={cf.key}
                      field={cf}
                      resolution={resolutions[cf.key]}
                      onResolve={(r) => setResolution(cf.key, r)}
                      users={users}
                      currentUser={user}
                    />
                  ))}
                  {comparisonFields.length === 0 && (
                    <p className="text-sm text-parchment/40 text-center py-4">No conflicting fields — merge is safe.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] space-y-2">
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleMerge}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <GitMerge size={18} />}
                  Merge &amp; Resolve
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} /> Delete Upload
                </button>
              </div>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-lg text-sm text-parchment/50 hover:text-parchment transition-colors"
              >
                Keep Both — This is not a duplicate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}