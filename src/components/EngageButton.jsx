import React, { useState } from 'react';
import { MessageSquare, Upload, Loader2, Send, X, FileText, Image as ImageIcon, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import CommentThread from './CommentThread';

export default function EngageButton({ item, user }) {
  const [mode, setMode] = useState(null); // null | 'comments' | 'upload'
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [linkedItems, setLinkedItems] = useState([]);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const newItem = await base44.entities.ContentItem.create({
        title: title.trim(),
        content_type: file.type.startsWith('image/') ? 'photo' : 'narrative',
        description: desc.trim(),
        file_url: uploadRes.file_url,
        ancestor_ids: item.ancestor_ids || [],
        uploaded_by_id: user?.id || null,
        tags: ['related event'],
      });
      setLinkedItems([...linkedItems, newItem]);
      setTitle('');
      setDesc('');
      setFile(null);
      setMode(null);
    } catch (e) {}
    setUploading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode(mode === 'comments' ? null : 'comments')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${mode === 'comments' ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:text-amber-light hover:border-[rgba(201,145,58,0.4)]'}`}
        >
          <MessageSquare size={14} /> Comment
        </button>
        <button
          onClick={() => setMode(mode === 'upload' ? null : 'upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${mode === 'upload' ? 'border-[#C9913A] text-gold bg-[rgba(201,145,58,0.08)]' : 'border-[rgba(201,145,58,0.2)] text-amber-light/70 hover:text-amber-light hover:border-[rgba(201,145,58,0.4)]'}`}
        >
          <Upload size={14} /> Add Related Event
        </button>
      </div>

      {/* Comments panel */}
      {mode === 'comments' && (
        <div className="mt-3 pt-3 border-t border-[rgba(201,145,58,0.1)]">
          <CommentThread entityType="ContentItem" entityId={item.id} fieldName="general_discussion" />
        </div>
      )}

      {/* Upload related event panel */}
      {mode === 'upload' && (
        <div className="mt-3 p-4 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.15)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-light/70 font-medium">Upload a related event</span>
            <button onClick={() => setMode(null)} className="text-parchment/30 hover:text-parchment"><X size={14} /></button>
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="Related event title"
            />
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">Description (optional)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              className="w-full bg-[#1A1614] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
              placeholder="Add context..."
            />
          </div>
          <div>
            <label className="text-xs text-parchment/50 mb-1 block">File</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,image/*"
              onChange={e => setFile(e.target.files?.[0])}
              className="w-full text-sm text-parchment/60 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[rgba(201,145,58,0.15)] file:text-amber-light file:text-sm file:cursor-pointer"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-xs text-parchment/50">
                {file.type.startsWith('image/') ? <ImageIcon size={14} className="text-gold" /> : <FileText size={14} className="text-gold" />}
                {file.name}
              </div>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            className="w-full py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload Related Event'}
          </button>
        </div>
      )}

      {/* Linked related events */}
      {linkedItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkedItems.map(li => (
            <Link
              key={li.id}
              to={`/content/${li.id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[rgba(201,145,58,0.08)] text-amber-light/80 border border-[rgba(201,145,58,0.15)] hover:border-[rgba(201,145,58,0.4)] transition-colors"
            >
              <Link2 size={10} /> {li.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}