import React, { useState, useEffect } from 'react';

// Guest equivalent of PageHero — picks a random photo from the loaded archive
// items (guests can't query the DB), shown at the top of every non-Home view.
export default function GuestPageHero({ items }) {
  const [idx, setIdx] = useState(null);
  const photos = (items || []).filter(
    (i) => i.file_url && (i.content_type === 'photo' || i.thumbnail_url) && !i.parent_content_item_id
  );

  useEffect(() => {
    if (photos.length > 0 && idx === null) {
      setIdx(Math.floor(Math.random() * photos.length));
    }
  }, [photos.length]);

  if (idx === null) return null;
  const photo = photos[idx];
  if (!photo) return null;

  return (
    <div className="relative h-32 lg:h-44 overflow-hidden flex-shrink-0">
      <img
        src={photo.thumbnail_url || photo.file_url}
        alt={photo.title || 'Archive photo'}
        className="w-full h-full object-cover sepia-tint"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,11,10,0.1) 0%, rgba(13,11,10,0.5) 100%)' }} />
      {photo.title && (
        <p className="absolute bottom-3 right-4 text-xs text-amber-light/40 italic">
          From the archive: {photo.title}
        </p>
      )}
    </div>
  );
}