import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level cache — persists across page navigations within a single app session.
// Resets on full page reload, so photos re-fetch and re-randomise each time the app is opened.
let cachedPhotos = null;
let fetchPromise = null;

export function useArchivePhotos() {
  const [photos, setPhotos] = useState(cachedPhotos || []);

  useEffect(() => {
    if (cachedPhotos) {
      setPhotos(cachedPhotos);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = base44.entities.ContentItem.filter({ content_type: 'photo' }, '-created_date', 100)
        .then(items => {
          cachedPhotos = (items || []).filter(i => i.file_url);
          return cachedPhotos;
        })
        .catch(() => {
          cachedPhotos = [];
          return [];
        });
    }
    fetchPromise.then(setPhotos);
  }, []);

  return photos;
}