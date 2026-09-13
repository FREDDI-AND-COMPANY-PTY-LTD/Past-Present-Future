import React, { useState } from 'react';
import { Loader2, Check, Cloud, HardDrive, FolderUp, Shield } from 'lucide-react';
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

// Branch-scoped cloud backup setup. Each branch admin chooses where their own
// line's archive is backed up — this is the per-branch destination that keeps
// RLS-separated data in separate backups.
export default function BranchCloudBackupSetup({ branch, onSaved, compact = false }) {
  const [provider, setProvider] = useState(branch?.cloud_provider || 'google_drive');
  const [address, setAddress] = useState(branch?.cloud_folder_address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedProvider = PROVIDERS.find(p => p.value === provider);
  const isConfigured = !!branch?.cloud_folder_address;

  const handleSave = async () => {
    if (!address.trim() || !branch?.id) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await base44.entities.Branch.update(branch.id, {
        cloud_provider: provider,
        cloud_folder_address: address.trim(),
      });
      setSaved(true);
      if (onSaved) onSaved({ ...branch, cloud_provider: provider, cloud_folder_address: address.trim() });
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className={compact ? '' : 'rounded-lg bg-[rgba(201,145,58,0.04)] border border-[rgba(201,145,58,0.15)] p-4'}>
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-gold" />
        <p className="text-sm text-amber-light font-medium">
          {isConfigured ? 'Branch Cloud Backup' : 'Set Up Branch Cloud Backup'}
        </p>
        {isConfigured && <span className="ml-auto text-xs text-gold/60 flex items-center gap-0.5"><Check size={10} /> Active</span>}
      </div>

      <p className="text-xs text-parchment/50 mb-3 leading-relaxed">
        Your branch's archive backs up to your own cloud folder — separate from every other branch. This keeps each bloodline's data isolated in its own backup, matching the branch-level access controls.
      </p>

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
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <FolderUp size={14} />}
        {saving ? 'Saving...' : saved ? 'Saved — backups active' : isConfigured ? 'Update Backup Settings' : 'Activate Branch Backup'}
      </button>
    </div>
  );
}