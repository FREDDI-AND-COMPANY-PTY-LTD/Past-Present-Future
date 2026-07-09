import React, { useState, useEffect } from 'react';
import { useArchivePhotos } from '@/hooks/useArchivePhotos';

/**
 * Slim hero banner shown at the top of every page (except Home, which has its own full hero).
 * Picks a random photo from the archive on each mount — different pages get different photos,
 * and the selection rotates each time the app is opened.
 */
export default function PageHero() {
  const photos = useArchivePhotos();
  const [photoIdx, setPhotoIdx] = useState(null);

  useEffect(() => {
    if (photos.length > 0 && photoIdx === null) {
      setPhotoIdx(Math.floor(Math.random() * photos.length));
    }
  }, [photos.length]);

  if (photoIdx === null) return null;
  const photo = photos[photoIdx];
  if (!photo) return null;

  return (
    <div className="relative h-32 lg:h-44 overflow-hidden flex-shrink-0">
      <img
        src={photo.file_url}
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