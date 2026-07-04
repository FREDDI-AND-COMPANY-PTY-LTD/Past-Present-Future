import React, { useState } from 'react';
import { FolderUp, Loader2, Check, Cloud } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CloudFolderSetting({ user, onUpdate }) {
  const [address, setAddress] = useState(user?.cloud_folder_address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!address.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await base44.auth.updateMe({ cloud_folder_address: address.trim(), is_branch_member: true });
      setSaved(true);
      if (onUpdate) onUpdate({ ...user, cloud_folder_address: address.trim(), is_branch_member: true });
    } catch (e) {}
    setSaving(false);
  };

  const isBranchMember = user?.is_branch_member || !!user?.cloud_folder_address;

  return (
    <div className="px-4 py-3 rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.12)]">
      <div className="flex items-center gap-2 mb-2">
        <Cloud size={14} className="text-gold" />
        <p className="text-xs text-amber-light font-medium">Cloud Backup Folder</p>
        {isBranchMember && <span className="ml-auto text-xs text-gold/60 flex items-center gap-0.5"><Check size={10} /> Member</span>}
      </div>
      <input
        value={address}
        onChange={e => { setAddress(e.target.value); setSaved(false); }}
        placeholder="e.g. /My Drive/Freddi Archive"
        className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/25"
      />
      <button
        onClick={handleSave}
        disabled={saving || !address.trim()}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <FolderUp size={12} />}
        {saving ? 'Saving...' : saved ? 'Saved — backups active' : isBranchMember ? 'Update Folder' : 'Activate Branch Membership'}
      </button>
      <p className="mt-1.5 text-xs text-parchment/30 leading-tight">
        Your archive auto-backs up here on every logout.
      </p>
    </div>
  );
}