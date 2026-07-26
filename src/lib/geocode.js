import { base44 } from '@/api/base44Client';
import { loadGoogleMaps } from '@/lib/googleMaps';

// Lightweight forward geocoder: turns a place-name string into lat/lng so a map
// pin can be placed automatically. Used by the upload flow to geocode the AI's
// event_location without requiring the user to open the map picker. Fails
// silently (returns null) when maps aren't configured — callers fall back to the
// manual LocationPicker.
let cachedKey = null;

export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    if (!cachedKey) {
      const res = await base44.functions.invoke('getMapsConfig');
      cachedKey = res.data?.apiKey;
    }
    if (!cachedKey) return null;
    const gmaps = await loadGoogleMaps(cachedKey);
    const geocoder = new gmaps.Geocoder();
    const hit = await new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results.length) resolve(results[0]);
        else resolve(null);
      });
    });
    if (!hit) return null;
    return {
      lat: hit.geometry.location.lat(),
      lng: hit.geometry.location.lng(),
      formatted_address: hit.formatted_address,
    };
  } catch (e) {
    return null;
  }
}