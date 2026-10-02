import React, { useState } from 'react';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DateSelectInput from '@/components/DateSelectInput';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';
import BranchNominationStep from '@/components/BranchNominationStep';

export default function OnboardingPage({ user, onCompleted }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || [user?.given_names, user?.family_name].filter(Boolean).join(' ') || '',
    birth_date: '',
    birth_place: '',
    living: true,
    residence_place: user?.residence_place || '',
    residence_latitude: user?.residence_latitude || '',
    residence_longitude: user?.residence_longitude || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [showNomination, setShowNomination] = useState(false);
  const [nominationInvite, setNominationInvite] = useState(null);
  const [myAncestorId, setMyAncestorId] = useState(null);

  const handleRegister = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const normalizedName = form.full_name.trim();
      // If an unclaimed placeholder already exists for this name (e.g. admin pre-created
      // it via the invite flow), claim it instead of creating a duplicate.
      const all = await base44.entities.Ancestor.list().catch(() => []);
      const existing = (all || []).find(a =>
        !a.user_account_id &&
        a.full_name && a.full_name.trim().toLowerCase() === normalizedName.toLowerCase()
      );

      let createdId;
      if (existing) {
        await base44.entities.Ancestor.update(existing.id, {
          user_account_id: user.id,
          birth_date: form.birth_date || existing.birth_date || null,
          birth_place: form.birth_place || existing.birth_place || null,
          living: form.living,
          residence_place: form.residence_place || null,
          residence_latitude: form.residence_latitude ? parseFloat(form.residence_latitude) : null,
          residence_longitude: form.residence_longitude ? parseFloat(form.residence_longitude) : null,
        });
        createdId = existing.id;
        // Carry over the inviting admin's newsletter request onto the new user account
        if (existing.newsletter_opt_in) {
          await base44.auth.updateMe({ newsletter_opt_in: true }).catch(() => {});
        }
      } else {
        const created = await base44.entities.Ancestor.create({
          full_name: normalizedName,
          birth_date: form.birth_date || null,
          birth_place: form.birth_place || null,
          living: form.living,
          residence_place: form.residence_place || null,
          residence_latitude: form.residence_latitude ? parseFloat(form.residence_latitude) : null,
          residence_longitude: form.residence_longitude ? parseFloat(form.residence_longitude) : null,
          review_status: 'auto_approved',
          user_account_id: user.id,
          created_by_id: user.id,
          created_by_name: user?.full_name || null,
        });
        createdId = created?.id;
      }

      // If this user was invited to a branch, route them to the nomination step
      // instead of finishing onboarding — so they declare their tree relationship
      // for the branch admin's approval.
      try {
        const invites = await base44.entities.BranchInvite.filter({ invitee_email: user.email, status: 'pending' });
        const invite = (invites || [])[0];
        if (invite) {
          setNominationInvite(invite);
          setMyAncestorId(createdId);
          setShowNomination(true);
          setSaving(false);
          return;
        }
      } catch (e) {}
      onCompleted();
    } catch (e) {
      setError(e.message || 'Failed to register ancestor');
    }
    setSaving(false);
  };

  if (showNomination && nominationInvite) {
    return <BranchNominationStep user={user} myAncestorId={myAncestorId} invite={nominationInvite} onCompleted={onCompleted} />;
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] mb-3">
            <Sparkles size={26} className="text-gold" />
          </div>
          <h1 className="font-display text-3xl text-parchment">Become Your Own Ancestor</h1>
          <p className="text-parchment/50 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}. Enter your details to register your ancestor profile — this links you to the bloodline so you appear on the family tree, map, and timeline.
          </p>
        </div>

        <div className="aged-card rounded-2xl overflow-hidden">
          <div className="p-6 space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Where do you live? <span className="text-parchment/30">(town only — for the family map)</span></label>
              <LocationAutocompleteInput
                value={form.residence_place}
                onChange={({ location_name, latitude, longitude }) => setForm(f => ({ ...f, residence_place: location_name || '', residence_latitude: latitude || '', residence_longitude: longitude || '' }))}
                placeholder="e.g. Carlton, Victoria"
                types={['(cities)']}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              />
              <p className="text-xs text-parchment/30 mt-1">Town only — we never store street addresses. This places you on the family map.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-parchment/60 cursor-pointer">
              <input type="checkbox" checked={form.living} onChange={(e) => setForm(f => ({ ...f, living: e.target.checked }))} className="accent-[#C9913A]" />
              Currently living
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2">
            <button
              onClick={handleRegister}
              disabled={saving || !form.full_name.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Register
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