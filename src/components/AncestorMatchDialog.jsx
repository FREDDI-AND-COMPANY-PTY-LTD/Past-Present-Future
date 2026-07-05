import React, { useState } from 'react';
import { UserCheck, AlertCircle, X, Search, Check } from 'lucide-react';

/**
 * Dialog shown after AI analysis when:
 * - mode 'confirm': near-match ancestors found — user confirms which apply
 * - mode 'prompt': no ancestor was identified — user must select at least one
 */
export default function AncestorMatchDialog({ mode, matches, ancestors, onConfirm, onDismiss }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(
    mode === 'confirm' ? (matches || []).map(m => m.ancestor.id) : []
  );

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredAncestors = search
    ? ancestors.filter(a => a.full_name.toLowerCase().includes(search.toLowerCase()))
    : ancestors;

  const handleConfirm = () => {
    onConfirm(selectedIds);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="aged-card rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,145,58,0.15)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'confirm' ? (
              <UserCheck size={20} className="text-gold" />
            ) : (
              <AlertCircle size={20} className="text-gold" />
            )}
            <h3 className="font-display text-lg text-parchment">
              {mode === 'confirm' ? 'Confirm Ancestor Match' : 'Select an Ancestor'}
            </h3>
          </div>
          <button onClick={onDismiss} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === 'confirm' ? (
            <div className="mb-4">
              <p className="text-sm text-parchment/70 mb-1">
                We found possible ancestor matches in this upload. Please confirm which ancestors are associated with this event:
              </p>
              <p className="text-xs text-parchment/40">Uncheck any that don't apply.</p>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-sm text-parchment/70 mb-1">
                We couldn't automatically identify an ancestor from this upload.
              </p>
              <p className="text-xs text-amber-light/70">
                Every event in the archive must be associated with at least one ancestor. Please search and select one below.
              </p>
            </div>
          )}

          {mode === 'confirm' && (
            <div className="space-y-2 mb-4">
              {(matches || []).map((m, i) => (
                <button
                  key={m.ancestor.id}
                  onClick={() => toggle(m.ancestor.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedIds.includes(m.ancestor.id)
                      ? 'border-[#C9913A] bg-[rgba(201,145,58,0.08)]'
                      : 'border-[rgba(201,145,58,0.12)] bg-[#0D0B0A] opacity-60'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    selectedIds.includes(m.ancestor.id)
                      ? 'bg-[#C9913A] text-charcoal'
                      : 'bg-[rgba(201,145,58,0.1)] text-gold border border-[rgba(201,145,58,0.2)]'
                  }`}>
                    {selectedIds.includes(m.ancestor.id) ? <Check size={16} /> : m.ancestor.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-parchment font-medium">{m.ancestor.full_name}</p>
                    {m.ancestor.birth_date && (
                      <p className="text-xs text-parchment/40">b. {new Date(m.ancestor.birth_date).getFullYear()}</p>
                    )}
                    <p className="text-xs text-amber-light/50 mt-0.5">{m.reason}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mode === 'prompt' && (
            <>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Search ancestors by name..."
                  autoFocus
                />
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.12)] bg-[#0D0B0A]">
                {filteredAncestors.length > 0 ? filteredAncestors.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedIds.includes(a.id) ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      selectedIds.includes(a.id)
                        ? 'bg-[#C9913A] text-charcoal'
                        : 'bg-[rgba(201,145,58,0.1)] text-gold border border-[rgba(201,145,58,0.2)]'
                    }`}>
                      {selectedIds.includes(a.id) ? <Check size={14} /> : a.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-parchment">{a.full_name}</p>
                      {a.birth_date && <p className="text-xs text-parchment/40">b. {new Date(a.birth_date).getFullYear()}</p>}
                    </div>
                  </button>
                )) : (
                  <p className="px-4 py-3 text-sm text-parchment/40">No ancestors found</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.15)] flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-sm text-parchment/50 hover:text-parchment transition-colors"
          >
            {mode === 'confirm' ? 'Skip for now' : 'Decide later'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {selectedIds.length > 0
              ? `Confirm ${selectedIds.length} ancestor${selectedIds.length > 1 ? 's' : ''}`
              : 'Select at least one'}
          </button>
        </div>
      </div>
    </div>
  );
}