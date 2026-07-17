import React, { useState } from 'react';
import { X, UserPlus, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';

export default function InviteUserDialog({ open, onClose, user }) {
  const [form, setForm] = useState({ full_name: '', email: '', birth_date: '', birth_place: '', living: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  if (!open) return null;

  const reset = () => {
    setForm({ full_name: '', email: '', birth_date: '', birth_place: '', living: true });
    setError('');
    setSuccess('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleInvite = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('A valid email is required to send the invitation'); return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const currentUser = user || await base44.auth.me().catch(() => null);
      // 1. Pre-create the ancestor placeholder — unclaimed, so it appears in the registration dropdown
      const ancestor = await base44.entities.Ancestor.create({
        full_name: form.full_name.trim(),
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        living: form.living,
        review_status: 'auto_approved',
        created_by_id: currentUser?.id || null,
        created_by_name: currentUser?.full_name || currentUser?.email || null,
      });

      // 2. Invite the user — the platform sends the invitation/registration email
      await base44.users.inviteUser(form.email.trim(), 'user');

      setSuccess(`Invitation sent to ${form.email.trim()}. When they register, they can claim ${form.full_name.trim()}'s profile from the dropdown.`);
      setForm({ full_name: '', email: '', birth_date: '', birth_place: '', living: true });
      // keep ancestor created even if dialog closes
    } catch (e) {
      setError(e.message || 'Failed to send invitation');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={handleClose}>
        <div className="aged-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
            <div className="flex items-center gap-2">
              <UserPlus size={20} className="text-gold" />
              <h3 className="font-display text-lg text-parchment">Invite New Family Member</h3>
            </div>
            <button onClick={handleClose} className="text-parchment/40 hover:text-parchment transition-colors">
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="p-6 text-center">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-parchment text-sm leading-relaxed">{success}</p>
              <button onClick={handleClose} className="mt-5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="p-5 space-y-4">
                <p className="text-xs text-parchment/50 leading-relaxed">
                  Enter the family member's details to pre-create their ancestor profile. They'll receive an email invitation to register, and can claim this profile from the registration dropdown.
                </p>

                <div>
                  <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1">
                    <Mail size={12} /> Email Address <span className="text-[#C9913A]">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="family.member@example.com"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs text-parchment/50 mb-1 block">Full Name <span className="text-[#C9913A]">*</span></label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                    placeholder="e.g. Giuseppe Freddi"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Birth Date</label>
                    <input
                      type="date"
                      value={form.birth_date}
                      onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                      className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-parchment/50 mb-1 block">Birth Place</label>
                    <div className="flex gap-2">
                      <LocationAutocompleteInput
                        value={form.birth_place}
                        onChange={({ location_name }) => setForm(f => ({ ...f, birth_place: location_name }))}
                        placeholder="Venice, Italy"
                        className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                      />
                      <button type="button" onClick={() => setLocationPickerOpen(true)}
                        className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0">
                        Map
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

              <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-end gap-2 sticky bottom-0 bg-[#1A1614]">
                <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={saving || !form.full_name.trim() || !form.email.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Create Profile & Send Invite
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