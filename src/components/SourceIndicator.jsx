import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, HelpCircle, X, Upload, FileText, User, Loader2, Plus, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SourceIndicator({ entityType, entityId, fieldName, label }) {
  const [sources, setSources] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popupOpen, setPopupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('sources');
  const containerRef = useRef(null);

  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceType, setSourceType] = useState('document');
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [hearsayNote, setHearsayNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const fileInputRef = useRef(null);

  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const loadData = () => {
    if (!entityId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Source.filter({ entity_type: entityType, entity_id: entityId, field_name: fieldName }),
      base44.entities.Comment.filter({ entity_type: entityType, entity_id: entityId, field_name: fieldName }),
    ]).then(([srcs, cmts]) => {
      setSources(srcs || []);
      setComments(cmts || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [entityId, entityType, fieldName]);
  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setPopupOpen(false);
    };
    if (popupOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [popupOpen]);

  const hasDoc = sources.some(s => s.source_type === 'document');
  const hasHearsay = sources.some(s => s.source_type === 'hearsay');
  const indicatorState = hasDoc ? 'validated' : hasHearsay ? 'hearsay' : 'none';

  const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url || '');

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setDocumentUrl(res.file_url);
    } catch (e) {}
    setUploading(false);
  };

  const handleSaveSource = async () => {
    if (sourceType === 'document' && !documentUrl) return;
    setSavingSource(true);
    try {
      const newSource = await base44.entities.Source.create({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        source_type: sourceType,
        document_url: sourceType === 'document' ? documentUrl : null,
        document_type: sourceType === 'document' ? documentType : null,
        provided_by_id: currentUser?.id || null,
        provided_by_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        notes: hearsayNote || null,
        validation_status: sourceType === 'document' ? 'validated' : 'hearsay',
      });
      setSources(prev => [...prev, newSource]);
      setShowAddSource(false);
      setDocumentUrl('');
      setDocumentType('');
      setHearsayNote('');
      setSourceType('document');
    } catch (e) {}
    setSavingSource(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const newComment = await base44.entities.Comment.create({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        author_id: currentUser?.id || null,
        author_name: currentUser?.full_name || currentUser?.email || 'Family Member',
        content: commentText,
        parent_comment_id: null,
      });
      setComments(prev => [...prev, newComment]);
      setCommentText('');
    } catch (e) {}
    setSavingComment(false);
  };

  const renderIndicator = () => {
    if (loading) return <div className="w-3.5 h-3.5 rounded-full border border-parchment/20 animate-pulse" />;

    if (indicatorState === 'validated') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400/80 cursor-pointer hover:scale-110 transition-transform" onClick={() => setPopupOpen(true)} title="Validated by document" />;
    } else if (indicatorState === 'hearsay') {
      return <HelpCircle className="w-3.5 h-3.5 text-amber-400/80 cursor-pointer hover:scale-110 transition-transform" onClick={() => setPopupOpen(true)} title="Hearsay — unverified" />;
    } else {
      return (
        <div
          className="w-3.5 h-3.5 rounded-full border border-dashed border-parchment/30 hover:border-gold cursor-pointer transition-colors"
          onClick={() => setPopupOpen(true)}
          title="No source yet — click to add one"
        />
      );
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {renderIndicator()}
      {comments.length > 0 && (
        <span
          className="ml-0.5 text-[10px] bg-[rgba(201,145,58,0.15)] text-amber-light rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-[rgba(201,145,58,0.25)]"
          onClick={() => { setPopupOpen(true); setActiveTab('comments'); }}
        >
          {comments.length}
        </span>
      )}

      {popupOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#1A1614] border border-[rgba(201,145,58,0.25)] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(201,145,58,0.15)]">
            <div>
              <p className="text-xs text-parchment/40">Source & Discussion</p>
              <p className="text-sm text-parchment font-medium">{label}</p>
            </div>
            <button onClick={() => setPopupOpen(false)} className="text-parchment/40 hover:text-parchment">
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[rgba(201,145,58,0.15)]">
            <button
              onClick={() => setActiveTab('sources')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${activeTab === 'sources' ? 'text-gold border-b-2 border-[#C9913A] bg-[rgba(201,145,58,0.05)]' : 'text-parchment/50 hover:text-parchment'}`}
            >
              Sources ({sources.length})
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${activeTab === 'comments' ? 'text-gold border-b-2 border-[#C9913A] bg-[rgba(201,145,58,0.05)]' : 'text-parchment/50 hover:text-parchment'}`}
            >
              Comments ({comments.length})
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {activeTab === 'sources' && (
              <div className="p-4 space-y-3">
                {sources.length > 0 ? (
                  sources.map(src => (
                    <div key={src.id} className="rounded-lg border border-[rgba(201,145,58,0.12)] p-3 bg-[#0D0B0A]">
                      {src.source_type === 'document' && src.document_url ? (
                        <div>
                          {isImage(src.document_url) && (
                            <img src={src.document_url} alt="" className="w-full h-24 object-cover rounded-md mb-2 sepia-tint" />
                          )}
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-gold flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-parchment truncate">{src.document_type || 'Document'}</p>
                              <a href={src.document_url} target="_blank" rel="noreferrer" className="text-xs text-amber-light hover:underline">View document →</a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <User size={14} className="text-amber-light/60 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-amber-light/80">Hearsay from {src.provided_by_name}</p>
                            {src.notes && <p className="text-xs text-parchment/50 mt-1">{src.notes}</p>}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-parchment/30 mt-2">
                        {src.source_type === 'document' ? '✓ Validated' : '⚠ Unverified hearsay'}
                        {src.provided_by_name && ` · by ${src.provided_by_name}`}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-parchment/40 text-center py-4">No sources yet. Add one below to validate this data.</p>
                )}

                {showAddSource ? (
                  <div className="rounded-lg border border-[rgba(201,145,58,0.2)] p-3 bg-[#0D0B0A] space-y-3">
                    <div className="flex gap-2">
                      <button onClick={() => setSourceType('document')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${sourceType === 'document' ? 'bg-[#C9913A] text-charcoal' : 'bg-[#1A1614] text-parchment/60 border border-[rgba(201,145,58,0.15)]'}`}>
                        <FileText size={12} className="inline mr-1" /> Document
                      </button>
                      <button onClick={() => setSourceType('hearsay')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${sourceType === 'hearsay' ? 'bg-[#C9913A] text-charcoal' : 'bg-[#1A1614] text-parchment/60 border border-[rgba(201,145,58,0.15)]'}`}>
                        <User size={12} className="inline mr-1" /> Hearsay
                      </button>
                    </div>

                    {sourceType === 'document' ? (
                      <>
                        <input
                          value={documentType}
                          onChange={e => setDocumentType(e.target.value)}
                          placeholder="Document type (e.g. Birth Certificate)"
                          className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.15)] rounded px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                        />
                        {documentUrl ? (
                          <div className="flex items-center gap-2">
                            {isImage(documentUrl) ? (
                              <img src={documentUrl} alt="" className="w-12 h-12 object-cover rounded sepia-tint" />
                            ) : (
                              <FileText size={20} className="text-gold" />
                            )}
                            <span className="text-xs text-green-400/70">Uploaded ✓</span>
                            <button onClick={() => setDocumentUrl('')} className="text-xs text-red-400/60 hover:text-red-400">Remove</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full px-3 py-2 rounded border border-dashed border-[rgba(201,145,58,0.25)] text-xs text-parchment/60 hover:border-[#C9913A] hover:text-parchment transition-colors"
                          >
                            {uploading ? <Loader2 size={12} className="inline animate-spin" /> : <Upload size={12} className="inline mr-1" />}
                            {uploading ? 'Uploading...' : 'Upload Document'}
                          </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleFileUpload(e.target.files?.[0])} />
                      </>
                    ) : (
                      <textarea
                        value={hearsayNote}
                        onChange={e => setHearsayNote(e.target.value)}
                        placeholder="Note the source of this information (e.g. 'Grandmother told me...')"
                        rows={3}
                        className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.15)] rounded px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                      />
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => setShowAddSource(false)} className="flex-1 px-3 py-1.5 rounded text-xs text-parchment/60 hover:text-parchment">Cancel</button>
                      <button
                        onClick={handleSaveSource}
                        disabled={savingSource || (sourceType === 'document' && !documentUrl)}
                        className="flex-1 px-3 py-1.5 rounded bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-50"
                      >
                        {savingSource ? <Loader2 size={12} className="inline animate-spin" /> : 'Save Source'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddSource(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[rgba(201,145,58,0.2)] text-xs text-amber-light/70 hover:text-amber-light hover:border-[#C9913A] transition-colors"
                  >
                    <Plus size={12} /> Add Source
                  </button>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="p-4 space-y-3">
                {comments.length > 0 ? (
                  comments.map(cmt => (
                    <div key={cmt.id} className="rounded-lg bg-[#0D0B0A] p-3 border border-[rgba(201,145,58,0.08)]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[rgba(201,145,58,0.12)] flex items-center justify-center">
                          <span className="text-[10px] text-gold font-medium">{cmt.author_name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-xs text-amber-light/80 font-medium">{cmt.author_name}</span>
                      </div>
                      <p className="text-xs text-parchment/70 leading-relaxed">{cmt.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-parchment/40 text-center py-4">No comments yet. Start the discussion.</p>
                )}

                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] rounded px-3 py-2 text-xs text-parchment focus:outline-none focus:border-[#C9913A]"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={savingComment || !commentText.trim()}
                    className="px-3 py-2 rounded bg-[#C9913A] text-charcoal disabled:opacity-50"
                  >
                    {savingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}