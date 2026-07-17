import React, { useState, useEffect } from 'react';
import { Loader2, Check, MapPin, Tag, Award, FileText, Eye, Calendar, Image as ImageIcon, Newspaper, BookUser, IdCard, Mail, Heart, HelpCircle, X, Network, User, Users, Video, Music, Link2, MessageSquare, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LocationPicker from '@/components/LocationPicker';
import MentionTextarea from '@/components/MentionTextarea';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import NewAncestorDialog from '@/components/NewAncestorDialog';

const typeOptions = [
  { value: 'photo', label: 'Photograph', icon: ImageIcon },
  { value: 'narrative', label: 'Narrative', icon: FileText },
  { value: 'correspondence', label: 'Correspondence', icon: Mail },
  { value: 'press_clipping', label: 'Press Clipping', icon: Newspaper },
  { value: 'certificate', label: 'Certificate', icon: Award },
  { value: 'passport', label: 'Passport', icon: BookUser },
  { value: 'identity_document', label: 'Identity Document', icon: IdCard },
  { value: 'memorial', label: 'Memorial', icon: Heart },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'uncategorized', label: 'Uncategorized', icon: HelpCircle },
];

export default function AdminEventEditor({ item, onApproved }) {
  const [formData, setFormData] = useState({});
  const [extractedFields, setExtractedFields] = useState({});
  const [transcribedText, setTranscribedText] = useState('');
  const [tags, setTags] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [familyLink, setFamilyLink] = useState(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [comment, setComment] = useState('');
  const [taggedUserIds, setTaggedUserIds] = useState([]);
  const [isQuery, setIsQuery] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [newAncestorOpen, setNewAncestorOpen] = useState(false);
  const [attachToProfile, setAttachToProfile] = useState(false);
  const [selectedAncestorId, setSelectedAncestorId] = useState('');

  useEffect(() => {
    setFormData({
      title: item.title || '',
      content_type: item.content_type || 'uncategorized',
      description: item.description || '',
      date: item.date || '',
      era: item.era || '',
      location_name: item.location_name || '',
      latitude: item.latitude != null ? String(item.latitude) : '',
      longitude: item.longitude != null ? String(item.longitude) : '',
      ancestor_ids: item.ancestor_ids || [],
    });
    setExtractedFields(item.extracted_fields || {});
    setTranscribedText(item.transcribed_text || '');
    setTags(item.tags || []);
    setExternalUrl(item.external_url || '');
    setComment('');
    setTaggedUserIds([]);
    setIsQuery(false);
    setAttachToProfile(false);
    setSelectedAncestorId(item.ancestor_ids?.[0] || '');
    // Load any family link extracted from this content item
    base44.entities.FamilyLink.filter({ content_item_id: item.id }).then(links => {
      setFamilyLink(links && links.length > 0 ? links[0] : null);
    }).catch(() => setFamilyLink(null));
  }, [item.id]);

  useEffect(() => {
    base44.entities.Ancestor.list().then(setAncestors).catch(() => {});
    base44.entities.User.list().then(setUsers).catch(() => {});
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const setField = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const toggleAncestor = (id) => {
    setField('ancestor_ids', formData.ancestor_ids.includes(id)
      ? formData.ancestor_ids.filter(a => a !== id)
      : [...formData.ancestor_ids, id]);
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  const handleLocationPick = ({ location_name, latitude, longitude }) => {
    setFormData(f => ({ ...f, location_name, latitude, longitude }));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await base44.entities.ContentItem.update(item.id, {
        title: formData.title,
        content_type: formData.content_type,
        description: formData.description,
        date: formData.date || null,
        era: formData.era || null,
        location_name: formData.location_name || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        ancestor_ids: formData.ancestor_ids,
        external_url: externalUrl || null,
        transcribed_text: transcribedText || null,
        extracted_fields: Object.keys(extractedFields).length > 0 ? extractedFields : null,
        tags,
        review_status: 'reviewed',
        categorization_notes: item.categorization_notes?.replace(/⚠ FLAGGED FOR ADMIN REVIEW.*$/s, '').trim() || null,
      });
      // Create comment if provided
      if (comment.trim()) {
        await base44.entities.Comment.create({
          entity_type: 'ContentItem',
          entity_id: item.id,
          field_name: 'general_discussion',
          content: comment.trim(),
          author_id: currentUser?.id || null,
          author_name: currentUser?.full_name || currentUser?.email || 'Admin',
          parent_comment_id: null,
          tagged_user_ids: taggedUserIds.length > 0 ? taggedUserIds : null,
          is_query: isQuery,
          acknowledged_by: [],
        }).catch(() => {});
      }
      // Attach certificate/passport directly to ancestor's profile
      if (attachToProfile && selectedAncestorId && item.file_url) {
        const documentSubtype = extractedFields?.document_subtype;
        const profileField =
          documentSubtype === 'birth_certificate' ? 'birth_certificate' :
          documentSubtype === 'marriage_certificate' ? 'marriage_certificate' :
          formData.content_type === 'passport' ? 'passport_document' : null;
        if (profileField) {
          await base44.entities.Ancestor.update(selectedAncestorId, { [profileField]: item.file_url }).catch(() => {});
        }
      }
      // If a family link exists and is still pending, integrate it now
      if (familyLink && familyLink.status === 'pending') {
        await base44.functions.invoke('integrateFamilyLink', { family_link_id: familyLink.id }).catch(() => {});
      }
      if (onApproved) onApproved(item.id);
    } catch (e) {}
    setSaving(false);
  };

  const getAncestor = (id) => ancestors.find(a => a.id === id);

  const CurrentTypeIcon = typeOptions.find(t => t.value === formData.content_type)?.icon || HelpCircle;

  return (
    <div className="space-y-5">
      {/* Media preview */}
      {item.file_url && (
        <div className="rounded-lg overflow-hidden bg-[#0D0B0A] border border-[rgba(201,145,58,0.12)]">
          {item.content_type === 'video' ? (
            <video controls src={item.file_url} className="w-full max-h-80" />
          ) : (
            <img src={item.file_url} alt={formData.title} className="w-full max-h-80 object-contain" />
          )}
        </div>
      )}

      {/* Content type selector */}
      <div className="aged-card rounded-xl p-4">
        <label className="text-xs text-parchment/40 uppercase tracking-wider mb-2 block">Content Type</label>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setField('content_type', t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  formData.content_type === t.value
                    ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold'
                    : 'border-[rgba(201,145,58,0.12)] text-parchment/50 hover:border-[rgba(201,145,58,0.25)]'
                }`}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Core event details — all editable */}
      <div className="aged-card rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg text-parchment flex items-center gap-2">
          <CurrentTypeIcon size={18} className="text-gold" /> Event Details
        </h3>
        <div>
          <label className="text-sm text-parchment/60 mb-1 block">Title</label>
          <input value={formData.title} onChange={e => setField('title', e.target.value)}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
        </div>
        <div>
          <label className="text-sm text-parchment/60 mb-1 block">Description</label>
          <textarea value={formData.description} onChange={e => setField('description', e.target.value)} rows={3}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1"><Calendar size={12} /> Date</label>
            <div className="flex gap-2">
              <input type="text" value={formData.date} onChange={e => setField('date', e.target.value)}
                className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="YYYY-MM-DD" />
              <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(formData.date) ? formData.date : ''} onChange={e => setField('date', e.target.value)} title="Pick from calendar"
                className="bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-2 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] flex-shrink-0 cursor-pointer" style={{ colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className="text-sm text-parchment/60 mb-1 block">Era</label>
            <input value={formData.era} onChange={e => setField('era', e.target.value)}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="e.g. circa 1950" />
          </div>
        </div>
        <div>
          <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1"><MapPin size={12} /> Event Location</label>
          <div className="flex gap-2">
            <LocationAutocompleteInput
              value={formData.location_name}
              onChange={({ location_name, latitude, longitude }) => {
                setField('location_name', location_name);
                if (latitude) setField('latitude', latitude);
                if (longitude) setField('longitude', longitude);
              }}
              placeholder="Where the event occurred"
              className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
            />
            <button type="button" onClick={() => setLocationPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0">
              <MapPin size={14} /> Map
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Latitude</label>
              <input type="number" step="any" value={formData.latitude} onChange={e => setField('latitude', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
            </div>
            <div>
              <label className="text-xs text-parchment/40 mb-1 block">Longitude</label>
              <input type="number" step="any" value={formData.longitude} onChange={e => setField('longitude', e.target.value)}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
            </div>
          </div>
        </div>
      </div>

      {/* External URL */}
      <div className="aged-card rounded-xl p-5">
        <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1"><Link2 size={12} /> External URL (YouTube/Vimeo)</label>
        <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)}
          className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
          placeholder="https://youtube.com/watch?v=..." />
      </div>

      {/* Ancestor tagging */}
      <div className="aged-card rounded-xl p-5">
        <label className="text-sm text-parchment/60 mb-2 block">Tag Ancestors</label>
        <div className="flex flex-wrap gap-2">
          {ancestors.map(a => (
            <button key={a.id} onClick={() => {
              toggleAncestor(a.id);
              setSelectedAncestorId(a.id);
            }}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                formData.ancestor_ids?.includes(a.id)
                  ? 'bg-[#C9913A] text-charcoal font-medium'
                  : 'bg-[#0D0B0A] text-parchment/60 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)]'
              }`}>
              {a.full_name}
            </button>
          ))}
          <button
            onClick={() => setNewAncestorOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-[rgba(201,145,58,0.3)] text-amber-light/70 hover:border-[#C9913A] hover:text-gold transition-colors"
          >
            <UserPlus size={14} /> Enter New Ancestor
          </button>
        </div>
      </div>

      {/* Attach certificate to profile — same as user upload form */}
      {(() => {
        const documentSubtype = extractedFields?.document_subtype;
        const canAttach = selectedAncestorId && (
          (formData.content_type === 'certificate' && (documentSubtype === 'birth_certificate' || documentSubtype === 'marriage_certificate')) ||
          formData.content_type === 'passport'
        );
        if (!canAttach) return null;
        const selectedAncestor = ancestors.find(a => a.id === selectedAncestorId);
        return (
          <div className="aged-card rounded-xl p-4 flex items-center gap-3">
            <Link2 size={20} className="text-gold flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-parchment font-medium">
                Attach to {selectedAncestor?.full_name || 'ancestor'}'s profile
              </p>
              <p className="text-xs text-parchment/40">
                {formData.content_type === 'passport' ? 'Passport document' : documentSubtype === 'birth_certificate' ? 'Birth certificate' : 'Marriage certificate'} will be saved to their profile page
              </p>
            </div>
            <button
              onClick={() => setAttachToProfile(!attachToProfile)}
              className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${attachToProfile ? 'bg-[#C9913A]' : 'bg-[rgba(245,236,215,0.1)]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-parchment transition-transform ${attachToProfile ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        );
      })()}

      {/* Extracted fields — editable */}
      {Object.keys(extractedFields).length > 0 && (
        <div className="aged-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-gold" />
            <h3 className="font-display text-base text-parchment">Extracted Fields</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(extractedFields).map(([key, val]) => (
              <div key={key}>
                <label className="text-xs text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</label>
                <input
                  value={typeof val === 'object' ? JSON.stringify(val) : (val || '')}
                  onChange={e => setExtractedFields(d => ({ ...d, [key]: e.target.value }))}
                  className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcribed text — editable */}
      {transcribedText && (
        <div className="aged-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-gold" />
            <h3 className="font-display text-base text-parchment">Transcribed Text</h3>
          </div>
          <textarea
            value={transcribedText}
            onChange={e => setTranscribedText(e.target.value)}
            rows={6}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed"
          />
        </div>
      )}

      {/* Tags — editable */}
      <div className="aged-card rounded-xl p-5">
        <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5"><Tag size={14} /> Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
              {tag}
              <button onClick={() => removeTag(tag)} className="text-parchment/30 hover:text-parchment"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            placeholder="Add a tag..." />
          <button onClick={addTag} className="px-3 py-2 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.15)] transition-colors">Add</button>
        </div>
      </div>

      {/* Comment / Query — same as the user upload form */}
      <div className="aged-card rounded-xl p-5">
        <label className="text-sm text-parchment/60 mb-2 block flex items-center gap-1.5">
          <MessageSquare size={14} /> Comment
        </label>
        <MentionTextarea
          value={comment}
          onChange={setComment}
          onTaggedUsersChange={setTaggedUserIds}
          taggedUserIds={taggedUserIds}
          users={users}
          currentUser={currentUser}
          rows={3}
          className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
          placeholder="Add a comment or raise a query about this event... (type @ to tag someone)"
        />
        <div className="mt-2">
          <button
            onClick={() => setIsQuery(!isQuery)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${isQuery ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)]'}`}
          >
            <HelpCircle size={12} /> {isQuery ? 'Query' : 'Comment'}
          </button>
        </div>
      </div>

      {/* AI confidence + notes (read-only reference) */}
      {item.ai_confidence != null && (
        <div className="aged-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} className="text-gold" />
            <span className="text-xs text-parchment/40 uppercase tracking-wider">AI Confidence</span>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${item.ai_confidence >= 0.7 ? 'bg-green-500/10 text-green-300' : item.ai_confidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
              {Math.round(item.ai_confidence * 100)}%
            </span>
          </div>
          {item.categorization_notes && (
            <p className="text-xs text-parchment/50 leading-relaxed mt-1 whitespace-pre-wrap">{item.categorization_notes}</p>
          )}
        </div>
      )}

      {/* Family Links preview — shows extracted relationships from certificates */}
      {familyLink && (
        <div className="aged-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Network size={16} className="text-gold" />
            <h3 className="font-display text-base text-parchment">Extracted Family Links</h3>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
              familyLink.status === 'integrated' ? 'bg-green-500/10 text-green-300' :
              familyLink.status === 'rejected' ? 'bg-red-500/10 text-red-300' :
              'bg-[rgba(201,145,58,0.1)] text-amber-light'
            }`}>{familyLink.status}</span>
          </div>
          {familyLink.status === 'pending' && (
            <p className="text-xs text-parchment/40 mb-3">Approving this upload will integrate these relationships into the family tree, migration map, and timeline.</p>
          )}
          <div className="space-y-2">
            {familyLink.mother_ancestor_id && (
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-parchment/30" />
                <span className="text-parchment/40 w-16">Mother</span>
                <span className="text-parchment">{getAncestor(familyLink.mother_ancestor_id)?.full_name || familyLink.mother_name}</span>
                {familyLink.mother_is_new && <span className="text-xs text-amber-light/60">(new)</span>}
              </div>
            )}
            {familyLink.father_ancestor_id && (
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-parchment/30" />
                <span className="text-parchment/40 w-16">Father</span>
                <span className="text-parchment">{getAncestor(familyLink.father_ancestor_id)?.full_name || familyLink.father_name}</span>
                {familyLink.father_is_new && <span className="text-xs text-amber-light/60">(new)</span>}
              </div>
            )}
            {familyLink.partner_ancestor_id && (
              <div className="flex items-center gap-2 text-sm">
                <Heart size={14} className="text-parchment/30" />
                <span className="text-parchment/40 w-16">Spouse</span>
                <span className="text-parchment">{getAncestor(familyLink.partner_ancestor_id)?.full_name || familyLink.partner_name}</span>
                {familyLink.partner_is_new && <span className="text-xs text-amber-light/60">(new)</span>}
              </div>
            )}
            {familyLink.subject_is_new && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-parchment/30" />
                <span className="text-parchment/40 w-16">Subject</span>
                <span className="text-parchment">{getAncestor(familyLink.subject_ancestor_id)?.full_name || familyLink.subject_name}</span>
                <span className="text-xs text-amber-light/60">(new)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve button */}
      <button
        onClick={handleApprove}
        disabled={saving || !formData.title?.trim()}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
        {saving ? 'Saving...' : familyLink && familyLink.status === 'pending' ? 'Approve & Integrate Family Tree' : 'Approve & Save'}
      </button>

      <NewAncestorDialog
        open={newAncestorOpen}
        onClose={() => setNewAncestorOpen(false)}
        onCreated={(created) => {
          setAncestors(prev => [...prev, created]);
          setFormData(f => ({ ...f, ancestor_ids: [...new Set([...(f.ancestor_ids || []), created.id])] }));
          setSelectedAncestorId(created.id);
        }}
        user={currentUser}
      />

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onPick={handleLocationPick}
        initialLocation={formData.location_name}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />
    </div>
  );
}