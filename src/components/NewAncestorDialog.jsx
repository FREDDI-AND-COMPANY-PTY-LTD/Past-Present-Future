import React, { useState } from 'react';
import { X, UserPlus, Loader2, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DateSelectInput from '@/components/DateSelectInput';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';

export default function NewAncestorDialog({ open, onClose, onCreated, user }) {
  const [form, setForm] = useState({ full_name: '', birth_date: '', birth_place: '', living: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

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
      const created = await base44.entities.Ancestor.create({
        full_name: form.full_name.trim(),
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        living: form.living,
        review_status: 'auto_approved',
        created_by_id: currentUser?.id || null,
        created_by_name: currentUser?.full_name || currentUser?.email || null,
      });
      onCreated(created);
      setForm({ full_name: '', birth_date: '', birth_place: '', living: true });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create ancestor');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
        <div className="aged-card rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
            <div className="flex items-center gap-2">
              <UserPlus size={20} className="text-gold" />
              <h3 className="font-display text-lg text-parchment">Enter New Ancestor</h3>
            </div>
            <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
              <X size={20} />
            </button>
          </div>

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
              Create & Tag
            </button>
          </div>
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