import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Calendar, MapPin, ArrowDownUp, Baby, Heart, Image as ImageIcon, FileText, Newspaper, Video, Award, BookUser, IdCard, Mail, Loader2, Sparkles, Home } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';
import ContentCard from '@/components/ContentCard';
import { formatAncestorName } from '@/lib/ancestorName';

const typeIcons = {
  photo: ImageIcon,
  story: FileText,
  press_clipping: Newspaper,
  video: Video,
  certificate: Award,
  narrative: FileText,
  passport: BookUser,
  identity_document: IdCard,
  correspondence: Mail,
  memorial: Heart,
  uncategorized: FileText,
};

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDate(d) {
  const dt = parseDate(d);
  if (!dt) return d || '';
  return dt.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function yearOf(d) {
  const dt = parseDate(d);
  return dt ? dt.getFullYear() : null;
}

export default function AncestorTimeline() {
  const { id } = useParams();
  const [ancestor, setAncestor] = useState(null);
  const [allAncestors, setAllAncestors] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverse, setReverse] = useState(false); // earliest → present by default

  useEffect(() => {
    Promise.all([
      base44.entities.Ancestor.get(id),
      base44.entities.Ancestor.list(),
      base44.entities.ContentItem.filter({}),
    ]).then(([anc, ancs, ci]) => {
      setAncestor(anc);
      setAllAncestors(ancs || []);
      setItems((ci || []).filter(i => i.ancestor_ids?.includes(id) && !i.parent_content_item_id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
          <div className="flex justify-center py-24"><Loader2 size={28} className="text-gold animate-spin" /></div>
        </div>
      </Layout>
    );
  }

  if (!ancestor) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto text-center">
          <p className="text-parchment/50">Ancestor not found.</p>
          <Link to="/ancestors" className="text-gold mt-4 inline-block">← Back to Ancestors</Link>
        </div>
      </Layout>
    );
  }

  const partner = allAncestors.find(a => a.id === ancestor.partner_id) || null;
  const mother = allAncestors.find(a => a.id === ancestor.mother_id) || null;
  const father = allAncestors.find(a => a.id === ancestor.father_id) || null;

  // Build chronological milestones — biographical + every dated record.
  const milestones = [];
  if (ancestor.birth_date) {
    milestones.push({ id: 'birth', date: ancestor.birth_date, kind: 'birth', title: 'Born', location: ancestor.birth_place });
  }
  items.forEach(item => {
    if (item.date) milestones.push({ id: item.id, date: item.date, kind: 'content', item });
  });
  if (ancestor.death_date) {
    milestones.push({ id: 'death', date: ancestor.death_date, kind: 'death', title: 'Passed Away', location: ancestor.death_place });
  }
  if (ancestor.living !== false && ancestor.residence_place) {
    milestones.push({ id: 'residence', date: new Date().toISOString().slice(0, 10), kind: 'residence', title: `Lives in ${ancestor.residence_place}`, location: ancestor.residence_place });
  }

  const dated = milestones
    .map(m => ({ ...m, _dt: parseDate(m.date) }))
    .filter(m => m._dt)
    .sort((a, b) => a._dt - b._dt);
  if (reverse) dated.reverse();

  const undated = items.filter(i => !i.date);
  const bio = ancestor.ai_biography || ancestor.biography || '';
  const lifeSpan = `${yearOf(ancestor.birth_date) ?? '?'} – ${ancestor.death_date ? (yearOf(ancestor.death_date) ?? '?') : ancestor.living ? 'present' : '?'}`;

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
        {/* Back + actions */}
        <div className="flex items-center justify-between mb-6">
          <Link to={`/ancestor/${id}`} className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors text-sm">
            <ChevronLeft size={16} /> Back to Profile
          </Link>
          <button
            onClick={() => setReverse(r => !r)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors"
          >
            <ArrowDownUp size={16} />
            {reverse ? 'Earliest → Present' : 'Present → Earliest'}
          </button>
        </div>

        {/* Life header */}
        <div className="aged-card rounded-2xl p-8 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="flex-shrink-0">
              <AncestorAvatar ancestor={ancestor} size="xl" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="font-display text-4xl text-parchment mb-1">{formatAncestorName(ancestor)}</h1>
              <p className="text-amber-light/70 text-lg mb-3">{lifeSpan}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center sm:justify-start text-sm text-parchment/60">
                {ancestor.birth_place && <span className="flex items-center gap-1"><MapPin size={13} /> Born in {ancestor.birth_place}</span>}
                {ancestor.living !== false && ancestor.residence_place && <span className="flex items-center gap-1"><Home size={13} /> Lives in {ancestor.residence_place}</span>}
                {ancestor.nationality && <span>{ancestor.nationality}</span>}
                {partner && <span className="flex items-center gap-1"><Heart size={13} /> {partner.full_name}</span>}
              </div>
              {(mother || father) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center sm:justify-start text-xs text-parchment/40 mt-2">
                  {mother && <span>Mother: {mother.full_name}</span>}
                  {father && <span>Father: {father.full_name}</span>}
                </div>
              )}
            </div>
          </div>
          {bio && (
            <div className="mt-6 pt-6 border-t border-[rgba(201,145,58,0.1)]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-gold" />
                <span className="text-xs uppercase tracking-wider text-parchment/40">Life Story</span>
              </div>
              <p className="text-sm text-parchment/70 leading-relaxed whitespace-pre-wrap">{bio}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        {dated.length > 0 ? (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[rgba(201,145,58,0.4)] via-[rgba(201,145,58,0.15)] to-transparent" />
            <div className="space-y-6">
              {dated.map(m => {
                const isLife = m.kind === 'birth' || m.kind === 'death' || m.kind === 'residence';
                const Icon = isLife ? (m.kind === 'birth' ? Baby : m.kind === 'death' ? Heart : Home) : (typeIcons[m.item.content_type] || FileText);
                const to = isLife ? `/ancestor/${id}` : `/content/${m.item.id}`;
                const title = isLife ? m.title : m.item.title;
                return (
                  <div key={m.id} className="relative flex items-start gap-6 pl-0">
                    <div className="absolute left-4 -translate-x-1/2 z-10 mt-3">
                      <div className={`w-4 h-4 rounded-full border-2 border-[#0D0B0A] gold-glow ${isLife ? 'bg-[#E8C97A]' : 'bg-[#C9913A]'}`} />
                    </div>
                    <div className="ml-12 w-full">
                      <Link to={to} className="block aged-card rounded-xl p-5 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-[rgba(201,145,58,0.1)] flex items-center justify-center border border-[rgba(201,145,58,0.15)]">
                            <Icon size={14} className="text-gold" />
                          </div>
                          <span className="flex items-center gap-1 text-xs text-amber-light/70">
                            <Calendar size={12} />
                            {formatDate(m.date)}
                          </span>
                          {isLife && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)] uppercase tracking-wider">Milestone</span>}
                        </div>
                        <h3 className="font-display text-lg text-parchment group-hover:text-gold transition-colors mb-1">{title}</h3>
                        {!isLife && m.item.description && <p className="text-sm text-parchment/50 line-clamp-2">{m.item.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-parchment/40">
                          {m.location && <span className="flex items-center gap-1"><MapPin size={11} /> {m.location}</span>}
                          {!isLife && m.item.location_name && <span className="flex items-center gap-1"><MapPin size={11} /> {m.item.location_name}</span>}
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="aged-card rounded-xl p-12 text-center">
            <p className="text-parchment/50">No dated events recorded for this ancestor yet.</p>
          </div>
        )}

        {/* Undated records */}
        {undated.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl text-parchment mb-4">Other Records</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {undated.map(item => <ContentCard key={item.id} item={item} ancestors={allAncestors} />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}