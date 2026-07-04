import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, Image as ImageIcon, Award, Loader2, Check, Sparkles } from 'lucide-react';
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
  const [extractedData, setExtractedData] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
        prompt: `Analyse this uploaded image. Determine if it is:
1. A PHOTOGRAPH (of a person, place, or event) — respond with type "photo"
2. A NARRATIVE TEXT document (letter, diary entry, news clipping, story) — respond with type "narrative" and transcribe the full text
3. A CERTIFICATE or formal record (birth, death, marriage, immigration, church record, passenger manifest) — respond with type "certificate" and extract all key fields

Return JSON with this structure:
{
  "type": "photo" | "narrative" | "certificate",
  "transcription": "full text if narrative, otherwise empty",
  "extracted_fields": {
    "full_name": "", "date_of_birth": "", "place_of_birth": "", "date_of_death": "", "place_of_death": "",
    "mother_name": "", "father_name": "", "spouse_name": "", "witnesses": "", "issuing_authority": "", "date_of_event": "", "place_of_event": ""
  },
  "suggested_title": "a short descriptive title for this item",
  "suggested_description": "a brief description"
}`,
        file_urls: [url],
        response_json_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['photo', 'narrative', 'certificate'] },
            transcription: { type: 'string' },
            extracted_fields: { type: 'object' },
            suggested_title: { type: 'string' },
            suggested_description: { type: 'string' },
          },
        },
      });

      setClassification(result.type);
      if (result.transcription) setTranscribedText(result.transcription);
      if (result.extracted_fields) setExtractedData(result.extracted_fields);
      setFormData(f => ({
        ...f,
        title: result.suggested_title || '',
        description: result.suggested_description || '',
        date: result.extracted_fields?.date_of_event || result.extracted_fields?.date_of_birth || '',
        location_name: result.extracted_fields?.place_of_event || result.extracted_fields?.place_of_birth || '',
      }));
      setStep(STEPS.FORM);
    } catch (e) {
      setClassification('photo');
      setStep(STEPS.FORM);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const contentType = classification === 'photo' ? 'photo' :
        classification === 'narrative' ? 'narrative' :
        classification === 'certificate' ? 'certificate' : 'photo';

      const user = await base44.auth.me().catch(() => null);

      const itemData = {
        title: formData.title,
        content_type: contentType,
        description: formData.description,
        date: formData.date || null,
        location_name: formData.location_name,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        ancestor_ids: formData.ancestor_ids,
        era: formData.era,
        file_url: fileUrl,
        external_url: formData.external_url,
        transcribed_text: transcribedText || null,
        extracted_fields: extractedData || null,
        uploaded_by_id: user?.id || null,
        conflict_flag_status: 'none',
      };

      await base44.entities.ContentItem.create(itemData);

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
            <p className="text-parchment/60 text-sm mb-6 text-center">Choose a file from your device or use your camera to photograph a document or photo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
              >
                <Camera size={32} className="text-gold" />
                <span className="text-parchment font-medium">Use Camera</span>
                <span className="text-xs text-parchment/40">Photograph a document or photo</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.05)] transition-all"
              >
                <Upload size={32} className="text-gold" />
                <span className="text-parchment font-medium">Choose File</span>
                <span className="text-xs text-parchment/40">From your device</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />

            <div className="mt-6 pt-6 border-t border-[rgba(201,145,58,0.1)]">
              <p className="text-xs text-parchment/40 text-center">Supported: photographs, letters, certificates, press clippings</p>
            </div>
          </div>
        )}

        {step === STEPS.ANALYSING && (
          <div className="aged-card rounded-2xl p-12 text-center">
            {file && (
              <div className="mb-6 flex justify-center">
                <img src={URL.createObjectURL(file)} alt="preview" className="max-h-48 rounded-lg sepia-tint" />
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
              {classification === 'certificate' && <Award size={24} className="text-gold" />}
              <div>
                <p className="text-xs text-parchment/40 uppercase tracking-wider">Detected Type</p>
                <p className="text-parchment capitalize font-medium">
                  {classification === 'photo' ? 'Photograph' : classification === 'narrative' ? 'Narrative Document' : 'Certificate / Formal Record'}
                </p>
              </div>
            </div>

            {/* Preview */}
            {fileUrl && (
              <div className="aged-card rounded-xl p-4">
                <img src={fileUrl} alt="preview" className="max-h-64 mx-auto rounded-lg sepia-tint" />
              </div>
            )}

            {/* Extracted certificate fields */}
            {classification === 'certificate' && extractedData && (
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
            {classification === 'narrative' && transcribedText && (
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
                  <label className="text-sm text-parchment/60 mb-1 block">Location Name</label>
                  <input value={formData.location_name} onChange={e => setFormData({...formData, location_name: e.target.value})}
                    className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]" placeholder="Melbourne, VIC" />
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
              <button onClick={() => { setStep(STEPS.CAPTURE); setFile(null); setFileUrl(null); setClassification(null); setExtractedData(null); setTranscribedText(''); setFormData({title:'',description:'',date:'',location_name:'',latitude:'',longitude:'',ancestor_ids:[],era:'',external_url:''}); }}
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