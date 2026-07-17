import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DateSelectInput from '@/components/DateSelectInput';

export default function AncestorEditDialog({ open, ancestor, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !ancestor) return;
    setForm({
      full_name: ancestor.full_name || '',
      birth_date: ancestor.birth_date || '',
      birth_place: ancestor.birth_place || '',
      death_date: ancestor.death_date || '',
      death_place: ancestor.death_place || '',
      nationality: ancestor.nationality || '',
      bloodline: ancestor.bloodline || '',
      era: ancestor.era || '',
      biography: ancestor.biography || '',
      living: ancestor.living !== false,
    });
    setError('');
  }, [open, ancestor]);

  if (!open || !form) return null;

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await base44.entities.Ancestor.update(ancestor.id, {
        full_name: form.full_name.trim(),
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        death_date: form.death_date || null,
        death_place: form.death_place || null,
        nationality: form.nationality || null,
        bloodline: form.bloodline || null,
        era: form.era || null,
        biography: form.biography || null,
        living: form.living,
      });
      if (onSaved) onSaved(updated);
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Edit Ancestor Profile</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Full Name <span className="text-[#C9913A]">*</span></label>
            <input value={form.full_name} onChange={e => setField('full_name', e.target.value)}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Birth Date</label>
              <DateSelectInput value={form.birth_date} onChange={v => setField('birth_date', v)} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Death Date</label>
              <DateSelectInput value={form.death_date} onChange={v => setField('death_date', v)} className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Birth Place</label>
              <input value={form.birth_place} onChange={e => setField('birth_place', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                placeholder="e.g. Venice, Italy" />
            </div>
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Death Place</label>
              <input value={form.death_place} onChange={e => setField('death_place', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                placeholder="e.g. Geelong, Australia" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Nationality</label>
              <input value={form.nationality} onChange={e => setField('nationality', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                placeholder="e.g. Italian" />
            </div>
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Bloodline</label>
              <input value={form.bloodline} onChange={e => setField('bloodline', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
            </div>
          </div>

          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Era</label>
            <input value={form.era} onChange={e => setField('era', e.target.value)}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="e.g. circa 1920s" />
          </div>

          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Biography</label>
            <textarea value={form.biography} onChange={e => setField('biography', e.target.value)} rows={4}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A] resize-y leading-relaxed"
              placeholder="Biographical notes..." />
          </div>

          <label className="flex items-center gap-2 text-sm text-parchment/60 cursor-pointer">
            <input type="checkbox" checked={form.living} onChange={e => setField('living', e.target.checked)} className="accent-[#C9913A]" />
            Currently living
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2 sticky bottom-0 bg-[#1A1614]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.full_name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}