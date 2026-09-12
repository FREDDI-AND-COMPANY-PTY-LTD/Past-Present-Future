import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crop, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import FocalPointEditor from '@/components/FocalPointEditor';
import CropImage from '@/components/CropImage';
import { isPdfUrl } from '@/lib/pdfThumbnail';

const IMAGE_TYPES = ['photo', 'uncategorized', 'certificate', 'passport', 'identity_document', 'press_clipping', 'narrative', 'correspondence', 'memorial'];

export default function CropReedit() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // item being edited
  const [savedId, setSavedId] = useState(null);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.ContentItem.list('-created_date', 200);
        // Only items whose preview can actually be rendered as an image by the
        // cropper: real image files, or PDFs that already have a generated
        // first-page thumbnail. PDFs without a thumbnail are excluded (they'd
        // render as a black box in an <img> tag).
        setItems((all || []).filter(i => i.file_url && IMAGE_TYPES.includes(i.content_type) && (i.thumbnail_url || !isPdfUrl(i.file_url))));
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  // The FocalPointEditor writes the adjustment to the record directly (it is
  // rendered with itemId here, so it shows "Save My Adjustment"). The parent
  // only needs to reflect the committed change in the local grid and close.
  const handleApprove = (payload) => {
    if (!editing) return;
    setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...payload } : i));
    setSavedId(editing.id);
    setTimeout(() => setSavedId(null), 1500);
    setEditing(null);
  };

  // Rotation bakes the turn into the file and re-analyses it server-side, so
  // the record is already current — just reflect the new file/analysis in the
  // grid without closing the editor (the admin may rotate again or adjust).
  const handleRotated = (payload) => {
    if (!editing) return;
    setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...payload } : i));
    setSavedId(editing.id);
    setTimeout(() => setSavedId(null), 1500);
  };

  if (checking) {
    return <Layout><div className="px-6 lg:px-12 py-12 max-w-7xl mx-auto"><div className="aged-card rounded-xl h-64 animate-pulse" /></div></Layout>;
  }

  if (user?.role !== 'admin') {
    return (
      <Layout>
        <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto text-center">
          <div className="aged-card rounded-xl p-10">
            <AlertCircle size={32} className="text-gold/40 mx-auto mb-3" />
            <p className="text-parchment font-medium mb-1">Admins only</p>
            <p className="text-parchment/50 text-sm mb-5">Re-editing image cropping is restricted to archive administrators.</p>
            <Link to="/" className="inline-flex items-center gap-1 text-amber-light hover:text-gold text-sm">
              <ChevronLeft size={16} /> Back to Home
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin" className="inline-flex items-center gap-1 text-parchment/50 hover:text-gold transition-colors text-sm">
            <ChevronLeft size={16} /> Admin
          </Link>
          <span className="text-xs text-amber-light/60 flex items-center gap-1.5"><AlertCircle size={12} /> Temporary tool — re-edit crop &amp; focal point across the archive</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Crop size={28} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl text-parchment">Re-edit Image Cropping</h1>
            <p className="text-parchment/50 text-sm mt-1">{loading ? 'Loading…' : `${items.length} image item${items.length === 1 ? '' : 's'} in the archive`}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="aged-card rounded-xl h-72 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="aged-card rounded-xl p-12 text-center">
            <p className="text-parchment/50">No image items found to re-edit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => {
              const cb = item.crop_bounds;
              const framed = cb && ((cb.x_max - cb.x_min) < 0.95 || (cb.y_max - cb.y_min) < 0.95);
              return (
                <div key={item.id} className="aged-card rounded-xl overflow-hidden flex flex-col">
                  <div className="h-48 bg-black/40 overflow-hidden">
                    <CropImage src={item.thumbnail_url || item.file_url} alt={item.title} focalX={item.focal_point_x} focalY={item.focal_point_y} cropBounds={item.crop_bounds} className="w-full h-full" imgClassName="sepia-tint" />
                    {framed && (
                      <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.15)] border border-[rgba(201,145,58,0.3)] text-amber-light">crop box set</span>
                    )}
                    {savedId === item.id && (
                      <div className="absolute inset-0 bg-[rgba(13,11,10,0.7)] flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-amber-light text-sm font-semibold"><Check size={16} /> Saved</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-display text-base text-parchment leading-snug line-clamp-2">{item.title}</h3>
                    <p className="text-xs text-parchment/40 mt-1">
                      focal {(item.focal_point_x ?? 0.5).toFixed(2)}, {(item.focal_point_y ?? 0.4).toFixed(2)}
                      {framed ? ' · framed' : ' · full frame'}
                    </p>
                    <button
                      onClick={() => setEditing(item)}
                      className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Crop size={16} /> Edit Crop &amp; Focal
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <FocalPointEditor
          itemId={editing.id}
          fileUrl={editing.thumbnail_url || editing.file_url}
          isPdf={isPdfUrl(editing.file_url)}
          title={editing.title}
          focalX={editing.focal_point_x}
          focalY={editing.focal_point_y}
          cropBounds={editing.crop_bounds}
          subjectBounds={editing.subject_bounds}
          onApprove={handleApprove}
          onRotated={handleRotated}
          onClose={() => setEditing(null)}
        />
      )}

    </Layout>
  );
}