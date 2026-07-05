import React, { useState } from 'react';
import { UserCheck, AlertCircle, X, Search, Check, UserPlus, Loader2, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Dialog shown after AI analysis when:
 * - mode 'confirm': near-match ancestors found — user confirms which apply
 * - mode 'prompt': no ancestor was identified — user must select at least one
 *
 * In both modes, the user can also create a new ancestor on the fly.
 * New ancestors are auto-approved and appear in the Admin's review list.
 */
export default function AncestorMatchDialog({ mode, matches, ancestors, onConfirm, onDismiss, onAncestorCreated }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(
    mode === 'confirm' ? (matches || []).map(m => m.ancestor.id) : []
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAncestor, setNewAncestor] = useState({
    full_name: '',
    birth_date: '',
    birth_place: '',
    nationality: '',
    living: true,
    biography: '',
  });

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

  const handleCreateAncestor = async () => {
    if (!newAncestor.full_name.trim()) return;
    setCreating(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const surname = newAncestor.full_name.trim().split(/\s+/).pop().toUpperCase();
      const givenNames = newAncestor.full_name.trim().split(/\s+/).slice(0, -1).join(' ');
      const formattedName = `${givenNames} ${surname}`.trim();

      const created = await base44.entities.Ancestor.create({
        full_name: formattedName,
        birth_date: newAncestor.birth_date || null,
        birth_place: newAncestor.birth_place || null,
        nationality: newAncestor.nationality || null,
        living: newAncestor.living,
        biography: newAncestor.biography || null,
        review_status: 'auto_approved',
        created_by_id: user?.id || null,
        created_by_name: user?.full_name || user?.email || null,
      });

      if (onAncestorCreated) onAncestorCreated(created);
      setSelectedIds(prev => [...new Set([...prev, created.id])]);
      setShowCreateForm(false);
      setNewAncestor({ full_name: '', birth_date: '', birth_place: '', nationality: '', living: true, biography: '' });
    } catch (e) {
      // error — stay on form
    }
    setCreating(false);
  };

  const formatNamePreview = (name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return [...parts.slice(0, -1), parts[parts.length - 1].toUpperCase()].join(' ');
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="aged-card rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,145,58,0.15)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showCreateForm ? (
              <UserPlus size={20} className="text-gold" />
            ) : mode === 'confirm' ? (
              <UserCheck size={20} className="text-gold" />
            ) : (
              <AlertCircle size={20} className="text-gold" />
            )}
            <h3 className="font-display text-lg text-parchment">
              {showCreateForm ? 'Add New Ancestor' : mode === 'confirm' ? 'Confirm Ancestor Match' : 'Select an Ancestor'}
            </h3>
          </div>
          <button onClick={onDismiss} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showCreateForm ? (
            /* ── Create new ancestor form ── */
            <div className="space-y-4">
              <div>
                <p className="text-sm text-parchment/70 mb-1">
                  Can't find who you're looking for? Add them to the bloodline now.
                </p>
                <p className="text-xs text-amber-light/70">
                  The new ancestor will be auto-approved and visible immediately. An admin can review and overwrite details later.
                </p>
              </div>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Full Name <span className="text-[#C9913A]">*</span></label>
                <input
                  value={newAncestor.full_name}
                  onChange={e => setNewAncestor({ ...newAncestor, full_name: e.target.value })}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Given Names + Surname"
                  autoFocus
                />
                {newAncestor.full_name.trim() && (
                  <p className="text-xs text-parchment/40 mt-1">
                    Will be saved as: <span className="text-amber-light">{formatNamePreview(newAncestor.full_name)}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Birth Date</label>
                  <input
                    type="date"
                    value={newAncestor.birth_date}
                    onChange={e => setNewAncestor({ ...newAncestor, birth_date: e.target.value })}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  />
                </div>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Nationality</label>
                  <input
                    value={newAncestor.nationality}
                    onChange={e => setNewAncestor({ ...newAncestor, nationality: e.target.value })}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="e.g. Italian"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Birth Place</label>
                <input
                  value={newAncestor.birth_place}
                  onChange={e => setNewAncestor({ ...newAncestor, birth_place: e.target.value })}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="City, Country"
                />
              </div>

              <div>
                <label className="text-xs text-parchment/50 mb-1 block">Brief Biography (optional)</label>
                <textarea
                  value={newAncestor.biography}
                  onChange={e => setNewAncestor({ ...newAncestor, biography: e.target.value })}
                  rows={2}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Any details you know about this person..."
                />
              </div>

              <button
                onClick={() => setNewAncestor({ ...newAncestor, living: !newAncestor.living })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${newAncestor.living ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-parchment/50'}`}
              >
                <Heart size={12} /> {newAncestor.living ? 'Living' : 'Deceased'}
              </button>
            </div>
          ) : (
            <>
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
                    Every event in the archive must be associated with at least one ancestor. Search below or create a new one.
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
                      <p className="px-4 py-3 text-sm text-parchment/40">No ancestors found — try creating a new one below.</p>
                    )}
                  </div>
                </>
              )}

              {/* Create new ancestor button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[rgba(201,145,58,0.3)] text-amber-light text-sm hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
              >
                <UserPlus size={16} />
                Can't find them? Add a New Ancestor
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.15)] flex items-center justify-between">
          {showCreateForm ? (
            <>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-sm text-parchment/50 hover:text-parchment transition-colors"
              >
                Back to search
              </button>
              <button
                onClick={handleCreateAncestor}
                disabled={!newAncestor.full_name.trim() || creating}
                className="px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {creating ? 'Adding...' : 'Add to Bloodline'}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}