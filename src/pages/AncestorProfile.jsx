import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Globe, Heart, FileText, Award, Flag, ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';
import ContentCard from '@/components/ContentCard';

export default function AncestorProfile() {
  const { id } = useParams();
  const [ancestor, setAncestor] = useState(null);
  const [parents, setParents] = useState({ mother: null, father: null });
  const [partner, setPartner] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [allAncestors, setAllAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagText, setFlagText] = useState('');
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Ancestor.get(id),
      base44.entities.Ancestor.list(),
      base44.entities.ContentItem.filter({}),
    ]).then(([anc, ancs, items]) => {
      setAncestor(anc);
      setAllAncestors(ancs || []);
      const mother = ancs?.find(a => a.id === anc.mother_id) || null;
      const father = ancs?.find(a => a.id === anc.father_id) || null;
      const part = ancs?.find(a => a.id === anc.partner_id) || null;
      setParents({ mother, father });
      setPartner(part);
      const tagged = (items || []).filter(item =>
        item.ancestor_ids?.includes(id)
      );
      setContentItems(tagged);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleFlagSubmit = async () => {
    if (!flagText.trim()) return;
    try {
      await base44.entities.ConflictFlag.create({
        ancestor_id: id,
        dispute_description: flagText,
        status: 'open',
        bloodline: ancestor?.bloodline || '',
      });
      setFlagSubmitted(true);
      setFlagText('');
    } catch (e) {
      // error
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto">
          <div className="aged-card rounded-xl h-96 animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!ancestor) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto text-center">
          <p className="text-parchment/50">Ancestor not found.</p>
          <Link to="/ancestors" className="text-gold mt-4 inline-block">← Back to Ancestors</Link>
        </div>
      </Layout>
    );
  }

  const lifeSpan = `${ancestor.birth_date ? new Date(ancestor.birth_date).getFullYear() : '?'} – ${ancestor.death_date ? new Date(ancestor.death_date).getFullYear() : ancestor.living ? 'present' : '?'}`;

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto">
        <Link to="/ancestors" className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors mb-6 text-sm">
          <ChevronLeft size={16} /> All Ancestors
        </Link>

        {/* Profile header */}
        <div className="aged-card rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0 flex justify-center">
              <AncestorAvatar ancestor={ancestor} size="xl" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <h1 className="font-display text-4xl text-parchment">{ancestor.full_name}</h1>
                {ancestor.living ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)]">Living</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(245,236,215,0.05)] text-parchment/50 border border-[rgba(245,236,215,0.1)]">In Memoriam</span>
                )}
              </div>
              <p className="text-amber-light/70 text-lg mb-4">{lifeSpan}</p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-parchment/60">
                {ancestor.nationality && (
                  <span className="flex items-center gap-1.5"><Globe size={14} className="text-gold/60" /> {ancestor.nationality}</span>
                )}
                {ancestor.birth_place && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gold/60" /> {ancestor.birth_place}</span>
                )}
                {ancestor.bloodline && (
                  <span className="flex items-center gap-1.5"><Heart size={14} className="text-gold/60" /> {ancestor.bloodline}</span>
                )}
              </div>
              {ancestor.biography && (
                <p className="text-parchment/70 mt-4 leading-relaxed">{ancestor.biography}</p>
              )}
            </div>
          </div>
        </div>

        {/* Family connections */}
        {(parents.mother || parents.father || partner) && (
          <div className="aged-card rounded-2xl p-6 mb-8">
            <h2 className="font-display text-2xl text-parchment mb-4">Family Connections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {parents.mother && (
                <Link to={`/ancestor/${parents.mother.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <AncestorAvatar ancestor={parents.mother} size="sm" />
                  <div>
                    <p className="text-xs text-parchment/40">Mother</p>
                    <p className="text-sm text-parchment">{parents.mother.full_name}</p>
                  </div>
                </Link>
              )}
              {parents.father && (
                <Link to={`/ancestor/${parents.father.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <AncestorAvatar ancestor={parents.father} size="sm" />
                  <div>
                    <p className="text-xs text-parchment/40">Father</p>
                    <p className="text-sm text-parchment">{parents.father.full_name}</p>
                  </div>
                </Link>
              )}
              {partner && (
                <Link to={`/ancestor/${partner.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <AncestorAvatar ancestor={partner} size="sm" />
                  <div>
                    <p className="text-xs text-parchment/40">Partner</p>
                    <p className="text-sm text-parchment">{partner.full_name}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        {(ancestor.birth_certificate || ancestor.marriage_certificate) && (
          <div className="aged-card rounded-2xl p-6 mb-8">
            <h2 className="font-display text-2xl text-parchment mb-4">Documents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ancestor.birth_certificate && (
                <a href={ancestor.birth_certificate} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)] transition-colors">
                  <Award size={24} className="text-gold" />
                  <div>
                    <p className="text-sm text-parchment">Birth Certificate</p>
                    <p className="text-xs text-parchment/40">View document</p>
                  </div>
                </a>
              )}
              {ancestor.marriage_certificate && (
                <a href={ancestor.marriage_certificate} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)] transition-colors">
                  <Award size={24} className="text-gold" />
                  <div>
                    <p className="text-sm text-parchment">Marriage Certificate</p>
                    <p className="text-xs text-parchment/40">View document</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Content gallery */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-parchment">Gallery</h2>
            <button
              onClick={() => setShowFlagForm(!showFlagForm)}
              className="flex items-center gap-1.5 text-sm text-amber-light/70 hover:text-amber-light transition-colors"
            >
              <Flag size={14} /> Flag a Conflict
            </button>
          </div>

          {showFlagForm && (
            <div className="aged-card rounded-xl p-6 mb-6">
              {flagSubmitted ? (
                <p className="text-amber-light text-sm">✓ Conflict flag submitted. The Elder of this bloodline and Admin will review it.</p>
              ) : (
                <div>
                  <p className="text-parchment/60 text-sm mb-3">Describe what you believe is incorrect about this ancestor's data:</p>
                  <textarea
                    value={flagText}
                    onChange={e => setFlagText(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-parchment text-sm focus:outline-none focus:border-[#C9913A]"
                    placeholder="What is the correct information?"
                  />
                  <button onClick={handleFlagSubmit} className="mt-3 px-5 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
                    Submit Flag
                  </button>
                </div>
              )}
            </div>
          )}

          {contentItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contentItems.map(item => (
                <ContentCard key={item.id} item={item} ancestors={allAncestors} />
              ))}
            </div>
          ) : (
            <div className="aged-card rounded-xl p-8 text-center">
              <p className="text-parchment/50 text-sm">No content has been tagged to this ancestor yet.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}