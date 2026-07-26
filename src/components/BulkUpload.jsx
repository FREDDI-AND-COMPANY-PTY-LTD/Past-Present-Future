import React, { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, Save, Check, AlertCircle, Link2, Video, Music } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { analyzeImage } from '@/lib/imageAnalysis';
import { analyzeAudioVideo } from '@/lib/avAnalysis';
import BulkUploadItem from '@/components/BulkUploadItem';
import { analyzeCrop } from '@/lib/cropAnalysis';

export default function BulkUpload({ ancestors, preselectedAncestorId, user }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const [savingAll, setSavingAll] = useState(false);
  const [ancestorsList, setAncestorsList] = useState(ancestors);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkType, setLinkType] = useState('video');
  const fileInputRef = useRef(null);

  const matchAncestors = useCallback((analysis) => {
    const allText = [
      analysis.extracted_fields?.full_name, analysis.extracted_fields?.mother_name,
      analysis.extracted_fields?.father_name, analysis.extracted_fields?.spouse_name,
      analysis.extracted_fields?.given_names, analysis.extracted_fields?.surname,
      analysis.suggested_title, analysis.suggested_description, analysis.transcription,
      ...(analysis.visual_elements?.people || []),
      ...(analysis.visual_elements?.text_elements || []),
      ...(analysis.visual_elements?.locations_visible || []),
    ].filter(Boolean).join(' ');
    const lower = allText.toLowerCase();
    const matched = [];
    for (const a of ancestors) {
      const name = (a.full_name || '').toLowerCase().trim();
      if (!name) continue;
      const parts = name.split(/\s+/);
      const givenName = parts[0];
      const surname = parts.length > 1 ? parts[parts.length - 1] : '';
      if (lower.includes(name)) {
        matched.push(a.id);
      } else if (surname && givenName.length > 2 && lower.includes(surname) && lower.includes(givenName)) {
        matched.push(a.id);
      }
    }
    if (preselectedAncestorId) matched.push(preselectedAncestorId);
    return [...new Set(matched)];
  }, [ancestorsList, preselectedAncestorId]);

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/')
    );
    if (files.length === 0) return;

    const newItems = files.map(f => ({
      id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2)}`,
      file: f,
      fileUrl: null,
      status: 'uploading',
      analysis: null,
      form: {
        title: f.name.replace(/\.[^.]+$/, ''),
        description: '',
        date: '',
        location_name: '',
        latitude: '',
        longitude: '',
        era: '',
        ancestor_ids: preselectedAncestorId ? [preselectedAncestorId] : [],
      },
    }));
    setItems(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const uploadRes = await base44.integrations.Core.UploadFile({ file: item.file });
        const url = uploadRes.file_url;

        const isImage = item.file.type.startsWith('image/');

        if (!isImage) {
          // Audio/video — transcribe (audio) and analyse filename/metadata via AI
          setItems(prev => prev.map(it => it.id === item.id ? { ...it, fileUrl: url, status: 'analysing' } : it));

          try {
            const result = await analyzeAudioVideo(url, item.file.name, item.file.type);
            const matchedIds = matchAncestors(result);
            const eventLocation = result.event_location || '';
            const eventDate = result.extracted_fields?.date_of_event || '';

            setItems(prev => prev.map(it => it.id === item.id ? {
              ...it,
              status: 'ready',
              analysis: result,
              form: {
                ...it.form,
                title: result.suggested_title || it.form.title,
                description: result.suggested_description || '',
                date: eventDate,
                location_name: eventLocation,
                ancestor_ids: matchedIds.length > 0 ? matchedIds : it.form.ancestor_ids,
              },
            } : it));

            // Run duplicate check with pre-save item data
            base44.functions.invoke('checkDuplicateUpload', {
              item_data: {
                file_url: url,
                title: result.suggested_title || item.form.title,
                content_type: result.type,
                date: eventDate,
                location_name: eventLocation,
                transcribed_text: result.transcription || '',
                extracted_fields: result.extracted_fields || {},
                ancestor_ids: matchedIds,
              }
            }).then(res => {
              const dups = res.data?.potential_duplicates || [];
              if (dups.length > 0) {
                setItems(prev => prev.map(it => it.id === item.id ? { ...it, duplicates: dups } : it));
              }
            }).catch(() => {});
          } catch (e) {
            setItems(prev => prev.map(it => it.id === item.id ? {
              ...it,
              fileUrl: url,
              status: 'ready',
              analysis: { type: item.file.type.startsWith('audio/') ? 'audio' : 'video', suggested_tags: [] },
            } : it));
          }
          continue;
        }

        setItems(prev => prev.map(it => it.id === item.id ? { ...it, fileUrl: url, status: 'analysing' } : it));

        const [analysisResult, cropResult] = await Promise.allSettled([
          analyzeImage(url),
          analyzeCrop(url),
        ]);

        if (analysisResult.status !== 'fulfilled') throw analysisResult.reason;
        const result = analysisResult.value;
        const crop = cropResult.status === 'fulfilled' ? cropResult.value : null;

        const matchedIds = matchAncestors(result);
        const eventLocation = result.event_location
          || result.extracted_fields?.place_of_event
          || result.extracted_fields?.place_of_birth
          || result.extracted_fields?.place_of_death
          || result.extracted_fields?.place_of_issue
          || result.extracted_fields?.residence_address
          || result.visual_elements?.locations_visible?.[0]
          || '';
        const eventDate = result.extracted_fields?.date_of_event || result.extracted_fields?.date_of_birth || '';

        setItems(prev => prev.map(it => it.id === item.id ? {
          ...it,
          status: 'ready',
          analysis: result,
          cropData: crop,
          form: {
            ...it.form,
            title: result.suggested_title || it.form.title,
            description: result.suggested_description || '',
            date: eventDate,
            location_name: eventLocation,
            ancestor_ids: matchedIds.length > 0 ? matchedIds : it.form.ancestor_ids,
          },
        } : it));

        // Run duplicate check with pre-save item data
        base44.functions.invoke('checkDuplicateUpload', {
          item_data: {
            file_url: url,
            title: result.suggested_title || item.form.title,
            content_type: result.type,
            date: eventDate,
            location_name: eventLocation,
            transcribed_text: result.transcription || '',
            extracted_fields: result.extracted_fields || {},
            ancestor_ids: matchedIds,
          }
        }).then(res => {
          const dups = res.data?.potential_duplicates || [];
          if (dups.length > 0) {
            setItems(prev => prev.map(it => it.id === item.id ? { ...it, duplicates: dups } : it));
          }
        }).catch(() => {});
      } catch (e) {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error' } : it));
      }
    }
  }, [matchAncestors, preselectedAncestorId]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileSelect = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleAddLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);
    const isVimeo = /vimeo\.com\/\d+/.test(url);
    const detectedType = isYouTube || isVimeo ? 'video' : linkType;
    const newItem = {
      id: `${Date.now()}-link-${Math.random().toString(36).slice(2)}`,
      file: null,
      fileUrl: null,
      externalUrl: url,
      status: 'ready',
      analysis: { type: detectedType, suggested_tags: [], ai_confidence: 1.0 },
      form: {
        title: linkTitle.trim() || (isYouTube ? 'YouTube Video' : isVimeo ? 'Vimeo Video' : 'External Recording'),
        description: '',
        date: '',
        location_name: '',
        latitude: '',
        longitude: '',
        era: '',
        ancestor_ids: preselectedAncestorId ? [preselectedAncestorId] : [],
        external_url: url,
      },
    };
    setItems(prev => [...prev, newItem]);
    setLinkUrl('');
    setLinkTitle('');
    setShowLinkForm(false);
  };

  const updateField = (itemId, field, value) => {
    // Handle special prefixed fields that map to analysis object
    if (field === '_extracted_fields') {
      setItems(prev => prev.map(it => it.id === itemId ? {
        ...it,
        analysis: { ...it.analysis, extracted_fields: value },
      } : it));
    } else if (field === '_transcription') {
      setItems(prev => prev.map(it => it.id === itemId ? {
        ...it,
        analysis: { ...it.analysis, transcription: value },
      } : it));
    } else if (field === '_type') {
      setItems(prev => prev.map(it => it.id === itemId ? {
        ...it,
        analysis: { ...it.analysis, type: value },
      } : it));
    } else {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, form: { ...it.form, [field]: value } } : it));
    }
  };

  const toggleAncestor = (itemId, ancestorId) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const ids = it.form.ancestor_ids.includes(ancestorId)
        ? it.form.ancestor_ids.filter(id => id !== ancestorId)
        : [...it.form.ancestor_ids, ancestorId];
      return { ...it, form: { ...it.form, ancestor_ids: ids } };
    }));
  };

  const handleLocationPick = (itemId, loc) => {
    setItems(prev => prev.map(it => it.id === itemId ? {
      ...it, form: { ...it.form, location_name: loc.location_name, latitude: loc.latitude, longitude: loc.longitude }
    } : it));
  };

  const handleCreateAncestor = (ancestor) => {
    setAncestorsList(prev => [...prev, ancestor]);
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    const readyItems = items.filter(it => it.status === 'ready');
    for (const item of readyItems) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saving' } : it));
      try {
        const effectiveAncestorIds = preselectedAncestorId && !item.form.ancestor_ids.includes(preselectedAncestorId)
          ? [...item.form.ancestor_ids, preselectedAncestorId]
          : item.form.ancestor_ids;

        const needsReview = effectiveAncestorIds.length === 0 || !item.form.location_name?.trim() || !item.form.date || !item.form.title?.trim();

        const isAdminUser = user?.role === 'admin';
        const finalTags = item.form.tags || item.analysis?.suggested_tags || [];

        const createdItem = await base44.entities.ContentItem.create({
          title: item.form.title,
          content_type: item.analysis?.type || 'photo',
          description: item.form.description,
          date: item.form.date || null,
          location_name: item.form.location_name,
          latitude: item.form.latitude ? parseFloat(item.form.latitude) : null,
          longitude: item.form.longitude ? parseFloat(item.form.longitude) : null,
          ancestor_ids: effectiveAncestorIds,
          era: item.form.era,
          file_url: item.fileUrl,
          external_url: item.form.external_url || item.externalUrl || null,
          transcribed_text: item.analysis?.transcription || null,
          extracted_fields: item.analysis?.extracted_fields || null,
          raw_ai_analysis: item.analysis || null,
          ai_confidence: item.analysis?.ai_confidence,
          categorization_notes: item.analysis?.categorization_notes || null,
          focal_point_x: item.cropData?.focal_point_x ?? 0.5,
          focal_point_y: item.cropData?.focal_point_y ?? 0.4,
          shot_type: item.cropData?.shot_type || null,
          crop_bounds: item.cropData?.crop_bounds || null,
          visual_elements: item.analysis?.visual_elements || null,
          uploaded_by_id: user?.id || null,
          review_status: isAdminUser ? 'reviewed' : (needsReview ? 'flagged' : 'pending'),
          conflict_flag_status: 'none',
          tags: [...finalTags, ...(needsReview ? ['admin_review_required'] : [])],
        });

        // Save comment/query if provided
        if (item.form.comment?.trim() && createdItem?.id) {
          await base44.entities.Comment.create({
            entity_type: 'ContentItem',
            entity_id: createdItem.id,
            field_name: 'general_discussion',
            content: item.form.comment.trim(),
            author_id: user?.id || null,
            author_name: user?.full_name || user?.email || 'Family Member',
            parent_comment_id: null,
            is_query: item.form.is_query || false,
            acknowledged_by: [],
          }).catch(() => {});
        }

        if (user) {
          await base44.entities.ActivityLog.create({
            action_type: 'upload',
            user_id: user.id,
            user_name: user.full_name,
            content_item_title: item.form.title,
            description: `Bulk uploaded "${item.form.title}" (${item.analysis?.type || 'photo'})${needsReview ? ' — flagged for review' : ''}`,
          }).catch(() => {});
        }

        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saved', savedItemId: createdItem.id } : it));
      } catch (e) {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error' } : it));
      }
    }
    setSavingAll(false);
  };

  const readyCount = items.filter(it => it.status === 'ready').length;
  const savedCount = items.filter(it => it.status === 'saved').length;
  const processingCount = items.filter(it => it.status === 'uploading' || it.status === 'analysing').length;

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-[#C9913A] bg-[rgba(201,145,58,0.08)] scale-[1.01]' : 'border-[rgba(201,145,58,0.25)] hover:border-[#C9913A] hover:bg-[rgba(201,145,58,0.03)]'}`}
      >
        <div className="pointer-events-none">
          <Upload size={32} className="text-gold mx-auto mb-3" />
          <p className="text-parchment font-medium mb-1">Drag &amp; drop multiple files here</p>
          <p className="text-xs text-parchment/40">or click to browse — photos, audio, video</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {/* External link option */}
      {!showLinkForm ? (
        <button
          onClick={() => setShowLinkForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.06)] transition-colors"
        >
          <Link2 size={16} /> Add External Link (YouTube, Vimeo, or recording URL)
        </button>
      ) : (
        <div className="aged-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-gold" />
            <h3 className="font-display text-sm text-parchment">Add External Link</h3>
            <button onClick={() => setShowLinkForm(false)} className="ml-auto text-parchment/40 hover:text-parchment text-xs">Cancel</button>
          </div>
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setLinkType('video')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${linkType === 'video' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50'}`}
            >
              <Video size={12} /> Video
            </button>
            <button
              onClick={() => setLinkType('audio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${linkType === 'audio' ? 'border-[#C9913A] bg-[rgba(201,145,58,0.1)] text-gold' : 'border-[rgba(201,145,58,0.15)] text-parchment/50'}`}
            >
              <Music size={12} /> Audio
            </button>
          </div>
          <div>
            <label className="text-xs text-parchment/40 mb-1 block">URL</label>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="https://youtube.com/watch?v=... or https://example.com/recording.mp3"
            />
          </div>
          <div>
            <label className="text-xs text-parchment/40 mb-1 block">Title (optional)</label>
            <input
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
              className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="e.g. Interview with Nonna — 2015"
            />
          </div>
          <button
            onClick={handleAddLink}
            disabled={!linkUrl.trim()}
            className="w-full py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Add to Batch
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-parchment/50">
          <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          {processingCount > 0 && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Processing {processingCount}</span>}
          {readyCount > 0 && <span className="text-amber-light">{readyCount} ready to review</span>}
          {savedCount > 0 && <span className="text-green-400 flex items-center gap-1"><Check size={12} /> {savedCount} saved</span>}
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <BulkUploadItem
            key={item.id}
            item={item}
            ancestors={ancestorsList}
            onFieldChange={updateField}
            onToggleAncestor={toggleAncestor}
            onLocationPick={handleLocationPick}
            onCreateAncestor={handleCreateAncestor}
            user={user}
          />
        ))}
      </div>

      {readyCount > 0 && (
        <button
          onClick={handleSaveAll}
          disabled={savingAll}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity gold-glow flex items-center justify-center gap-2"
        >
          {savingAll ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {savingAll ? 'Saving...' : `Save ${readyCount} Item${readyCount !== 1 ? 's' : ''} to Archive`}
        </button>
      )}
    </div>
  );
}