import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, Image as ImageIcon, Award, Loader2, Check, Sparkles, Newspaper, Tag, Link2, Search, UserPlus, BookUser, IdCard, Mail, Heart, HelpCircle, Eye, MessageSquare, AlertCircle, MapPin, Calendar, RefreshCw, X, Video, Music, Lock } from 'lucide-react';
import PublicationFields from '@/components/PublicationFields';
import MissingFieldPrompts from '@/components/MissingFieldPrompts';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import { getMessages, subscribe } from '@/lib/assistantStore';
import AncestorMatchDialog from '@/components/AncestorMatchDialog';
import LocationPicker from '@/components/LocationPicker';
import BulkUpload from '@/components/BulkUpload';
import MentionTextarea from '@/components/MentionTextarea';
import NewAncestorDialog from '@/components/NewAncestorDialog';
import DuplicateResolutionDialog from '@/components/DuplicateResolutionDialog';
import FocalPointEditor from '@/components/FocalPointEditor';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import DateSelectInput from '@/components/DateSelectInput';
import { analyzeCrop } from '@/lib/cropAnalysis';
import { generatePdfThumbnail } from '@/lib/pdfThumbnail';
import { Link } from 'react-router-dom';
import { useAccessRights } from '@/hooks/useAccessRights';

const STEPS = {
  CAPTURE: 'capture',
  ANALYSING: 'analysing',
  FORM: 'form',
  SAVED: 'saved',
};

const typeOptions = [
  { value: 'photo', label: 'Photo', icon: ImageIcon },
  { value: 'narrative', label: 'Narrative', icon: FileText },
  { value: 'correspondence', label: 'Letter', icon: Mail },
  { value: 'press_clipping', label: 'Press', icon: Newspaper },
  { value: 'certificate', label: 'Certificate', icon: Award },
  { value: 'passport', label: 'Passport', icon: BookUser },
  { value: 'identity_document', label: 'ID Doc', icon: IdCard },
  { value: 'memorial', label: 'Memorial', icon: Heart },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'uncategorized', label: 'Other', icon: HelpCircle },
];

const INITIAL_FORM = {
  title: '',
  description: '',
  date: '',
  location_name: '',
  latitude: '',
  longitude: '',
  publication_date: '',
  publication_location_name: '',
  publication_latitude: '',
  publication_longitude: '',
  ancestor_ids: [],
  era: '',
  external_url: '',
  comment: '',
  is_query: false,
  tagged_user_ids: [],
};

// Content types where the record itself (issue/publication) is distinct from
// the event it documents — these get the "The Document" form section.
const DOCUMENT_TYPES = ['certificate', 'press_clipping', 'passport', 'identity_document', 'correspondence', 'memorial'];

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
  const [formData, setFormData] = useState(INITIAL_FORM);
  // ── STABLE missing-field tracking ──
  // Set ONLY during runAnalysis and explicit × dismiss. NEVER affected by typing.
  const [missingFields, setMissingFields] = useState({});
  const [dismissedFields, setDismissedFields] = useState({});
  const [ancestors, setAncestors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedAncestorId, setSelectedAncestorId] = useState('');
  const [attachToProfile, setAttachToProfile] = useState(false);
  const [ancestorSearch, setAncestorSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [matchDialog, setMatchDialog] = useState(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(getMessages());
  const [refreshing, setRefreshing] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [newAncestorOpen, setNewAncestorOpen] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [focalPointReview, setFocalPointReview] = useState(null);
  const [cropData, setCropData] = useState(null);
  const [analyzingFocalPoint, setAnalyzingFocalPoint] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const thumbnailPromiseRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const access = useAccessRights();


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
    base44.entities.User.list().then(setUsers).catch(() => {});
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => subscribe(setAssistantMessages), []);

  if (access.status === 'loading') {
    return <Layout><div className="flex justify-center py-24"><Loader2 size={28} className="text-gold animate-spin" /></div></Layout>;
  }
  if (!access.canInteract) {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
          <h1 className="font-display text-4xl text-parchment mb-2">Upload an Event</h1>
          <p className="text-parchment/50 text-sm mb-8">Share a piece of family history — the system will analyse it and help you tag it.</p>
          <div className="aged-card rounded-2xl p-10 text-center">
            <Lock size={36} className="text-gold/40 mx-auto mb-4" />
            <h2 className="font-display text-xl text-parchment mb-2">Branch Access Required</h2>
            <p className="text-parchment/50 text-sm mb-6 max-w-md mx-auto leading-relaxed">
              {access.status === 'pending'
                ? "Your branch membership is awaiting approval from the branch admin. You'll be able to upload once approved."
                : "Uploading is reserved for approved branch members. Browse the branches and request access from a branch admin."}
            </p>
            <Link to="/branches" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity">
              View Branches
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Prompt visibility helpers ──
  // A prompt shows if AI flagged it as missing AND the user hasn't dismissed it.
  // This is completely independent of field values — typing NEVER hides a prompt.
  const isPromptVisible = (field) => missingFields[field] && !dismissedFields[field];
  const dismissField = (field) => setDismissedFields(prev => ({ ...prev, [field]: true }));

  const runAnalysis = async (url, selectedFile, feedback) => {
    const feedbackSection = feedback
      ? `\n\n--- USER FEEDBACK / CORRECTIONS ---\nThe user has provided the following guidance after reviewing the initial analysis. Please incorporate these corrections and re-analyse the image accordingly, adjusting classification, extracted fields, transcription, title, description, tags, and any other relevant data:\n${feedback}\n--- END USER FEEDBACK ---\n`
      : '';

    const fileName = selectedFile?.name || '';
    const fileNameSection = fileName
      ? `\n\n--- FILE NAME CONTEXT ---\nThe uploaded file is named: "${fileName}".\nFile names often contain valuable genealogical metadata — names of people, places, dates, document types, or other identifying information. Parse the file name carefully and use ANY information found in it to populate the extracted fields, suggested title, description, event location, and tags. For example:\n- "Birth Certificate - Giuseppe Freddi 1898 Venice.jpg" → full_name: Giuseppe Freddi, date_of_birth/place_of_birth from 1898 and Venice\n- "Alfredo military discharge 1901 La Spezia.pdf" → full_name: Alfredo, date_of_event: 1901, place_of_event: La Spezia\n- "Freddi family Melbourne 1955.png" → locations_visible: Melbourne, dates_visible: 1955\nTreat file name data as a strong hint, but always cross-reference with what you see in the image itself. If the file name and image conflict, prefer the image.\n--- END FILE NAME CONTEXT ---\n`
      : '';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a sophisticated genealogical and historical document analyst working on a family history archive. You are analysing an image that could be ANYTHING — a photograph (portrait, landscape, group photo), a document (certificate, letter, passport, newspaper), a poster, a concert ticket, a postcard, a drawing, a map, a receipt, or any other type of visual artifact from a family's history.

Your job is to:
1. Identify what the image IS — but be honest about uncertainty
2. Extract ALL visible data — every piece of text, every visible object, every person, every date, every location, every notable visual element
3. Provide a confidence score for your classification
4. Note your reasoning — what visual elements led to your conclusion, and what uncertainty remains
5. IMPORTANT: Also parse the FILE NAME for any names, locations, dates, document types, or other metadata — file names are a valuable data source provided by the uploader

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
  "suggested_tags": ["array", "of", "relevant", "tags", "e.g. 'immigration', 'Victoria', '1890s', 'Freddi bloodline', 'concert', 'poster']" + fileNameSection + feedbackSection}`,
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

    // ── Ancestor name matching ──
    const allTextSources = [
      result.extracted_fields?.full_name,
      result.extracted_fields?.mother_name,
      result.extracted_fields?.father_name,
      result.extracted_fields?.spouse_name,
      result.extracted_fields?.witnesses,
      result.extracted_fields?.given_names,
      result.extracted_fields?.surname,
      result.suggested_title,
      result.suggested_description,
      result.transcription,
      ...(result.visual_elements?.people || []),
      ...(result.visual_elements?.text_elements || []),
      ...(result.visual_elements?.locations_visible || []),
      fileName,
    ].filter(Boolean).join(' ');

    const lowerText = allTextSources.toLowerCase();
    const exactMatches = [];
    const nearMatches = [];

    if (ancestors.length > 0 && allTextSources.trim()) {
      for (const ancestor of ancestors) {
        const fullName = (ancestor.full_name || '').toLowerCase().trim();
        if (!fullName) continue;
        const parts = fullName.split(/\s+/);
        const givenName = parts[0];
        const surname = parts.length > 1 ? parts[parts.length - 1] : '';

        if (lowerText.includes(fullName)) {
          exactMatches.push({ ancestor, reason: 'Full name found in extracted data' });
        } else if (surname && givenName.length > 2 && lowerText.includes(surname) && lowerText.includes(givenName)) {
          nearMatches.push({ ancestor, reason: `First name "${givenName}" and surname "${surname}" found separately` });
        } else if (givenName.length > 2 && lowerText.includes(givenName)) {
          const sameGivenName = ancestors.filter(a =>
            (a.full_name || '').toLowerCase().split(/\s+/)[0] === givenName
          );
          if (sameGivenName.length === 1) {
            nearMatches.push({ ancestor, reason: `First name "${givenName}" found (unique match)` });
          }
        }
      }
    }

    const exactMatchIds = exactMatches.map(m => m.ancestor.id);
    let autoTaggedIds = [...exactMatchIds];
    if (selectedAncestorId) autoTaggedIds.push(selectedAncestorId);
    autoTaggedIds = [...new Set(autoTaggedIds)];

    const matchedAncestorId = exactMatchIds[0] || selectedAncestorId || '';
    if (matchedAncestorId) setSelectedAncestorId(matchedAncestorId);

    const eventLocation = result.event_location
      || result.extracted_fields?.place_of_event
      || result.extracted_fields?.place_of_birth
      || result.extracted_fields?.place_of_death
      || result.extracted_fields?.place_of_issue
      || result.extracted_fields?.residence_address
      || result.extracted_fields?.port_of_arrival
      || result.visual_elements?.locations_visible?.[0]
      || '';

    const eventDate = result.extracted_fields?.date_of_event || result.extracted_fields?.date_of_birth || '';
    const eventDescription = result.suggested_description || '';

    // ── STABLE missing-field tracking ──
    // Set once during analysis based on what AI found.
    // These flags do NOT change when the user types — only on re-analysis or explicit × dismiss.
    setMissingFields({
      location: !eventLocation,
      date: !eventDate,
      description: !eventDescription || result.type === 'uncategorized',
    });
    setDismissedFields({});

    // Publication / issue date + location \u2014 distinct from the event.
    // For certificates/IDs: date_of_issue / place_of_issue.
    // For press clippings: the masthead publication date / newspaper city
    //   (often not in extracted_fields, so fall back to event_location only if
    //   it's clearly a publication city \u2014 otherwise leave blank for the user).
    const publicationDate = result.extracted_fields?.date_of_issue || '';
    const publicationLocation = result.extracted_fields?.place_of_issue || '';

    setFormData(f => ({
      ...f,
      title: result.suggested_title || (selectedFile?.name ? selectedFile.name.replace(/\.[^.]+$/, '') : ''),
      description: eventDescription,
      date: eventDate,
      location_name: eventLocation,
      publication_date: publicationDate,
      publication_location_name: publicationLocation,
      ancestor_ids: autoTaggedIds,
    }));

    if (matchedAncestorId && (
      (result.type === 'certificate' && (result.document_subtype === 'birth_certificate' || result.document_subtype === 'marriage_certificate')) ||
      result.type === 'passport'
    )) {
      setAttachToProfile(true);
    }

    setStep(STEPS.FORM);

    if (exactMatches.length === 0 && nearMatches.length > 0) {
      setMatchDialog({ mode: 'confirm', matches: nearMatches });
    } else if (exactMatches.length === 0 && nearMatches.length === 0 && !selectedAncestorId) {
      setMatchDialog({ mode: 'prompt' });
    }

    return { type: result.type, extracted_fields: result.extracted_fields, transcription: result.transcription, suggested_title: result.suggested_title, autoTaggedIds, eventDate, eventLocation };
  };

  const handleRefreshAnalysis = async () => {
    if (!fileUrl || !file || refreshing) return;
    setRefreshing(true);
    setStep(STEPS.ANALYSING);
    try {
      const feedback = assistantMessages.length > 0
        ? assistantMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
        : '';
      await runAnalysis(fileUrl, file, feedback);
    } catch (e) {
      setClassification('uncategorized');
      setStep(STEPS.FORM);
    }
    setRefreshing(false);
  };

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setStep(STEPS.ANALYSING);
    setCropData(null);
    setDuplicateCheck(null);
    setAnalyzingFocalPoint(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const url = uploadRes.file_url;
      setFileUrl(url);

      // For PDF documents, render the first page to a JPEG thumbnail so the
      // record shows a visual preview on cards/detail (an <img> can't render a PDF).
      if (selectedFile.type === 'application/pdf') {
        setGeneratingThumb(true);
        thumbnailPromiseRef.current = generatePdfThumbnail(url)
          .then(blob => base44.integrations.Core.UploadFile({ file: new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) }))
          .then(r => { setThumbnailUrl(r.file_url); return r.file_url; })
          .catch(() => null)
          .finally(() => setGeneratingThumb(false));
      }

      // Run crop analysis in parallel with main analysis (fire-and-forget — results show when ready)
      const isImage = selectedFile.type.startsWith('image/');
      if (isImage) {
        analyzeCrop(url).then(crop => {
          if (crop) {
            setCropData(crop);
            setFocalPointReview({
              fileUrl: url,
              title: selectedFile?.name?.replace(/\.[^.]+$/, '') || '',
              focalX: crop.focal_point_x,
              focalY: crop.focal_point_y,
              cropBounds: crop.crop_bounds,
              reasoning: crop.reasoning,
            });
          }
        }).catch(() => {}).finally(() => setAnalyzingFocalPoint(false));
      } else {
        setAnalyzingFocalPoint(false);
      }

      const analysis = await runAnalysis(url, selectedFile);

      // Run duplicate check with pre-save item data (fire-and-forget)
      base44.functions.invoke('checkDuplicateUpload', {
        item_data: {
          file_url: url,
          title: analysis?.suggested_title || selectedFile?.name || '',
          content_type: analysis?.type || 'uncategorized',
          date: analysis?.eventDate || null,
          location_name: analysis?.eventLocation || '',
          transcribed_text: analysis?.transcription || '',
          extracted_fields: analysis?.extracted_fields || {},
          ancestor_ids: analysis?.autoTaggedIds || [],
        }
      }).then(res => {
        const dups = res.data?.potential_duplicates || [];
        if (dups.length > 0) {
          setDuplicateCheck({ duplicates: dups, itemTitle: analysis?.suggested_title || selectedFile?.name || '' });
        }
      }).catch(() => {});
    } catch (e) {
      setClassification('uncategorized');
      setStep(STEPS.FORM);
      setAnalyzingFocalPoint(false);
    }
  };

  const resetForm = () => {
    setStep(STEPS.CAPTURE);
    setFile(null);
    setFileUrl(null);
    setClassification(null);
    setDocumentSubtype(null);
    setExtractedData(null);
    setTranscribedText('');
    setSuggestedTags([]);
    setSelectedAncestorId('');
    setAttachToProfile(false);
    setAncestorSearch('');
    setRawAiAnalysis(null);
    setAiConfidence(null);
    setCategorizationNotes('');
    setVisualElements(null);
    setMatchDialog(null);
    setRefreshing(false);
    setMissingFields({});
    setDismissedFields({});
    setNewAncestorOpen(false);
    setFocalPointReview(null);
    setAnalyzingFocalPoint(false);
    setCropData(null);
    setDuplicateCheck(null);
    setThumbnailUrl(null);
    setGeneratingThumb(false);
    thumbnailPromiseRef.current = null;
    setFormData(INITIAL_FORM);
  };

  // ── Required field checks at save time ──
  const effectiveAncestorIds = selectedAncestorId
    ? [...new Set([...formData.ancestor_ids, selectedAncestorId])]
    : formData.ancestor_ids;

  const requiredChecks = {
    ancestor: effectiveAncestorIds.length > 0,
    location: !!formData.location_name?.trim(),
    date: !!formData.date,
    description: !!formData.title?.trim(),
  };

  const missingRequired = Object.entries(requiredChecks).filter(([, v]) => !v).map(([k]) => k);

  const handleSave = async () => {
    setSaving(true);
    try {
      const contentType = classification;
      const currentUser = await base44.auth.me().catch(() => null);

      // Build notes about what's missing for admin review
      const missingLabels = {
        ancestor: 'No ancestor tagged',
        location: 'No event location provided',
        date: 'No event date provided',
        description: 'No title/description provided',
      };
      const isAdminUser = currentUser?.role === 'admin';
      const missingNotes = missingRequired.map(k => missingLabels[k]).filter(Boolean);
      // Admin uploads are pre-approved — no admin review task needed
      const needsReview = !isAdminUser && missingRequired.length > 0;

      const itemData = {
        title: formData.title,
        content_type: contentType,
        description: formData.description,
        date: formData.date || null,
        location_name: formData.location_name,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        publication_date: formData.publication_date || null,
        publication_location_name: formData.publication_location_name || null,
        publication_latitude: formData.publication_latitude ? parseFloat(formData.publication_latitude) : null,
        publication_longitude: formData.publication_longitude ? parseFloat(formData.publication_longitude) : null,
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
        categorization_notes: needsReview
          ? `${categorizationNotes || ''}\n\n⚠ FLAGGED FOR ADMIN REVIEW — Missing data:\n${missingNotes.join('\n')}`.trim()
          : categorizationNotes || null,
        focal_point_x: cropData?.focal_point_x ?? 0.5,
        focal_point_y: cropData?.focal_point_y ?? 0.4,
        shot_type: cropData?.shot_type || null,
        crop_bounds: cropData?.crop_bounds || null,
        thumbnail_url: thumbnailUrl || null,
        visual_elements: visualElements || null,
        uploaded_by_id: currentUser?.id || null,
        conflict_flag_status: 'none',
        review_status: isAdminUser ? 'reviewed' : (needsReview ? 'flagged' : 'pending'),
        tags: [...activeTags, ...(needsReview ? ['admin_review_required'] : [])],
      };

      const createdItem = await base44.entities.ContentItem.create(itemData);

      // If the PDF thumbnail is still rendering at save time, persist it once ready
      if (thumbnailPromiseRef.current) {
        Promise.resolve(thumbnailPromiseRef.current).then((thumb) => {
          if (thumb && !thumbnailUrl) {
            base44.entities.ContentItem.update(createdItem.id, { thumbnail_url: thumb }).catch(() => {});
          }
        });
      }

      // Create initial comment if provided
      if (formData.comment?.trim()) {
        await base44.entities.Comment.create({
          entity_type: 'ContentItem',
          entity_id: createdItem.id,
          field_name: 'general_discussion',
          content: formData.comment.trim(),
          author_id: currentUser?.id || null,
          author_name: currentUser?.full_name || currentUser?.email || 'Family Member',
          parent_comment_id: null,
          tagged_user_ids: formData.tagged_user_ids.length > 0 ? formData.tagged_user_ids : null,
          is_query: formData.is_query,
          acknowledged_by: [],
        }).catch(() => {});
      }

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

      if (currentUser) {
        await base44.entities.ActivityLog.create({
          action_type: 'upload',
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          content_item_title: formData.title,
          description: `Uploaded "${formData.title}" (${contentType})${needsReview ? ' — flagged for admin review (incomplete data)' : ''}`,
        }).catch(() => {});
      }

      // Auto-extract family relationships from certificate-type documents
      if (['certificate', 'passport', 'identity_document'].includes(contentType)) {
        await base44.functions.invoke('generateFamilyLinks', { content_item_id: createdItem.id }).catch(() => {});
      }

      // Run the narrative text analysis (chronicle/newsletter extraction) for
      // any item that carries transcribed text \u2014 fire-and-forget; results land
      // on the ContentDetail page when ready.
      if (transcribedText) {
        base44.functions.invoke('analyzeContentText', { content_item_id: createdItem.id }).catch(() => {});
      }

      setStep(STEPS.SAVED);

      // If duplicates were detected pre-save, attach the saved item ID for the resolution dialog
      if (duplicateCheck) {
        setDuplicateCheck(prev => ({ ...prev, itemId: createdItem.id }));
      }
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

  const hasAncestor = effectiveAncestorIds.length > 0;


  const handleLocationPick = ({ location_name, latitude, longitude }) => {
    setFormData(f => ({
      ...f,
      location_name,
      latitude,
      longitude,
    }));
  };

  const handleMatchConfirm = (selectedIds) => {
    setFormData(f => ({
      ...f,
      ancestor_ids: [...new Set([...f.ancestor_ids, ...selectedIds])],
    }));
    if (selectedIds[0] && !selectedAncestorId) setSelectedAncestorId(selectedIds[0]);
    setMatchDialog(null);
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
              <div className="flex justify-center gap-2 mb-6">
                <button onClick={() => setBulkMode(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!bulkMode ? 'bg-[rgba(201,145,58,0.12)] text-gold border border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border border-transparent'}`}>
                  Single Upload
                </button>
                <button onClick={() => setBulkMode(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${bulkMode ? 'bg-[rgba(201,145,58,0.12)] text-gold border border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border border-transparent'}`}>
                  Other Uploads
                </button>
              </div>

              {bulkMode ? (
                <BulkUpload ancestors={ancestors} preselectedAncestorId={selectedAncestorId} user={user} />
              ) : (
                <>
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
                </>
              )}
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
            {/* Content type selector — all categories */}
            <div className="aged-card rounded-xl p-4">
              <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Content Type {aiConfidence !== null && <span className="ml-1 text-parchment/30 normal-case tracking-normal">(AI detected — change if needed)</span>}</p>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = (classification || 'uncategorized') === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setClassification(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${isActive ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.12)] text-parchment/50 hover:border-[rgba(201,145,58,0.25)]'}`}>
                      <Icon size={14} /> {opt.label}
                    </button>
                  );
                })}
              </div>
              {documentSubtype && documentSubtype !== 'other_official_record' && (
                <p className="text-xs text-amber-light/60 mt-2">Subtype: {documentSubtype.replace(/_/g, ' ')}</p>
              )}
            </div>

            {/* ── MISSING FIELD PROMPTS ── */}
            {/* Controlled by missingFields + dismissedFields only; typing never hides them. */}
            <MissingFieldPrompts
              isVisible={isPromptVisible}
              dismissField={dismissField}
              form={formData}
              setForm={setFormData}
              openLocationPicker={() => setLocationPickerOpen(true)}
            />

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

            {/* Preview + Refresh AI Analysis */}
            {fileUrl && file && (
              <div className="aged-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-parchment/40 uppercase tracking-wider">Preview</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshAnalysis}
                      disabled={refreshing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50"
                    >
                      {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Refresh AI Analysis
                    </button>
                    <button
                      onClick={resetForm}
                      disabled={refreshing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] border border-[rgba(245,236,215,0.15)] text-parchment/60 text-xs font-medium hover:bg-[rgba(245,236,215,0.1)] hover:text-parchment transition-colors disabled:opacity-50"
                    >
                      <X size={14} />
                      Cancel Upload
                    </button>
                  </div>
                </div>
                {file.type.startsWith('image/') && (
                  <img src={fileUrl} alt="preview" className="max-h-64 mx-auto rounded-lg sepia-tint" />
                )}
                {file.type === 'application/pdf' && (
                  <>
                    <iframe src={fileUrl} title="preview" className="w-full h-80 rounded-lg bg-parchment" />
                    {generatingThumb && (
                      <p className="text-xs text-amber-light/60 mt-2 text-center flex items-center justify-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Generating document thumbnail...
                      </p>
                    )}
                    {thumbnailUrl && (
                      <p className="text-xs text-green-300/70 mt-2 text-center">✓ Thumbnail preview generated</p>
                    )}
                  </>
                )}
                {assistantMessages.length > 0 && (
                  <p className="text-xs text-parchment/40 mt-2 text-center">
                    Re-analysis will incorporate {assistantMessages.length} message{assistantMessages.length !== 1 ? 's' : ''} from the AI assistant chat
                  </p>
                )}
                {analyzingFocalPoint && (
                  <p className="text-xs text-amber-light/60 mt-2 text-center flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Analyzing optimal image crop...
                  </p>
                )}
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

            {/* Event details form */}
            <div className="aged-card rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-lg text-parchment">The Event</h3>
                <p className="text-xs text-parchment/40 mt-0.5">The date and place the event itself took place — a birth, a historic occasion, the day a photo was taken.</p>
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1">
                  Title <span className="text-[#C9913A] text-xs">*</span>
                  {!requiredChecks.description && <span className="text-xs text-red-400/70 ml-1">required</span>}
                </label>
                <input value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Description</label>
                <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1">
                    Date <span className="text-[#C9913A] text-xs">*</span>
                    {!requiredChecks.date && <span className="text-xs text-red-400/70 ml-1">required</span>}
                  </label>
                  <DateSelectInput value={formData.date} onChange={v => setFormData(f => ({ ...f, date: v }))} className="w-full" />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Era (optional)</label>
                  <input value={formData.era} onChange={e => setFormData(f => ({ ...f, era: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="e.g. Early 1900s" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1">
                    Event Location <span className="text-[#C9913A] text-xs">*</span>
                    {!requiredChecks.location && <span className="text-xs text-red-400/70 ml-1">required</span>}
                  </label>
                  <div className="flex gap-2">
                    <LocationAutocompleteInput
                      value={formData.location_name}
                      onChange={({ location_name, latitude, longitude }) => setFormData(f => ({
                        ...f,
                        location_name,
                        latitude: latitude !== undefined ? latitude : f.latitude,
                        longitude: longitude !== undefined ? longitude : f.longitude,
                      }))}
                      placeholder="Where the photo was taken or event occurred"
                      className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
                    />
                    <button
                      type="button"
                      onClick={() => setLocationPickerOpen(true)}
                      className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0"
                    >
                      <MapPin size={14} /> Map
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Latitude</label>
                  <input type="number" step="any" value={formData.latitude} onChange={e => setFormData(f => ({ ...f, latitude: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="-37.81" />
                </div>
                <div>
                  <label className="text-sm text-parchment/60 mb-1 block">Longitude</label>
                  <input type="number" step="any" value={formData.longitude} onChange={e => setFormData(f => ({ ...f, longitude: e.target.value }))}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="144.96" />
                </div>
              </div>
              {/* Comment section with hover tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-sm text-parchment/60 flex items-center gap-1.5">
                    <MessageSquare size={14} /> Comment
                  </label>
                  <div className="relative group">
                    <HelpCircle size={14} className="text-parchment/30 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 rounded-lg bg-[#1A1614] border border-[rgba(201,145,58,0.3)] text-xs text-parchment w-72 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg">
                    <p className="font-semibold text-amber-light mb-1.5">Comment or Raise a Query</p>
                    <p className="text-parchment/70 leading-relaxed mb-1.5"><span className="text-gold">Comment:</span> Share a memory or note about this event.</p>
                    <p className="text-parchment/70 leading-relaxed mb-1.5"><span className="text-gold">Query:</span> Flag a data point for review by a family member.</p>
                    <div className="border-t border-[rgba(201,145,58,0.15)] pt-1.5 mt-1.5">
                      <p className="text-parchment/50 leading-relaxed">To raise a query: write your question, toggle to <span className="text-amber-light">Query</span> mode, then type <span className="text-amber-light">@Peter FREDDI</span> in the comment box to tag a family member. They'll be notified and the query appears in their Tasks area.</p>
                    </div>
                  </div>
                  </div>
                </div>
                <MentionTextarea
                  value={formData.comment}
                  onChange={(val) => setFormData(f => ({ ...f, comment: val }))}
                  onTaggedUsersChange={(ids) => setFormData(f => ({ ...f, tagged_user_ids: ids }))}
                  taggedUserIds={formData.tagged_user_ids}
                  users={users}
                  currentUser={user}
                  rows={3}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                  placeholder="Add a comment or raise a query about this event... (type @ to tag someone)"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFormData(f => ({ ...f, is_query: !f.is_query }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${formData.is_query ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)]'}`}
                  >
                    <HelpCircle size={12} /> {formData.is_query ? 'Query' : 'Comment'}
                  </button>
                  <button
                    onClick={() => setShowTagPicker(!showTagPicker)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${showTagPicker ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:border-[rgba(201,145,58,0.4)]'}`}
                  >
                    <Tag size={12} /> Tag {formData.tagged_user_ids.length > 0 && `(${formData.tagged_user_ids.length})`}
                  </button>
                  {users.filter(u => u.id !== user?.id && formData.tagged_user_ids.includes(u.id)).map(u => (
                    <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)]">
                      {u.full_name || u.email}
                      <button onClick={() => setFormData(f => ({ ...f, tagged_user_ids: f.tagged_user_ids.filter(id => id !== u.id) }))} className="text-parchment/30 hover:text-parchment">✕</button>
                    </span>
                  ))}
                </div>
                {showTagPicker && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[rgba(201,145,58,0.15)] bg-[#0D0B0A]">
                    {users.filter(u => u.id !== user?.id).length === 0 ? (
                      <p className="px-4 py-3 text-xs text-parchment/40">No other family members to tag.</p>
                    ) : (
                      users.filter(u => u.id !== user?.id).map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setFormData(f => ({
                              ...f,
                              tagged_user_ids: f.tagged_user_ids.includes(u.id)
                                ? f.tagged_user_ids.filter(id => id !== u.id)
                                : [...f.tagged_user_ids, u.id]
                            }));
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${formData.tagged_user_ids.includes(u.id) ? 'bg-[rgba(201,145,58,0.1)]' : 'hover:bg-[rgba(201,145,58,0.05)]'}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-xs text-gold">
                            {(u.full_name || u.email).charAt(0)}
                          </div>
                          <span className="text-sm text-parchment">{u.full_name || u.email}</span>
                          {formData.tagged_user_ids.includes(u.id) && <span className="ml-auto text-gold text-xs">✓</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Ancestor tagging */}
              <div>
                <label className="text-sm text-parchment/60 mb-2 block flex items-center gap-1">
                  Tag Ancestors <span className="text-[#C9913A] text-xs">*</span>
                  {!requiredChecks.ancestor && <span className="text-xs text-red-400/70 ml-1">at least one required</span>}
                </label>
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
                  <button
                    onClick={() => setNewAncestorOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-[rgba(201,145,58,0.3)] text-amber-light/70 hover:border-[#C9913A] hover:text-gold transition-colors"
                  >
                    <UserPlus size={14} /> Enter New Ancestor
                  </button>
                </div>
              </div>
            </div>

            {/* The Document — issue/publication date + location (distinct from the event) */}
            {DOCUMENT_TYPES.includes(classification) && (
              <PublicationFields form={formData} onChange={(k, v) => setFormData(f => ({ ...f, [k]: v }))} />
            )}

            {/* Duplicate warning — pre-save detection */}
            {duplicateCheck && (
              <div className="aged-card rounded-xl p-4 flex items-start gap-3 border-[rgba(201,145,58,0.3)]">
                <AlertCircle size={20} className="text-amber-light flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-parchment font-medium">Potential duplicate detected</p>
                  <p className="text-xs text-parchment/40 mt-1">
                    This may be a duplicate of an existing item ({duplicateCheck.duplicates.length} match{duplicateCheck.duplicates.length !== 1 ? 'es' : ''} found).
                    You can still save — a resolution dialog will appear after saving to merge or resolve.
                  </p>
                </div>
              </div>
            )}

            {/* Incomplete data warning — shows what will be flagged for admin review */}
            {missingRequired.length > 0 && (
              <div className="aged-card rounded-xl p-4 flex items-start gap-3 border-[rgba(201,145,58,0.3)]">
                <AlertCircle size={20} className="text-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-parchment font-medium">Incomplete event data</p>
                  <p className="text-xs text-parchment/40 mt-1">
                    The following required data is missing: <span className="text-amber-light/70">{missingRequired.map(m => ({ ancestor: 'Ancestor', location: 'Event Location', date: 'Event Date', description: 'Title/Description' })[m]).join(', ')}</span>.
                    You can still save this upload — it will be flagged for admin review so the missing information can be completed later.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity gold-glow"
              >
                {saving ? <Loader2 size={20} className="animate-spin mx-auto" /> : missingRequired.length > 0 ? 'Save to Archive (flagged for review)' : 'Save to Archive'}
              </button>
              <button
                onClick={resetForm}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg border border-[rgba(245,236,215,0.15)] text-parchment/70 font-medium hover:bg-[rgba(245,236,215,0.05)] hover:text-parchment transition-colors disabled:opacity-50"
              >
                <X size={16} /> Cancel
              </button>
            </div>
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
              <button
                onClick={resetForm}
                className="px-5 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors"
              >
                Upload Another
              </button>
              <a href="/" className="px-5 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity inline-block">
                Back to Home
              </a>
            </div>
            {analyzingFocalPoint && (
              <div className="mt-6 pt-4 border-t border-[rgba(201,145,58,0.1)] flex items-center justify-center gap-2 text-sm text-parchment/50">
                <Loader2 size={16} className="animate-spin text-gold" />
                Analyzing optimal image crop...
              </div>
            )}
          </div>
        )}
      </div>

      {matchDialog && (
        <AncestorMatchDialog
          mode={matchDialog.mode}
          matches={matchDialog.matches}
          ancestors={ancestors}
          onConfirm={handleMatchConfirm}
          onDismiss={() => setMatchDialog(null)}
          onAncestorCreated={(newAncestor) => setAncestors(prev => [...prev, newAncestor])}
        />
      )}

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onPick={handleLocationPick}
        initialLocation={formData.location_name}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />

      <NewAncestorDialog
        open={newAncestorOpen}
        onClose={() => setNewAncestorOpen(false)}
        onCreated={(created) => {
          setAncestors(prev => [...prev, created]);
          setFormData(f => ({ ...f, ancestor_ids: [...new Set([...f.ancestor_ids, created.id])] }));
          if (!selectedAncestorId) setSelectedAncestorId(created.id);
        }}
        user={user}
      />

      {focalPointReview && (
        <FocalPointEditor
          fileUrl={focalPointReview.fileUrl}
          title={focalPointReview.title}
          focalX={focalPointReview.focalX}
          focalY={focalPointReview.focalY}
          cropBounds={focalPointReview.cropBounds}
          reasoning={focalPointReview.reasoning}
          onApprove={(coords) => {
            setCropData(prev => ({ ...prev, ...coords }));
            setFocalPointReview(null);
          }}
          onClose={() => setFocalPointReview(null)}
        />
      )}

      {duplicateCheck?.itemId && (
        <DuplicateResolutionDialog
          duplicates={duplicateCheck.duplicates}
          newItemId={duplicateCheck.itemId}
          newItemTitle={duplicateCheck.itemTitle}
          user={user}
          onClose={() => setDuplicateCheck(null)}
          onRemoved={() => { setDuplicateCheck(null); resetForm(); }}
          onMerged={() => { setDuplicateCheck(null); resetForm(); }}
        />
      )}

    </Layout>
  );
}