import React, { useState, useEffect } from 'react';
import { UserPlus, Loader2, MapPin, Sparkles, GitBranch, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DateSelectInput from '@/components/DateSelectInput';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';

export default function OnboardingPage({ user, onCompleted }) {
  const [mode, setMode] = useState('claim'); // claim | create
  const [unclaimed, setUnclaimed] = useState([]);
  const [claimId, setClaimId] = useState('');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    birth_date: '',
    birth_place: '',
    living: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => {
    base44.entities.Ancestor.list().then((all) => {
      setUnclaimed((all || []).filter(a => !a.user_account_id));
    }).catch(() => {});
  }, []);

  const handleClaim = async () => {
    if (!claimId) { setError('Select your ancestor profile to claim'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Ancestor.update(claimId, {
        user_account_id: user.id,
        living: true,
      });
      onCompleted();
    } catch (e) {
      setError(e.message || 'Failed to claim profile');
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Ancestor.create({
        full_name: form.full_name.trim(),
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        living: form.living,
        review_status: 'auto_approved',
        user_account_id: user.id,
        created_by_id: user.id,
        created_by_name: user?.full_name || null,
      });
      onCompleted();
    } catch (e) {
      setError(e.message || 'Failed to create profile');
    }
    setSaving(false);
  };

  const hasUnclaimed = unclaimed.length > 0;

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] mb-3">
            <Sparkles size={26} className="text-gold" />
          </div>
          <h1 className="font-display text-3xl text-parchment">Become Your Own Ancestor</h1>
          <p className="text-parchment/50 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}. Before you enter the archive, claim or create your ancestor profile — this links you to the bloodline so you appear on the family tree, map, and timeline.
          </p>
        </div>

        <div className="aged-card rounded-2xl overflow-hidden">
          {hasUnclaimed && (
            <div className="flex border-b border-[rgba(201,145,58,0.15)]">
              <button
                onClick={() => { setMode('claim'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${mode === 'claim' ? 'bg-[rgba(201,145,58,0.1)] text-gold border-b-2 border-[#C9913A]' : 'text-parchment/50 hover:text-parchment'}`}
              >
                <GitBranch size={15} /> Claim Existing
              </button>
              <button
                onClick={() => { setMode('create'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${mode === 'create' ? 'bg-[rgba(201,145,58,0.1)] text-gold border-b-2 border-[#C9913A]' : 'text-parchment/50 hover:text-parchment'}`}
              >
                <UserPlus size={15} /> Create New
              </button>
            </div>
          )}

          <div className="p-6 space-y-4">
            {mode === 'claim' && hasUnclaimed ? (
              <>
                <label className="text-xs text-parchment/50 mb-1 block">Select your profile</label>
                <p className="text-xs text-parchment/40 -mt-2 mb-1">If the admin has placed your name in the family tree, claim it here.</p>
                <select
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                >
                  <option value="">— Choose your ancestor —</option>
                  {unclaimed.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}{a.birth_date ? ` (b. ${new Date(a.birth_date).getFullYear()})` : ''}{a.birth_place ? ` — ${a.birth_place}` : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Full Name <span className="text-[#C9913A]">*</span></label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="e.g. Giuseppe Freddi"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Birth Date</label>
                  <DateSelectInput value={form.birth_date} onChange={(v) => setForm(f => ({ ...f, birth_date: v }))} className="w-full" />
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
                <label className="flex items-center gap-2 text-sm text-parchment/60 cursor-pointer">
                  <input type="checkbox" checked={form.living} onChange={(e) => setForm(f => ({ ...f, living: e.target.checked }))} className="accent-[#C9913A]" />
                  Currently living
                </label>
              </>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2">
            <button
              onClick={mode === 'claim' && hasUnclaimed ? handleClaim : handleCreate}
              disabled={saving || (mode === 'claim' && hasUnclaimed ? !claimId : !form.full_name.trim())}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {mode === 'claim' && hasUnclaimed ? 'Claim & Enter Archive' : 'Create & Enter Archive'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-parchment/30 mt-4">Present, Past, Future — preserved for generations</p>
      </div>

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onPick={({ location_name }) => setForm(f => ({ ...f, birth_place: location_name }))}
        initialLocation={form.birth_place}
      />
    </div>
  );
}