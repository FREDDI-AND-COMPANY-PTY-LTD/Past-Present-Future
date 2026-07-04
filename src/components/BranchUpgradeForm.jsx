import React, { useState } from 'react';
import { Loader2, Check, Cloud, HardDrive, FolderUp, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PROVIDERS = [
  {
    value: 'google_drive',
    label: 'Google Drive',
    icon: Cloud,
    placeholder: 'e.g. /My Drive/Freddi Archive',
    hint: 'Backs up to your Google Drive account',
  },
  {
    value: 'one_drive',
    label: 'OneDrive',
    icon: HardDrive,
    placeholder: 'e.g. /Freddi Archive',
    hint: 'Backs up to your Microsoft OneDrive',
  },
  {
    value: 'dropbox',
    label: 'Dropbox',
    icon: FolderUp,
    placeholder: 'e.g. /Freddi Archive',
    hint: 'Backs up to your Dropbox account',
  },
];

export default function BranchUpgradeForm({ user, onUpdate }) {
  const [provider, setProvider] = useState(user?.cloud_provider || 'google_drive');
  const [address, setAddress] = useState(user?.cloud_folder_address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isBranchMember = user?.is_branch_member || !!user?.cloud_folder_address;
  const selectedProvider = PROVIDERS.find(p => p.value === provider);

  const handleSave = async () => {
    if (!address.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await base44.auth.updateMe({
        cloud_provider: provider,
        cloud_folder_address: address.trim(),
        is_branch_member: true,
      });
      setSaved(true);
      if (onUpdate) {
        onUpdate({ ...user, cloud_provider: provider, cloud_folder_address: address.trim(), is_branch_member: true });
      }
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="px-4 py-3 rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.12)]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-gold" />
        <p className="text-xs text-amber-light font-medium">Branch Member Cloud Backup</p>
        {isBranchMember && <span className="ml-auto text-xs text-gold/60 flex items-center gap-0.5"><Check size={10} /> Active</span>}
      </div>

      {/* Provider selection */}
      <div className="space-y-1.5 mb-3">
        {PROVIDERS.map(p => {
          const Icon = p.icon;
          const isSelected = provider === p.value;
          return (
            <button
              key={p.value}
              onClick={() => { setProvider(p.value); setSaved(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left ${
                isSelected
                  ? 'bg-[rgba(201,145,58,0.1)] border-[#C9913A] text-parchment'
                  : 'bg-[#0D0B0A] border-[rgba(201,145,58,0.12)] text-parchment/50 hover:border-[rgba(201,145,58,0.25)]'
              }`}
            >
              <Icon size={14} className={isSelected ? 'text-gold' : 'text-parchment/40'} />
              <span className="text-xs font-medium">{p.label}</span>
              {isSelected && <Check size={12} className="ml-auto text-gold" />}
            </button>
          );
        })}
      </div>

      {/* Folder address */}
      <input
        value={address}
        onChange={e => { setAddress(e.target.value); setSaved(false); }}
        placeholder={selectedProvider?.placeholder || 'Folder path'}
        className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded-lg px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/25"
      />
      <p className="mt-1 text-xs text-parchment/30 leading-tight">{selectedProvider?.hint}</p>

      <button
        onClick={handleSave}
        disabled={saving || !address.trim()}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <FolderUp size={12} />}
        {saving ? 'Saving...' : saved ? 'Saved — backups active' : isBranchMember ? 'Update Settings' : 'Activate Branch Membership'}
      </button>
      <p className="mt-1.5 text-xs text-parchment/30 leading-tight">
        Your full archive auto-backs up to {selectedProvider?.label} on the 1st of each month.
      </p>
    </div>
  );
}