import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, Image as ImageIcon, Award, Loader2, Check, Sparkles, Newspaper, Tag, Link2, Search, UserPlus, BookUser, IdCard, Mail, Heart, HelpCircle, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

const STEPS = {
  CAPTURE: 'capture',
  ANALYSING: 'analysing',
  FORM: 'form',
  SAVED: 'saved',
};

export default function UploadEvent() {
  const [step, setStep] = useState(STEPS.CAPTURE);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [classification, setClassification] = useState(null);
  const [documentSubtype, setDocumentSubtype] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [rawAiAnalysis, setRawAiAnalysis] = useState(null);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [categorizationNotes, setCategorizationNotes] = useState('');
  const [visualElements, setVisualElements] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location_name: '',
    latitude: '',
    longitude: '',
    ancestor_ids: [],
    era: '',
    external_url: '',
  });
  const [ancestors, setAncestors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedAncestorId, setSelectedAncestorId] = useState('');
  const [attachToProfile, setAttachToProfile] = useState(false);
  const [ancestorSearch, setAncestorSearch] = useState('');
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const filteredAncestors = ancestorSearch
    ? ancestors.filter(a => a.full_name.toLowerCase().includes(ancestorSearch.toLowerCase()))
    : ancestors;

  const selectedAncestor = ancestors.find(a => a.id === selectedAncestorId) || null;

  const canAttachToProfile = selectedAncestor && (
    (classification === 'certificate' && (documentSubtype === 'birth_certificate' || documentSubtype === 'marriage_certificate')) ||
    classification === 'passport'
  );

  useEffect(() => {
    base44.entities.Ancestor.list().then(setAncestors).catch(() => {});
  }, []);

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setStep(STEPS.ANALYSING);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const url = uploadRes.file_url;
      setFileUrl(url);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a sophisticated genealogical and historical document analyst working on a family history archive. You are analysing an image that could be ANYTHING — a photograph (portrait, landscape, group photo), a document (certificate, letter, passport, newspaper), a poster, a concert ticket, a postcard, a drawing, a map, a receipt, or any other type of visual artifact from a family's history.

Your job is to:
1. Identify what the image IS — but be honest about uncertainty
2. Extract ALL visible data — every piece of text, every visible object, every person, every date, every location, every notable visual element
3. Provide a confidence score for your classification
4. Note your reasoning — what visual elements led to your conclusion, and what uncertainty remains

CATEGORIES (choose the single best fit, or "uncategorized" if you cannot confidently classify):
1. "photo" — A PHOTOGRAPH of a person, place, or event (portrait, landscape, group photo, etc.)
2. "narrative" — A DIARY ENTRY, MEMOIR, or handwritten personal story — transcribe the full text
3. "correspondence" — A LETTER, POSTCARD, or TELEGRAM (personal correspondence) — transcribe the full text, note sender/recipient
4. "press_clipping" — A NEWSPAPER ARTICLE or published media clipping — transcribe the full text
5. "passport" — A PASSPORT or travel document
6. "identity_document" — Other IDENTITY/TRAVEL documents (driver's licence, national ID, visa, residency permit)
7. "certificate" — Any FORMAL RECORD, official document, or certificate (birth, death, marriage, baptism, military, census, immigration, naturalization, etc.)
8. "memorial" — A MEMORIAL, obituary, or commemorative item
9. "uncategorized" — Use when you CANNOT confidently classify the image. This includes but is not limited to: posters, concert tickets, event programs, receipts, drawings, artwork, maps, mixed-content images, or unclear/poor-quality images where the type cannot be determined.

REGARDLESS OF CATEGORY — always extract ALL visible data:
- Transcribe ALL readable text
- Note ALL visible dates (in any format)
- Note ALL visible names
- Note ALL visible locations/places
- Describe ALL visible objects, subjects, and visual elements
- Describe any people visible (age estimate, gender, clothing, posture, count)
- Note the format, layout, style, and condition of the image
- Note any era indicators (clothing style, photo quality, document format, language, etc.)
- Identify any family history relevance

For certificates and formal documents, extract all genealogically relevant fields including:
- Full names (subject, parents, spouse, witnesses, informant)
- Dates (birth, death, marriage, event, registration, issue, arrival, naturalization)
- Places (birth, death, marriage, residence, origin, destination, issuing authority)
- Nationality, citizenship, religion, occupation
- Document numbers, registration numbers, volume/page references
- Ship name, port of departure/arrival (for passenger manifests)
- Military unit, rank, service number (for military records)

Return JSON with this structure:
{
  "type": "photo" | "narrative" | "correspondence" | "press_clipping" | "passport" | "identity_document" | "certificate" | "memorial" | "uncategorized",
  "document_subtype": "birth_certificate" | "death_certificate" | "marriage_certificate" | "baptism_or_church_record" | "passenger_manifest_or_ship_record" | "passport_or_travel_document" | "naturalization_or_citizenship" | "census_record" | "military_record" | "immigration_or_border_record" | "statutory_declaration_or_affidavit" | "property_or_land_record" | "other_official_record" | "" (empty if not applicable),
  "ai_confidence": 0.0 to 1.0 (your confidence in the classification — be honest; 0.3-0.5 means uncertain, 0.7+ means confident),
  "categorization_notes": "Your reasoning for the classification. What visual elements led to this conclusion? What uncertainty remains? If uncategorized, explain what the image appears to be and why you couldn't classify it definitively.",
  "transcription": "Full text transcribed from the image, if any readable text exists — otherwise empty string. Include ALL text, even if fragmented or partially visible.",
  "extracted_fields": {
    "full_name": "", "date_of_birth": "", "place_of_birth": "", "date_of_death": "", "place_of_death": "",
    "mother_name": "", "father_name": "", "spouse_name": "", "witnesses": "", "issuing_authority": "",
    "date_of_event": "", "place_of_event": "", "nationality": "", "religion": "", "occupation": "",
    "document_number": "", "registration_number": "", "ship_name": "", "port_of_departure": "", "port_of_arrival": "",
    "military_unit": "", "rank": "", "service_number": "", "residence_address": "",
    "passport_number": "", "date_of_issue": "", "date_of_expiry": "", "issuing_country": "",
    "place_of_issue": "", "surname": "", "given_names": "", "national_id_number": "",
    "sex": "", "height": "", "profession": "", "distinguishing_marks": "", "photograph_present": ""
  },
  "event_location": "The geographic location WHERE THE EVENT DEPICTED in this image/document took place — NOT the location of the person viewing or uploading it. For a photo, this is where the photo was taken. For a certificate, this is where the birth/marriage/death was registered. For a letter, this is where it was written or sent from. For a passport, this is where it was issued. Be as specific as possible (city, state, country). Empty string if no location can be determined from the image.",
  "visual_elements": {
    "objects": ["list of ALL visible objects — e.g. 'fountain', 'church spire', 'vintage car', 'furniture'"],
    "people": ["descriptions of visible people — e.g. 'elderly man in suit, seated', 'young woman in white dress, standing'"],
    "text_elements": ["notable text elements visible — e.g. 'heading reads The Age', 'handwritten note at bottom'"],
    "dates_visible": ["any dates visible in any format — e.g. '14 March 1923', '1965'"],
    "locations_visible": ["any place names visible — e.g. 'Melbourne', 'Via Roma, Venice'"],
    "format_description": "description of the image format, layout, and style — e.g. 'black and white photograph, landscape orientation, faded edges', 'printed document with official seal, portrait orientation'",
    "era_indicators": ["visual clues about the time period — e.g. '1950s clothing style', 'sepia tone suggesting early 1900s', 'modern printed text'"],
    "notable_features": ["any other notable visual features — e.g. 'official stamp in corner', 'watermark visible', 'torn edges', 'photograph within a photograph'"]
  },
  "suggested_title": "a short descriptive title for this item, including the type and primary person/place if known (e.g. 'Birth Certificate — Giuseppe Freddi (1898)', 'Group Photo at Beach — circa 1950', 'Concert Ticket — Melbourne Town Hall')",
  "suggested_description": "a brief description of what this item is and its potential significance to family history",
  "suggested_tags": ["array", "of", "relevant", "tags", "e.g. 'immigration', 'Victoria', '1890s', 'Freddi bloodline', 'concert', 'poster']"
}`,
  file_urls: [url],
  response_json_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['photo', 'narrative', 'correspondence', 'press_clipping', 'passport', 'identity_document', 'certificate', 'memorial', 'uncategorized'] },
      document_subtype: { type: 'string' },
      ai_confidence: { type: 'number' },
      categorization_notes: { type: 'string' },
      transcription: { type: 'string' },
      extracted_fields: { type: 'object' },
      visual_elements: { type: 'object' },
      suggested_title: { type: 'string' },
      suggested_description: { type: 'string' },
      suggested_tags: { type: 'array', items: { type: 'string' } },
    },
  },
      });

      setClassification(result.type);
      if (result.document_subtype) setDocumentSubtype(result.document_subtype);
      if (result.transcription) setTranscribedText(result.transcription);
      if (result.extracted_fields) setExtractedData(result.extracted_fields);
      if (result.suggested_tags) setSuggestedTags(result.suggested_tags);
      if (result.visual_elements) setVisualElements(result.visual_elements);
      if (result.ai_confidence !== undefined) setAiConfidence(result.ai_confidence);
      if (result.categorization_notes) setCategorizationNotes(result.categorization_notes);
      setRawAiAnalysis(result);

      // Auto-match extracted full name to an existing ancestor
      const extractedName = result.extracted_fields?.full_name;
      let matchedAncestorId = selectedAncestorId;
      if (extractedName && ancestors.length > 0) {
        const lowerName = extractedName.toLowerCase();
        const match = ancestors.find(a =>
          a.full_name.toLowerCase() === lowerName ||
          a.full_name.toLowerCase().includes(lowerName) ||
          lowerName.includes(a.full_name.toLowerCase())
        );
        if (match) {
          matchedAncestorId = match.id;
          setSelectedAncestorId(match.id);
        }
      }

      const eventLocation = result.event_location
        || result.extracted_fields?.place_of_event
        || result.extracted_fields?.place_of_birth
        || result.extracted_fields?.place_of_death
        || result.extracted_fields?.place_of_issue
        || result.extracted_fields?.residence_address
        || result.extracted_fields?.port_of_arrival
        || result.visual_elements?.locations_visible?.[0]
        || '';

      setFormData(f => ({
        ...f,
        title: result.suggested_title || (selectedFile?.name ? selectedFile.name.replace(/\.[^.]+$/, '') : ''),
        description: result.suggested_description || '',
        date: result.extracted_fields?.date_of_event || result.extracted_fields?.date_of_birth || '',
        location_name: eventLocation,
        ancestor_ids: matchedAncestorId && !f.ancestor_ids.includes(matchedAncestorId)
          ? [...f.ancestor_ids, matchedAncestorId]
          : f.ancestor_ids,
      }));

      // Auto-suggest attaching certificate to ancestor profile
      if (matchedAncestorId && (
        (result.type === 'certificate' && (result.document_subtype === 'birth_certificate' || result.document_subtype === 'marriage_certificate')) ||
        result.type === 'passport'
      )) {
        setAttachToProfile(true);
      }

      setStep(STEPS.FORM);
    } catch (e) {
      setClassification('uncategorized');
      setStep(STEPS.FORM);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const contentType = classification;

      const user = await base44.auth.me().catch(() => null);

      const itemData = {
        title: formData.title,
        content_type: contentType,
        description: formData.description,
        date: formData.date || null,
        location_name: formData.location_name,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        ancestor_ids: selectedAncestorId && !formData.ancestor_ids.includes(selectedAncestorId)
          ? [...formData.ancestor_ids, selectedAncestorId]
          : formData.ancestor_ids,
        era: formData.era,
        file_url: fileUrl,
        external_url: formData.external_url,
        transcribed_text: transcribedText || null,
        extracted_fields: { ...extractedData, document_subtype: documentSubtype } || null,
        raw_ai_analysis: rawAiAnalysis || null,
        ai_confidence: aiConfidence,
        categorization_notes: categorizationNotes || null,
        visual_elements: visualElements || null,
        uploaded_by_id: user?.id || null,
        conflict_flag_status: 'none',
        tags: suggestedTags || [],
      };

      await base44.entities.ContentItem.create(itemData);

      // Attach certificate directly to ancestor's profile
      if (attachToProfile && canAttachToProfile && fileUrl) {
        const profileField =
          documentSubtype === 'birth_certificate' ? 'birth_certificate' :
          documentSubtype === 'marriage_certificate' ? 'marriage_certificate' :
          classification === 'passport' ? 'passport_document' : null;
        if (profileField) {
          await base44.entities.Ancestor.update(selectedAncestorId, { [profileField]: fileUrl }).catch(() => {});
        }
      }

      if (user) {
        await base44.entities.ActivityLog.create({
          action_type: 'upload',
          user_id: user.id,
          user_name: user.full_name,
          content_item_title: formData.title,
          description: `Uploaded "${formData.title}" (${contentType})`,
        }).catch(() => {});
      }

      setStep(STEPS.SAVED);
    } catch (e) {
      // error
    }
    setSaving(false);
  };

  const toggleAncestor = (id) => {
    setFormData(f => ({
      ...f,
      ancestor_ids: f.ancestor_ids.includes(id)
        ? f.ancestor_ids.filter(a => a !== id)
        : [...f.ancestor_ids, id],
    }));
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl text-parchment mb-2">Upload an Event</h1>
        <p className="text-parchment/50 text-sm mb-8">Share a piece of family history — the system will analyse it and help you tag it.</p>

        {step === STEPS.CAPTURE && (
          <div className="aged-card rounded-2xl p-8">
            {/* Ancestor pre-selection */}
            <div className="mb-6">
              <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5">
                <UserPlus size={14} /> Link to an Ancestor (recommended)
              </label>
              <p className="text-xs text-parchment/40 mb-3">Select who this photo or certificate belongs to — the system will auto-tag them and can attach certificates directly to their profile.</p>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
                <input
                  value={ancestorSearch}
                  onChange={e => setAncestorSearch(e.target.value)}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Search ancestors by name..."
                />
              </div>
              {ancestorSearch && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
                  {filteredAncestors.length > 0 ? filteredAncestors.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAncestorId(a.id); setAncestorSearch(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(201,145,58,0.06)] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold font-medium">
                        {a.full_name.charAt(0)}
                      </div>
                      <span className="text-sm text-parchment">{a.full_name}</span>
                      {a.birth_date && <span className="text-xs text-parchment/40">· {new Date(a.birth_date).getFullYear()}</span>}
                    </button>
                  )) : (
                    <p className="px-4 py-3 text-sm text-parchment/40">No ancestors found</p>
                  )}
                </div>
              )}
              {selectedAncestor && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)]">
                  <div className="w-10 h-10 rounded-full bg-[rgba(201,145,58,0.15)] border border-[#C9913A] flex items-center justify-center text-sm text-gold font-medium">
                    {selectedAncestor.full_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-parchment font-medium">{selectedAncestor.full_name}</p>
                    <p className="text-xs text-parchment/40">Will be auto-tagged in this upload</p>
                  </div>
                  <button onClick={() => setSelectedAncestorId('')} className="text-parchment/40 hover:text-parchment text-xs">Remove</button>
                </div>
              )}
            </div>

            <div className="border-t border-[rgba(201,145,58,0.1)] pt-6">
              <p className="text-parchment/60 text-sm mb-6 text-center">Upload a file from your device, or use your camera to photograph a document.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
                >
                  <Upload size={32} className="text-gold" />
                  <span className="text-parchment font-medium">Upload File</span>
                  <span className="text-xs text-parchment/40">PDF, JPG, PNG</span>
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
                >
                  <ImageIcon size={32} className="text-gold" />
                  <span className="text-parchment font-medium">Choose Photo</span>
                  <span className="text-xs text-parchment/40">JPG or PNG image</span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
                >
                  <Camera size={32} className="text-gold" />
                  <span className="text-parchment font-medium">Use Camera</span>
                  <span className="text-xs text-parchment/40">Photograph a document</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            <div className="mt-6 pt-6 border-t border-[rgba(201,145,58,0.1)]">
              <p className="text-xs text-parchment/40 text-center">Supported: PDF, JPG, PNG, WebP — photographs, letters, certificates, press clippings</p>
            </div>
          </div>
        )}

        {step === STEPS.ANALYSING && (
          <div className="aged-card rounded-2xl p-12 text-center">
            {file && file.type.startsWith('image/') && (
              <div className="mb-6 flex justify-center">
                <img src={URL.createObjectURL(file)} alt="preview" className="max-h-48 rounded-lg sepia-tint" />
              </div>
            )}
            {file && file.type === 'application/pdf' && (
              <div className="mb-6 flex justify-center">
                <div className="w-48 h-48 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] flex flex-col items-center justify-center gap-2">
                  <FileText size={32} className="text-gold" />
                  <span className="text-sm text-parchment/60">{file.name}</span>
                  <span className="text-xs text-parchment/40">PDF document</span>
                </div>
              </div>
            )}
            <Loader2 size={32} className="text-gold mx-auto mb-4 animate-spin gold-pulse rounded-full" />
            <p className="font-display text-xl text-parchment mb-1">Analysing your document...</p>
            <p className="text-parchment/50 text-sm">Identifying type and extracting data points</p>
          </div>
        )}

        {step === STEPS.FORM && (
          <div className="space-y-6">
            {/* Classification badge */}
            <div className="aged-card rounded-xl p-4 flex items-center gap-3">
              {classification === 'photo' && <ImageIcon size={24} className="text-gold" />}
              {classification === 'narrative' && <FileText size={24} className="text-gold" />}
              {classification === 'correspondence' && <Mail size={24} className="text-gold" />}
              {classification === 'press_clipping' && <Newspaper size={24} className="text-gold" />}
              {classification === 'certificate' && <Award size={24} className="text-gold" />}
              {classification === 'passport' && <BookUser size={24} className="text-gold" />}
              {classification === 'identity_document' && <IdCard size={24} className="text-gold" />}
              {classification === 'uncategorized' && <HelpCircle size={24} className="text-gold" />}
              <div>
                <p className="text-xs text-parchment/40 uppercase tracking-wider">Detected Type</p>
                <p className="text-parchment font-medium">
                  {classification === 'photo' ? 'Photograph' : classification === 'narrative' ? 'Narrative Document' : classification === 'correspondence' ? 'Correspondence' : classification === 'press_clipping' ? 'Press Clipping' : classification === 'certificate' ? 'Certificate / Formal Record' : classification === 'passport' ? 'Passport / Travel Document' : classification === 'identity_document' ? 'Identity Document' : classification === 'uncategorized' ? 'Uncategorized — pending review' : 'Document'}
                  {documentSubtype && documentSubtype !== 'other_official_record' && (
                    <span className="text-amber-light/70 text-sm ml-2">({documentSubtype.replace(/_/g, ' ')})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Attach certificate to profile */}
            {canAttachToProfile && (
              <div className="aged-card rounded-xl p-4 flex items-center gap-3">
                <Link2 size={20} className="text-gold flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-parchment font-medium">
                    Attach to {selectedAncestor.full_name}'s profile
                  </p>
                  <p className="text-xs text-parchment/40">
                    {classification === 'passport' ? 'Passport document' : documentSubtype === 'birth_certificate' ? 'Birth certificate' : 'Marriage certificate'} will be saved to their profile page
                  </p>
                </div>
                <button
                  onClick={() => setAttachToProfile(!attachToProfile)}
                  className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${attachToProfile ? 'bg-[#C9913A]' : 'bg-[rgba(245,236,215,0.1)]'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-parchment transition-transform ${attachToProfile ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}

            {/* Preview */}
            {fileUrl && file && file.type.startsWith('image/') && (
              <div className="aged-card rounded-xl p-4">
                <img src={fileUrl} alt="preview" className="max-h-64 mx-auto rounded-lg sepia-tint" />
              </div>
            )}
            {fileUrl && file && file.type === 'application/pdf' && (
              <div className="aged-card rounded-xl p-4">
                <iframe src={fileUrl} title="preview" className="w-full h-80 rounded-lg bg-parchment" />
              </div>
            )}

            {/* Extracted document fields */}
            {(classification === 'certificate' || classification === 'press_clipping' || classification === 'passport' || classification === 'identity_document' || classification === 'uncategorized') && extractedData && (
              <div className="aged-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-parchment">Extracted Data — please verify</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(extractedData).map(([key, val]) => (
                    val && (
                      <div key={key}>
                        <label className="text-xs text-parchment/40 capitalize">{key.replace(/_/g, ' ')}</label>
                        <input
                          value={val}
                          onChange={e => setExtractedData(d => ({ ...d, [key]: e.target.value }))}
                          className="w-full mt-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                        />
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Transcribed text */}
            {(classification === 'narrative' || classification === 'correspondence' || classification === 'press_clipping' || classification === 'uncategorized') && transcribedText && (
              <div className="aged-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-parchment">Transcribed Text — edit if needed</h3>
                </div>
                <textarea
                  value={transcribedText}
                  onChange={e => setTranscribedText(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-3 text-sm text-parchment focus:outline-none focus:border-[#C9913A] leading-relaxed"
                />
              </div>
            )}

            {/* AI confidence and categorization notes */}
            {aiConfidence !== null && (
              <div className="aged-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-gold" />
                  <h3 className="font-display text-sm text-parchment">AI Analysis</h3>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${aiConfidence >= 0.7 ? 'bg-green-500/10 text-green-300' : aiConfidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
                    {Math.round(aiConfidence * 100)}% confidence
                  </span>
                </div>
                {categorizationNotes && (
                  <p className="text-xs text-parchment/50 leading-relaxed">{categorizationNotes}</p>
                )}
              </div>
            )}

            {/* Visual elements extracted */}
            {visualElements && (
              <div className="aged-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-parchment">Extracted Visual Elements</h3>
                </div>
                <div className="space-y-3">
                  {visualElements.objects?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Objects</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.objects.map((o, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualElements.people?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">People</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.people.map((p, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualElements.dates_visible?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Dates Visible</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.dates_visible.map((d, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualElements.locations_visible?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Locations Visible</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.locations_visible.map((l, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualElements.format_description && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Format</p>
                      <p className="text-sm text-parchment/60">{visualElements.format_description}</p>
                    </div>
                  )}
                  {visualElements.era_indicators?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Era Indicators</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.era_indicators.map((e, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualElements.notable_features?.length > 0 && (
                    <div>
                      <p className="text-xs text-parchment/40 uppercase tracking-wider mb-1">Notable Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visualElements.notable_features.map((f, i) => (
                          <span key={i} className="text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] px-2 py-0.5 rounded-full">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Event details form */}
            <div className="aged-card rounded-xl p-6 space-y-4">
              <h3 className="font-display text-lg text-parchment">Event Details</h3>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Title</label>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Era (optional)</label>
                  <input value={formData.era} onChange={e => setFormData({...formData, era: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="e.g. Early 1900s" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-sm text-parchment/60 mb-1 block">Event Location <span className="text-parchment/30 text-xs">(where the event took place)</span></label>
                  <input value={formData.location_name} onChange={e => setFormData({...formData, location_name: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="Where the photo was taken or event occurred" />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Latitude</label>
                  <input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="-37.81" />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Longitude</label>
                  <input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="144.96" />
                </div>
              </div>
              {classification === 'video' || true ? (
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">External Video URL (optional)</label>
                  <input value={formData.external_url} onChange={e => setFormData({...formData, external_url: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="YouTube or Vimeo link" />
                </div>
              ) : null}

              {/* Suggested tags */}
              {suggestedTags.length > 0 && (
                <div>
                  <label className="text-sm text-parchment/60 mb-2 flex items-center gap-1.5"><Tag size={14} /> Suggested Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ancestor tagging */}
              <div>
                <label className="text-sm text-parchment/60 mb-2 block">Tag Ancestors</label>
                <div className="flex flex-wrap gap-2">
                  {ancestors.map(a => (
                    <button
                      key={a.id}
                      onClick={() => toggleAncestor(a.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        formData.ancestor_ids.includes(a.id)
                          ? 'bg-[#C9913A] text-charcoal font-medium'
                          : 'bg-[#0D0B0A] text-parchment/60 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.3)]'
                      }`}
                    >
                      {a.full_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !formData.title}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity gold-glow"
            >
              {saving ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Save to Archive'}
            </button>
          </div>
        )}

        {step === STEPS.SAVED && (
          <div className="aged-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(201,145,58,0.12)] border border-[#C9913A] flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-gold" />
            </div>
            <h2 className="font-display text-2xl text-parchment mb-2">Saved to the Archive</h2>
            <p className="text-parchment/50 text-sm mb-6">Your piece of family history is now part of the Freddi archive.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStep(STEPS.CAPTURE); setFile(null); setFileUrl(null); setClassification(null); setDocumentSubtype(null); setExtractedData(null); setTranscribedText('');                 setSuggestedTags([]); setSelectedAncestorId(''); setAttachToProfile(false); setAncestorSearch(''); setRawAiAnalysis(null); setAiConfidence(null); setCategorizationNotes(''); setVisualElements(null); setFormData({title:'',description:'',date:'',location_name:'',latitude:'',longitude:'',ancestor_ids:[],era:'',external_url:''}); }}
                className="px-5 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors">
                Upload Another
              </button>
              <a href="/" className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity inline-block">
                Back to Home
              </a>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}