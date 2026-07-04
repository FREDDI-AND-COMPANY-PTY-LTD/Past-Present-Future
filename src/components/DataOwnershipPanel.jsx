import React, { useState } from 'react';
import { Shield, Cloud, Loader2, Check, AlertCircle, FileJson, Image, Database, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DataOwnershipPanel() {
  const [backingUp, setBackingUp] = useState(false);
  const [result, setResult] = useState(null);

  const handleBackup = async () => {
    setBackingUp(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('fullArchiveBackup', {});
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.response?.data?.error || e.message || 'Backup failed — please try again.' });
    }
    setBackingUp(false);
  };

  return (
    <div className="aged-card rounded-xl p-6 mb-6 border-[rgba(201,145,58,0.25)]">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center flex-shrink-0">
          <Shield size={24} className="text-gold" />
        </div>
        <div>
          <h2 className="font-display text-xl text-parchment">Your Data, Your Archive</h2>
          <p className="text-sm text-parchment/50 mt-1 leading-relaxed">
            Every photo, document, certificate, and record belongs to you. Export your complete family archive to your Google Drive at any time — all media files, structured data, and AI analysis included. If you ever leave, you take everything with you. You simply lose the interactive social media experience.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
          <Database size={16} className="text-gold/70 flex-shrink-0" />
          <span className="text-xs text-parchment/60 leading-tight">All structured records & AI analysis (JSON)</span>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
          <Image size={16} className="text-gold/70 flex-shrink-0" />
          <span className="text-xs text-parchment/60 leading-tight">All photos, certificates & documents</span>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
          <FileJson size={16} className="text-gold/70 flex-shrink-0" />
          <span className="text-xs text-parchment/60 leading-tight">Reconstructable tree, map & timeline</span>
        </div>
      </div>

      <button
        onClick={handleBackup}
        disabled={backingUp}
        className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 gold-glow"
      >
        {backingUp ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
        {backingUp ? 'Backing up to Google Drive...' : 'Download Complete Archive to Cloud'}
      </button>

      <div className="flex items-center gap-1.5 mt-3 text-xs text-parchment/30">
        <Clock size={12} />
        <span>Creates a dated snapshot in your Google Drive — run before your subscription expires to take everything with you.</span>
      </div>

      {result && !result.error && (
        <div className="mt-5 p-4 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2 mb-3">
            <Check size={18} className="text-gold" />
            <p className="text-sm text-parchment font-medium">Backup complete — saved to {result.backup_folder}</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs mb-3">
            {Object.entries(result.counts || {}).map(([key, val]) => (
              <div key={key} className="p-2 rounded bg-[#0D0B0A]">
                <p className="text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-amber-light font-medium text-base">{val}</p>
              </div>
            ))}
          </div>
          {result.media && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-parchment/50 pt-2 border-t border-[rgba(201,145,58,0.1)]">
              <span className="flex items-center gap-1"><Check size={12} className="text-gold" /> {result.media.success} media files uploaded</span>
              {result.media.failed > 0 && (
                <span className="flex items-center gap-1 text-red-300"><AlertCircle size={12} /> {result.media.failed} file(s) could not be uploaded</span>
              )}
              <span className="text-parchment/30">JSON data file saved as <code className="text-amber-light/60">archive_data.json</code></span>
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="mt-5 p-4 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{result.error}</p>
        </div>
      )}
    </div>
  );
}