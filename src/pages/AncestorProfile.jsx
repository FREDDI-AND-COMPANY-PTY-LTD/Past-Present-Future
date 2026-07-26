import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Globe, Heart, FileText, Award, Flag, ChevronLeft, BookUser, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';
import ContentCard from '@/components/ContentCard';
import SourcedField from '@/components/SourcedField';
import AncestorEditDialog from '@/components/AncestorEditDialog';
import RaiseDisputeDialog from '@/components/RaiseDisputeDialog';
import { formatAncestorName } from '@/lib/ancestorName';
import BirthBranchLink from '@/components/BirthBranchLink';

export default function AncestorProfile() {
  const { id } = useParams();
  const [ancestor, setAncestor] = useState(null);
  const [parents, setParents] = useState({ mother: null, father: null });
  const [partner, setPartner] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [allAncestors, setAllAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDispute, setShowDispute] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === '1') setEditOpen(true);
  }, []);

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
        <div className="flex items-center justify-between mb-6">
          <Link to="/ancestors" className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors text-sm">
            <ChevronLeft size={16} /> All Ancestors
          </Link>
          {currentUser?.role === 'admin' && (
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors">
              <Pencil size={14} /> Edit Profile
            </button>
          )}
        </div>

        {/* Profile header */}
        <div className="aged-card rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0 flex justify-center">
              <AncestorAvatar ancestor={ancestor} size="xl" />
            </div>
            <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2 flex-wrap">
              <h1 className="font-display text-4xl text-parchment">
                {formatAncestorName(ancestor)}
                <span className="inline-flex ml-2 align-middle">
                  <SourcedField entityType="Ancestor" entityId={id} fieldName="full_name" label="Full Name" value="" />
                </span>
              </h1>
                {ancestor.living ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)]">Living</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(245,236,215,0.05)] text-parchment/50 border border-[rgba(245,236,215,0.1)]">In Memoriam</span>
                )}
              </div>
              <p className="text-amber-light/70 text-lg mb-4">{lifeSpan}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center md:justify-start text-sm text-parchment/60">
                <SourcedField entityType="Ancestor" entityId={id} fieldName="birth_date" label="Date of Birth" value={ancestor.birth_date ? new Date(ancestor.birth_date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} icon={Calendar} />
                <SourcedField entityType="Ancestor" entityId={id} fieldName="birth_place" label="Place of Birth" value={ancestor.birth_place} icon={MapPin} />
                <SourcedField entityType="Ancestor" entityId={id} fieldName="nationality" label="Nationality" value={ancestor.nationality} icon={Globe} />
                <SourcedField entityType="Ancestor" entityId={id} fieldName="bloodline" label="Bloodline" value={ancestor.bloodline} icon={Heart} />
                {ancestor.sex && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                    {ancestor.sex === 'male' ? 'Male' : 'Female'}
                  </span>
                )}
                {ancestor.sex === 'female' && ancestor.maiden_name && (
                  <SourcedField entityType="Ancestor" entityId={id} fieldName="maiden_name" label="Maiden Name" value={ancestor.maiden_name} />
                )}
              </div>
              {ancestor.sex === 'female' && ancestor.maiden_name && (
                <div className="mt-3">
                  <BirthBranchLink maidenName={ancestor.maiden_name} currentBranchId={ancestor.branch_id} />
                </div>
              )}
              {ancestor.biography && (
                <div className="mt-4">
                  <SourcedField entityType="Ancestor" entityId={id} fieldName="biography" label="Biography" value={ancestor.biography} />
                </div>
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
                    <p className="text-sm text-parchment">{formatAncestorName(parents.mother)}</p>
                  </div>
                </Link>
              )}
              {parents.father && (
                <Link to={`/ancestor/${parents.father.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <AncestorAvatar ancestor={parents.father} size="sm" />
                  <div>
                    <p className="text-xs text-parchment/40">Father</p>
                    <p className="text-sm text-parchment">{formatAncestorName(parents.father)}</p>
                  </div>
                </Link>
              )}
              {partner && (
                <Link to={`/ancestor/${partner.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(201,145,58,0.06)] transition-colors">
                  <AncestorAvatar ancestor={partner} size="sm" />
                  <div>
                    <p className="text-xs text-parchment/40">Partner</p>
                    <p className="text-sm text-parchment">{formatAncestorName(partner)}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        {(ancestor.birth_certificate || ancestor.marriage_certificate || ancestor.passport_document) && (
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
              {ancestor.passport_document && (
                <a href={ancestor.passport_document} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)] transition-colors">
                  <BookUser size={24} className="text-gold" />
                  <div>
                    <p className="text-sm text-parchment">Passport Document</p>
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
              onClick={() => setShowDispute(true)}
              className="flex items-center gap-1.5 text-sm text-amber-light/70 hover:text-amber-light transition-colors"
            >
              <Flag size={14} /> Raise a Dispute
            </button>
          </div>

          {showDispute && (
            <RaiseDisputeDialog
              entityType="Ancestor"
              entityId={id}
              ancestorId={id}
              bloodline={ancestor?.bloodline || ''}
              onClose={() => setShowDispute(false)}
              onSubmitted={() => setShowDispute(false)}
            />
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

        <AncestorEditDialog
          open={editOpen}
          ancestor={ancestor}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setAncestor(updated)}
        />
      </div>
    </Layout>
  );
}