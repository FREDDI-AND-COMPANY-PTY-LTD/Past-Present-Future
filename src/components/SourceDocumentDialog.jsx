import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, ExternalLink, FileText, Quote, ScrollText, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { resolveSourceRecord } from '@/lib/sourceDocument';
import { VOLUME_PAGE_COUNT } from '@/lib/correspondencePageIndex';

const isPdfUrl = (url) => /\.pdf(?:$|\?)/i.test(url || '');
const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/i.test(url || '');
const withPage = (url, page) => (url && page ? `${url.split('#')[0]}#page=${page}` : url || '');

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
  const [page, setPage] = useState(1);

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
      .then((s) => {
        if (!alive) return;
        setSource(s);
        setPage(s?.location?.volumePage || 1);
      })
      .catch(() => { if (alive) setSource(null); })
      .finally(() => { if (alive) setResolving(false); });
    return () => { alive = false; };
  }, [record]);

  const fileUrl = record?.file_url || record?.external_url || '';
  const transcript = record?.transcribed_text || record?.description || '';
  const scannedVolume = source?.scans;
  const location = source?.location || null;

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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-parchment/50">
                        {location?.bundle ? (
                          <>Bundle {location.bundle} page {String(location.page).padStart(2, '0')}{location.page2 ? `–${String(location.page2).padStart(2, '0')}` : ''} — opened at volume page <span className="text-amber-light font-medium">{page}</span> of {VOLUME_PAGE_COUNT}</>
                        ) : location?.volumePage ? (
                          <>{location.letter ? <>{location.letter} — </> : null}volume page <span className="text-amber-light font-medium">{page}</span>{location.volumePage2 ? `–${location.volumePage2}` : ''} of {VOLUME_PAGE_COUNT}</>
                        ) : (
                          <>Page <span className="text-amber-light font-medium">{page}</span> of {VOLUME_PAGE_COUNT}</>
                        )}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                          className="px-2.5 py-1 rounded-md border border-[rgba(201,145,58,0.2)] text-amber-light/80 text-xs disabled:opacity-30 hover:bg-[rgba(201,145,58,0.1)] transition-colors">‹</button>
                        <button onClick={() => setPage((p) => Math.min(VOLUME_PAGE_COUNT, p + 1))} disabled={page >= VOLUME_PAGE_COUNT}
                          className="px-2.5 py-1 rounded-md border border-[rgba(201,145,58,0.2)] text-amber-light/80 text-xs disabled:opacity-30 hover:bg-[rgba(201,145,58,0.1)] transition-colors">›</button>
                      </div>
                    </div>
                    <iframe key={page} src={withPage(scannedVolume.file_url, page)} title={scannedVolume.title || 'Scanned originals'} className="w-full rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]" style={{ height: '55vh' }} />
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
                    <a href={fileUrl || withPage(scannedVolume.file_url, page)} target="_blank" rel="noopener noreferrer"
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