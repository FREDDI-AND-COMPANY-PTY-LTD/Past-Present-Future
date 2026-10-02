import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, MapPin, Image, FileText, Newspaper, Video, Award, Calendar, BookUser, IdCard, Mail, Heart, Baby, Home } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import EngageButton from '@/components/EngageButton';
import { useBranchRoot } from '@/hooks/useBranchRoot';
import BranchScopeToggle from '@/components/BranchScopeToggle';

const typeIcons = {
  photo: Image,
  story: FileText,
  press_clipping: Newspaper,
  video: Video,
  certificate: Award,
  narrative: FileText,
  passport: BookUser,
  identity_document: IdCard,
  correspondence: Mail,
  memorial: Heart,
  ancestor_birth: Baby,
  ancestor_death: Heart,
  ancestor_residence: Home,
};

export default function TimelinePage() {
  const [items, setItems] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverse, setReverse] = useState(true);
  const [scope, setScope] = useState('branch');
  const [user, setUser] = useState(null);
  const { descendantIds, loading: branchLoading } = useBranchRoot();

  useEffect(() => {
    Promise.all([
      base44.entities.ContentItem.filter({}),
      base44.entities.Ancestor.list(),
    ]).then(([ci, ancs]) => {
      setItems(ci || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Only show admin-reviewed content on the public timeline
  const reviewedItems = items.filter(i => i.review_status === 'reviewed' && !i.parent_content_item_id);
  const branchScoped = scope === 'branch' && descendantIds.size > 0;
  const branchItems = branchScoped
    ? reviewedItems.filter(i => (i.ancestor_ids || []).some(aid => descendantIds.has(aid)))
    : reviewedItems;

  const branchAncestors = branchScoped
    ? ancestors.filter(a => descendantIds.has(a.id))
    : ancestors;

  // Ancestor life events (birth/death) from existing genealogical data —
  // populates the timeline alongside dated content items.
  const lifeEvents = branchAncestors
    .filter(a => a.birth_date || a.death_date || (a.living !== false && a.residence_place))
    .flatMap(a => {
      const events = [];
      if (a.birth_date) events.push({
        id: `birth-${a.id}`, date: a.birth_date, title: `${a.full_name} — Born`,
        location_name: a.birth_place, content_type: 'ancestor_birth', ancestor_id: a.id,
      });
      if (a.death_date) events.push({
        id: `death-${a.id}`, date: a.death_date, title: `${a.full_name} — Passed Away`,
        location_name: a.death_place, content_type: 'ancestor_death', ancestor_id: a.id,
      });
      if (a.living !== false && a.residence_place) events.push({
        id: `residence-${a.id}`, date: new Date().toISOString().slice(0, 10), title: `${a.full_name} — Lives in ${a.residence_place}`,
        location_name: a.residence_place, content_type: 'ancestor_residence', ancestor_id: a.id,
      });
      return events;
    });

  const sorted = [...branchItems.filter(i => i.date), ...lifeEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!reverse) sorted.reverse();

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-5xl text-parchment mb-2">Timeline</h1>
            <p className="text-parchment/50 text-sm">The Freddi family story, in chronological order.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <BranchScopeToggle value={scope} onChange={setScope} />
            <button
              onClick={() => setReverse(!reverse)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.25)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors"
            >
              <ArrowDownUp size={16} />
              {reverse ? 'Present → Earliest' : 'Earliest → Present'}
            </button>
          </div>
        </div>

        {(loading || branchLoading) ? (
          <div className="space-y-6">{[1,2,3].map(i => <div key={i} className="aged-card rounded-xl h-32 animate-pulse" />)}</div>
        ) : sorted.length > 0 ? (
          <div className="relative">
            {/* Vertical rail */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[rgba(201,145,58,0.4)] via-[rgba(201,145,58,0.15)] to-transparent md:-translate-x-px" />

            <div className="space-y-8">
              {sorted.map((item, idx) => {
                const isLifeEvent = item.content_type === 'ancestor_birth' || item.content_type === 'ancestor_death' || item.content_type === 'ancestor_residence';
                const Icon = typeIcons[item.content_type] || FileText;
                const tagged = isLifeEvent ? [] : (item.ancestor_ids || []).map(aid => branchAncestors.find(a => a.id === aid)).filter(Boolean);
                const isLeft = idx % 2 === 0;

                return (
                  <div key={item.id} className={`relative flex items-start gap-6 ${isLeft ? 'md:flex-row-reverse' : ''}`}>
                    {/* Node */}
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 mt-3">
                      <div className="w-4 h-4 rounded-full bg-[#C9913A] border-2 border-[#0D0B0A] gold-glow" />
                    </div>

                    {/* Card */}
                    <div className="ml-12 md:ml-0 md:w-[calc(50%-2rem)]">
                      <Link to={isLifeEvent ? `/ancestor/${item.ancestor_id}` : `/content/${item.id}`} className="block aged-card rounded-xl p-5 hover:border-[rgba(201,145,58,0.4)] transition-all duration-300 group">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-[rgba(201,145,58,0.1)] flex items-center justify-center border border-[rgba(201,145,58,0.15)]">
                            <Icon size={14} className="text-gold" />
                          </div>
                          <span className="flex items-center gap-1 text-xs text-amber-light/70">
                            <Calendar size={12} />
                            {new Date(item.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="font-display text-lg text-parchment group-hover:text-gold transition-colors mb-1">{item.title}</h3>
                        {!isLifeEvent && item.description && <p className="text-sm text-parchment/50 line-clamp-2">{item.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-parchment/40">
                          {item.location_name && <span className="flex items-center gap-1"><MapPin size={11} /> {item.location_name}</span>}
                          {tagged.map(a => <span key={a.id} className="text-amber-light/60">{a.full_name}</span>)}
                        </div>
                      </Link>
                      {!isLifeEvent && (
                        <div className="mt-2">
                          <EngageButton item={item} user={user} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="aged-card rounded-xl p-12 text-center">
            <p className="text-parchment/50">No dated content in the archive yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}