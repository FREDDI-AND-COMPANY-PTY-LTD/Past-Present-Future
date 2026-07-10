import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Flag, ChevronLeft, ExternalLink, FileText, Award, Edit3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import EngageButton from '@/components/EngageButton';
import EditEventDialog from '@/components/EditEventDialog';
import TranslatedText from '@/components/TranslatedText';
import HistoricalBackground from '@/components/HistoricalBackground';

export default function ContentDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagText, setFlagText] = useState('');
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ContentItem.get(id),
      base44.entities.Ancestor.list(),
    ]).then(([ci, ancs]) => {
      setItem(ci);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
    base44.auth.me().then(setUser).catch(() => {});
  }, [id]);

  const taggedAncestors = (item?.ancestor_ids || [])
    .map(aid => ancestors.find(a => a.id === aid))
    .filter(Boolean);

  const handleFlagSubmit = async () => {
    if (!flagText.trim()) return;
    try {
      await base44.entities.ConflictFlag.create({
        content_item_id: id,
        dispute_description: flagText,
        status: 'open',
      });
      setFlagSubmitted(true);
      setFlagText('');
    } catch (e) {}
  };

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
          {item.file_url && (item.content_type === 'photo' || item.content_type === 'uncategorized') && (
            <div className="relative bg-black/40">
              <img src={item.file_url} alt={item.title} className="w-full max-h-[600px] object-contain sepia-tint" />
            </div>
          )}
          {item.external_url && (
            <div className="aspect-video bg-black">
              <iframe src={item.external_url} className="w-full h-full" allowFullScreen title={item.title} />
            </div>
          )}
          <div className="p-8">
            <h1 className="font-display text-3xl md:text-4xl text-parchment mb-4">{item.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-parchment/60 mb-4">
              {item.date && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gold/60" /> {new Date(item.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
              {item.location_name && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gold/60" /> {item.location_name}</span>}
              {item.era && <span className="px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/70 text-xs">{item.era}</span>}
            </div>

            {item.description && <p className="text-parchment/70 leading-relaxed mb-6">{item.description}</p>}

            {item.transcribed_text && (
              <div className="mb-6 p-6 bg-[#0D0B0A] rounded-xl border border-[rgba(201,145,58,0.1)]">
                <div className="flex items-center gap-2 mb-3"><FileText size={16} className="text-gold" /><h3 className="font-display text-lg text-parchment">Transcribed Text</h3></div>
                <p className="text-parchment/60 leading-relaxed whitespace-pre-wrap text-sm">{item.transcribed_text}</p>
                <TranslatedText text={item.transcribed_text} />
              </div>
            )}

            {item.extracted_fields && Object.keys(item.extracted_fields).length > 0 && (
              <div className="mb-6 p-6 bg-[#0D0B0A] rounded-xl border border-[rgba(201,145,58,0.1)]">
                <div className="flex items-center gap-2 mb-3"><Award size={16} className="text-gold" /><h3 className="font-display text-lg text-parchment">Extracted Certificate Data</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(item.extracted_fields).map(([key, val]) => (
                    val && <div key={key}><p className="text-xs text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</p><p className="text-sm text-parchment">{String(val)}</p></div>
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
            onClose={() => setShowEditDialog(false)}
            onSubmitted={() => setShowEditDialog(false)}
          />
        )}

        {/* Flag conflict */}
        <div className="aged-card rounded-xl p-6">
          <button onClick={() => setShowFlagForm(!showFlagForm)} className="flex items-center gap-2 text-amber-light/70 hover:text-amber-light transition-colors text-sm">
            <Flag size={16} /> Flag a Conflict on this item
          </button>
          {showFlagForm && (
            <div className="mt-4">
              {flagSubmitted ? (
                <p className="text-amber-light text-sm">✓ Conflict flag submitted for review.</p>
              ) : (
                <div>
                  <textarea value={flagText} onChange={e => setFlagText(e.target.value)} rows={3}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A]"
                    placeholder="What is disputed? What is the correct information?" />
                  <button onClick={handleFlagSubmit} className="mt-3 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90">Submit Flag</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}