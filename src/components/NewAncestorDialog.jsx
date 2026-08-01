import React, { useState } from 'react';
import { X, UserPlus, Loader2, MapPin, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DateSelectInput from '@/components/DateSelectInput';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';

export default function NewAncestorDialog({ open, onClose, onCreated, user }) {
  const [form, setForm] = useState({ full_name: '', sex: 'male', maiden_name: '', birth_date: '', birth_place: '', living: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [created, setCreated] = useState(null);

  if (!open) return null;

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const currentUser = user || await base44.auth.me().catch(() => null);
      const record = await base44.entities.Ancestor.create({
        full_name: form.full_name.trim(),
        sex: form.sex || null,
        maiden_name: (form.sex === 'female' && form.maiden_name?.trim()) ? form.maiden_name.trim() : null,
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        living: form.living,
        review_status: 'staged',
        created_by_id: currentUser?.id || null,
        created_by_name: currentUser?.full_name || currentUser?.email || null,
      });
      onCreated(record);
      setCreated(record);
    } catch (e) {
      setError(e.message || 'Failed to create ancestor');
    }
    setSaving(false);
  };

  const finish = () => {
    setCreated(null);
    setForm({ full_name: '', sex: 'male', maiden_name: '', birth_date: '', birth_place: '', living: true });
    setError('');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={created ? undefined : onClose}>
        <div className="aged-card rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
            <div className="flex items-center gap-2">
              <UserPlus size={20} className="text-gold" />
              <h3 className="font-display text-lg text-parchment">Enter New Ancestor</h3>
            </div>
            <button onClick={finish} className="text-parchment/40 hover:text-parchment transition-colors">
              <X size={20} />
            </button>
          </div>

          {created ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-gold" />
              </div>
              <p className="text-parchment text-sm mb-1">{created.full_name} added.</p>
              <p className="text-parchment/40 text-xs mb-5">They're held as <span className="text-amber-light">staged</span> — hidden from the tree, map and timeline until an admin verifies them and connects them to the family.</p>
              <button onClick={finish} className="px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">Done</button>
            </div>
          ) : (
            <>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Full Name <span className="text-[#C9913A]">*</span></label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="e.g. Giuseppe Freddi"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Sex</label>
                  <div className="flex gap-2">
                    {['male', 'female'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, sex: s }))}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${(form.sex || 'male') === s ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50 hover:border-[rgba(201,145,58,0.3)]'}`}
                      >
                        {s === 'male' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-parchment/40 mt-1">The bloodline follows the male line (surname). Female ancestors link back to their birth branch via maiden name.</p>
                </div>
                {form.sex === 'female' && (
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Maiden Name <span className="text-parchment/30">(birth surname)</span></label>
                    <input
                      value={form.maiden_name}
                      onChange={e => setForm(f => ({ ...f, maiden_name: e.target.value }))}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                      placeholder="e.g. Freddi (links to her birth branch)"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Birth Date</label>
                    <DateSelectInput
                      value={form.birth_date}
                      onChange={v => setForm(f => ({ ...f, birth_date: v }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Birth Place</label>
                    <div className="flex gap-2">
                      <LocationAutocompleteInput
                        value={form.birth_place}
                        onChange={({ location_name }) => setForm(f => ({ ...f, birth_place: location_name }))}
                        placeholder="e.g. Venice, Italy"
                        className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                      />
                      <button type="button" onClick={() => setLocationPickerOpen(true)}
                        className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0">
                        <MapPin size={14} /> Map
                      </button>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-parchment/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.living}
                    onChange={e => setForm(f => ({ ...f, living: e.target.checked }))}
                    className="accent-[#C9913A]"
                  />
                  Currently living
                </label>

                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>

              <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.full_name.trim() || saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Add & Stage for Review
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onPick={({ location_name }) => setForm(f => ({ ...f, birth_place: location_name }))}
        initialLocation={form.birth_place}
      />
    </>
  );
}