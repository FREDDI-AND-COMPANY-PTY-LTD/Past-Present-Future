import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, ExternalLink, FileText, Quote, ScrollText, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { resolveSourceRecord } from '@/lib/sourceDocument';

const isPdfUrl = (url) => /\.pdf(?:$|\?)/i.test(url || '');
const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/i.test(url || '');

/**
 * Opens the originating document for a record so an approver can see exactly
 * what is being approved. Accepts either a loaded `item` or an `itemId` to fetch.
 * Text-only records resolve back to the scanned volume their text was read from.
 */
export default function SourceDocumentDialog({ item, itemId, onClose }) {
  const [record, setRecord] = useState(item || null);
  const [loading, setLoading] = useState(!item && !!itemId);
  const [source, setSource] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (item) { setRecord(item); setLoading(false); return; }
    if (!itemId) return;
    let alive = true;
    setLoading(true);
    base44.entities.ContentItem.get(itemId)
      .then((r) => { if (alive) setRecord(r); })
      .catch(() => { if (alive) setRecord(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item, itemId]);

  useEffect(() => {
    if (!record || record.file_url) { setSource(null); return; }
    let alive = true;
    setResolving(true);
    resolveSourceRecord(record)
      .then((s) => { if (alive) setSource(s); })
      .catch(() => { if (alive) setSource(null); })
      .finally(() => { if (alive) setResolving(false); });
    return () => { alive = false; };
  }, [record]);

  const fileUrl = record?.file_url || record?.external_url || '';
  const transcript = record?.transcribed_text || record?.description || '';
  const scannedVolume = source?.scans;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 animate-fade-in overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="aged-card rounded-2xl w-full max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(201,145,58,0.2)] sticky top-0 bg-[#1A1614] z-10">
            <ScrollText size={18} className="text-gold flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-parchment/40">Originating evidence</p>
              <h2 className="font-display text-lg text-parchment truncate">
                {record?.ref_code && <span className="text-amber-light mr-2">{record.ref_code}</span>}
                {record?.title || 'Source document'}
              </h2>
            </div>
            <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors flex-shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={24} className="text-gold animate-spin" /></div>
            ) : !record ? (
              <p className="text-sm text-parchment/50 py-8 text-center">This source record could not be opened.</p>
            ) : (
              <div className="space-y-4">
                {fileUrl ? (
                  isPdfUrl(fileUrl) ? (
                    <iframe src={fileUrl} title={record.title || 'Source document'} className="w-full rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]" style={{ height: '65vh' }} />
                  ) : isImageUrl(fileUrl) ? (
                    <img src={fileUrl} alt={record.title || ''} className="w-full max-h-[65vh] object-contain rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)]" />
                  ) : (
                    <div className="rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] p-6 text-center">
                      <FileText size={26} className="text-gold/60 mx-auto mb-2" />
                      <p className="text-sm text-parchment/50">This evidence is not an image or PDF. Open it to view the original.</p>
                    </div>
                  )
                ) : resolving ? (
                  <div className="flex justify-center py-10"><Loader2 size={20} className="text-gold animate-spin" /></div>
                ) : scannedVolume ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] px-4 py-3">
                      <p className="text-xs text-parchment/60">
                        This entry carries no scan of its own — its text was read from the correspondence scans
                        {source?.reference ? <> and is filed at <span className="text-amber-light font-medium">{source.reference}</span></> : ''}.
                        The scanned originals are open below so you can check it.
                      </p>
                      {source?.letters?.length > 0 && (
                        <p className="text-xs text-parchment/40 mt-1.5">
                          Read from: {source.letters.map((l) => `${l.fv}${l.ref ? ` (scan ${l.ref})` : ''}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <iframe src={scannedVolume.file_url} title={scannedVolume.title || 'Scanned originals'} className="w-full rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]" style={{ height: '55vh' }} />
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] px-4 py-3">
                    <p className="text-xs text-parchment/50">
                      No file is attached to this record — it was entered from text, statement or memory rather than a scanned document.
                    </p>
                  </div>
                )}

                {!fileUrl && transcript && (
                  <div className="rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] p-4">
                    <p className="text-[11px] uppercase tracking-wider text-parchment/40 mb-1.5 flex items-center gap-1.5">
                      <Quote size={11} /> Recorded text
                    </p>
                    <p className="text-sm text-parchment/70 whitespace-pre-wrap">{transcript}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(fileUrl || scannedVolume?.file_url) && (
                    <a href={fileUrl || scannedVolume.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors">
                      <ExternalLink size={13} /> Open in new tab
                    </a>
                  )}
                  {!fileUrl && source?.transcript?.file_url && (
                    <a href={source.transcript.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:text-amber-light transition-colors">
                      <BookOpen size={13} /> Open transcript
                    </a>
                  )}
                  {record.id && (
                    <Link to={`/content/${record.id}`} onClick={onClose}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)] text-parchment/60 text-xs hover:text-amber-light transition-colors">
                      Open full record
                    </Link>
                  )}
                  <button onClick={onClose}
                    className="ml-auto px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-xs font-semibold hover:opacity-90 transition-opacity">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}