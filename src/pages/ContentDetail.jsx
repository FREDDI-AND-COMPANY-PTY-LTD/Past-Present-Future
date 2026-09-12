import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Flag, ChevronLeft, ExternalLink, FileText, Award, Edit3, HelpCircle, FileBadge, RefreshCw, Loader2, Users, MapPinned, BookOpen } from 'lucide-react';
import RaiseQueryDialog from '@/components/RaiseQueryDialog';
import RaiseDisputeDialog from '@/components/RaiseDisputeDialog';
import ContestedFieldBadge from '@/components/ContestedFieldBadge';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import EngageButton from '@/components/EngageButton';
import EditEventDialog from '@/components/EditEventDialog';
import TranslatedText from '@/components/TranslatedText';
import HistoricalBackground from '@/components/HistoricalBackground';
import MediaPlayer from '@/components/MediaPlayer';
import CropImage from '@/components/CropImage';
import { generatePdfThumbnail, isImageUrl, isPdfUrl } from '@/lib/pdfThumbnail';

const imageTypes = ['photo', 'uncategorized', 'certificate', 'passport', 'identity_document', 'press_clipping', 'narrative', 'correspondence', 'memorial'];

export default function ContentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDispute, setShowDispute] = useState(false);
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [contestedFlags, setContestedFlags] = useState([]);
  const [reanalysingText, setReanalysingText] = useState(false);
  const [generatingThumb, setGeneratingThumb] = useState(false);

  const generateThumbnail = async () => {
    if (!item?.file_url || generatingThumb) return;
    setGeneratingThumb(true);
    try {
      const blob = await generatePdfThumbnail(item.file_url);
      const up = await base44.integrations.Core.UploadFile({ file: new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) });
      await base44.entities.ContentItem.update(item.id, { thumbnail_url: up.file_url });
      setItem(prev => ({ ...prev, thumbnail_url: up.file_url }));
    } catch (e) {}
    setGeneratingThumb(false);
  };

  const reanalyseText = async () => {
    if (reanalysingText) return;
    setReanalysingText(true);
    try {
      const res = await base44.functions.invoke('analyzeContentText', { content_item_id: id });
      if (res.data?.narrative_extraction) {
        setItem(prev => ({ ...prev, narrative_extraction: res.data.narrative_extraction }));
      }
    } catch (e) {
      // ignore — button simply returns to idle
    }
    setReanalysingText(false);
  };

  useEffect(() => {
    Promise.all([
      base44.entities.ContentItem.get(id),
      base44.entities.Ancestor.list(),
      base44.entities.ConflictFlag.filter({ content_item_id: id, flag_type: 'contested', status: 'open' }).catch(() => []),
    ]).then(([ci, ancs, flags]) => {
      setItem(ci);
      setAncestors(ancs || []);
      setContestedFlags(flags || []);
    }).catch(() => {}).finally(() => setLoading(false));
    base44.auth.me().then(setUser).catch(() => {});
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === '1') setShowEditDialog(true);
  }, []);

  const flagsForField = (fieldName) => contestedFlags.filter(f => f.field_name === fieldName);

  const taggedAncestors = (item?.ancestor_ids || [])
    .map(aid => ancestors.find(a => a.id === aid))
    .filter(Boolean);


  if (loading) {
    return <Layout><div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto"><div className="aged-card rounded-xl h-96 animate-pulse" /></div></Layout>;
  }

  if (!item) {
    return <Layout><div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto text-center"><p className="text-parchment/50">Content not found.</p><Link to="/" className="text-gold mt-4 inline-block">← Home</Link></div></Layout>;
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/timeline" className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors text-sm">
            <ChevronLeft size={16} /> Back
          </Link>
          <button
            onClick={() => setShowEditDialog(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors"
          >
            <Edit3 size={16} /> Edit Event Details
          </button>
        </div>

        <div className="aged-card rounded-2xl overflow-hidden mb-8">
          {(() => {
            const isImageFile = isImageUrl(item.file_url);
            const isPdf = isPdfUrl(item.file_url);
            const displaySrc = item.thumbnail_url || (isImageFile ? item.file_url : null);
            const isDocType = imageTypes.includes(item.content_type);
            if (displaySrc && isDocType) {
              return (
                <div className="relative bg-black/40 h-[400px] md:h-[550px] overflow-hidden">
                  <CropImage
                    src={displaySrc}
                    alt={item.title}
                    focalX={item.focal_point_x}
                    focalY={item.focal_point_y}
                    cropBounds={item.crop_bounds}
                    subjectBounds={item.subject_bounds}
                    className="w-full h-full"
                    imgClassName="sepia-tint"
                  />
                </div>
              );
            }
            if (!displaySrc && isPdf && isDocType) {
              return (
                <div className="relative bg-gradient-to-br from-[#1A1614] to-[#0D0B0A] h-[300px] md:h-[400px] overflow-hidden flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-24 rounded-md bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.3)] flex items-center justify-center">
                    <FileText size={36} className="text-gold" />
                  </div>
                  <p className="text-sm text-parchment/50">PDF document — no preview thumbnail yet</p>
                  <button
                    onClick={generateThumbnail}
                    disabled={generatingThumb}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.18)] transition-colors disabled:opacity-50"
                  >
                    {generatingThumb ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {generatingThumb ? 'Generating...' : 'Generate preview thumbnail'}
                  </button>
                </div>
              );
            }
            return null;
          })()}
          {(item.content_type === 'audio' || item.content_type === 'video') && item.file_url && (
            <div className="bg-black/40 px-6 py-10 flex items-center justify-center">
              <MediaPlayer src={item.file_url} type={item.content_type} title={item.title} />
            </div>
          )}
          {item.external_url && (
            <div className="aspect-video bg-black">
              <iframe src={item.external_url} className="w-full h-full" allowFullScreen title={item.title} />
            </div>
          )}
          <div className="p-8">
            <div className="flex items-center gap-2 mb-4">
              <h1 className="font-display text-3xl md:text-4xl text-parchment">{item.title}</h1>
              <ContestedFieldBadge flags={flagsForField('title')} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-parchment/60 mb-4">
              {item.date && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gold/60" /> {new Date(item.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
              {flagsForField('date').length > 0 && <ContestedFieldBadge flags={flagsForField('date')} />}
              {item.location_name && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gold/60" /> {item.location_name}</span>}
              {flagsForField('location_name').length > 0 && <ContestedFieldBadge flags={flagsForField('location_name')} />}
              {item.era && <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 text-xs">{item.era} <ContestedFieldBadge flags={flagsForField('era')} /></span>}
            </div>

            {(item.publication_date || item.publication_location_name) && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-parchment/50 mb-4 pb-4 border-b border-[rgba(201,145,58,0.1)]">
                <span className="text-xs text-gold/70 uppercase tracking-wider flex items-center gap-1"><FileBadge size={12} /> Issued / Published</span>
                {item.publication_date && <span className="flex items-center gap-1.5"><Calendar size={13} className="text-parchment/30" /> {new Date(item.publication_date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
                {item.publication_location_name && <span className="flex items-center gap-1.5"><MapPin size={13} className="text-parchment/30" /> {item.publication_location_name}</span>}
              </div>
            )}

            {item.description && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <ContestedFieldBadge flags={flagsForField('description')} />
                </div>
                <p className="text-parchment/70 leading-relaxed">{item.description}</p>
              </div>
            )}

            {item.transcribed_text && (
              <div className="mb-6 p-6 bg-[#0D0B0A] rounded-xl border border-[rgba(201,145,58,0.1)]">
                <div className="flex items-center gap-2 mb-3"><FileText size={16} className="text-gold" /><h3 className="font-display text-lg text-parchment">Transcribed Text</h3><ContestedFieldBadge flags={flagsForField('transcribed_text')} /></div>
                <p className="text-parchment/60 leading-relaxed whitespace-pre-wrap text-sm">{item.transcribed_text}</p>
                <TranslatedText
                  text={item.transcribed_text}
                  itemId={item.id}
                  savedTranslation={item.english_translation}
                  savedLanguage={item.translation_language}
                />
              </div>
            )}

            {item.extracted_fields && Object.keys(item.extracted_fields).length > 0 && (
              <div className="mb-6 p-6 bg-[#0D0B0A] rounded-xl border border-[rgba(201,145,58,0.1)]">
                <div className="flex items-center gap-2 mb-3"><Award size={16} className="text-gold" /><h3 className="font-display text-lg text-parchment">Extracted Certificate Data</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(item.extracted_fields).map(([key, val]) => (
                    val && <div key={key}><p className="text-xs text-parchment/40 capitalize flex items-center gap-1">{key.replace(/_/g, ' ')} <ContestedFieldBadge flags={flagsForField(`extracted_fields.${key}`)} /></p><p className="text-sm text-parchment">{String(val)}</p></div>
                  ))}
                </div>
              </div>
            )}

            {taggedAncestors.length > 0 && (
              <div className="pt-4 border-t border-[rgba(201,145,58,0.1)]">
                <p className="text-xs text-parchment/40 mb-2">Tagged Ancestors</p>
                <div className="flex flex-wrap gap-2">
                  {taggedAncestors.map(a => (
                    <Link key={a.id} to={`/ancestor/${a.id}`} className="text-sm text-amber-light bg-[rgba(201,145,58,0.08)] px-3 py-1 rounded-full hover:bg-[rgba(201,145,58,0.15)] transition-colors">
                      {a.full_name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Narrative extraction — chronicle-ready analysis of the text body */}
        {item.narrative_extraction && (
          <div className="aged-card rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-gold" />
                <h3 className="font-display text-lg text-parchment">Narrative Extraction</h3>
                <span className="text-xs text-parchment/30">chronicle-ready</span>
              </div>
              <button
                onClick={reanalyseText}
                disabled={reanalysingText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
              >
                {reanalysingText ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Re-analyse Text
              </button>
            </div>
            {item.narrative_extraction.event_description && (
              <p className="text-parchment/75 leading-relaxed mb-4">{item.narrative_extraction.event_description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-parchment/60 mb-4">
              {item.narrative_extraction.event_date_display && (
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-gold/60" /> {item.narrative_extraction.event_date_display}</span>
              )}
              {item.narrative_extraction.event_type && (
                <span className="px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 text-xs capitalize">{item.narrative_extraction.event_type}</span>
              )}
            </div>
            {item.narrative_extraction.named_people?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-parchment/40 mb-1.5 flex items-center gap-1"><Users size={11} className="text-gold/60" /> Named People</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.narrative_extraction.named_people.map((p, i) => (
                    <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.08)] px-2 py-0.5 rounded-full">
                      {p.name}{p.role ? <span className="text-parchment/40 ml-1">· {p.role}</span> : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.narrative_extraction.named_places?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-parchment/40 mb-1.5 flex items-center gap-1"><MapPinned size={11} className="text-gold/60" /> Named Places</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.narrative_extraction.named_places.map((p, i) => (
                    <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.08)] px-2 py-0.5 rounded-full">
                      {p.place}{p.context ? <span className="text-parchment/40 ml-1">· {p.context}</span> : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.narrative_extraction.chronicle_snippet && (
              <div className="pt-3 border-t border-[rgba(201,145,58,0.1)]">
                <p className="text-xs text-parchment/40 mb-1">Chronicle Snippet</p>
                <p className="text-sm text-parchment/70 italic leading-relaxed">{item.narrative_extraction.chronicle_snippet}</p>
              </div>
            )}
          </div>
        )}

        {/* Historical Background — AI-generated, researched via web search */}
        <div className="mb-6">
          <HistoricalBackground item={item} onUpdate={setItem} />
        </div>

        {/* Engage: comment or upload related event */}
        <div className="aged-card rounded-xl p-6">
          <EngageButton item={item} user={user} />
        </div>

        {showEditDialog && (
          <EditEventDialog
            item={item}
            user={user}
            onClose={() => setShowEditDialog(false)}
            onSubmitted={() => setShowEditDialog(false)}
            onDeleted={() => { setShowEditDialog(false); navigate('/timeline'); }}
          />
        )}

        {showQueryDialog && (
          <RaiseQueryDialog
            item={item}
            onClose={() => setShowQueryDialog(false)}
            onSubmitted={() => setShowQueryDialog(false)}
          />
        )}

        {/* Raise a dispute / Raise a query */}
        <div className="aged-card rounded-xl p-6 flex flex-wrap gap-4">
          <button onClick={() => setShowDispute(true)} className="flex items-center gap-2 text-amber-light/70 hover:text-amber-light transition-colors text-sm">
            <Flag size={16} /> Raise a Dispute
          </button>
          <button onClick={() => setShowQueryDialog(true)} className="flex items-center gap-2 text-amber-light/70 hover:text-amber-light transition-colors text-sm">
            <HelpCircle size={16} /> Raise a Query
          </button>
        </div>

        {showDispute && (
          <RaiseDisputeDialog
            entityType="ContentItem"
            entityId={id}
            ancestorId={taggedAncestors[0]?.id || null}
            bloodline={taggedAncestors[0]?.bloodline || ''}
            onClose={() => setShowDispute(false)}
            onSubmitted={() => setShowDispute(false)}
          />
        )}
      </div>
    </Layout>
  );
}