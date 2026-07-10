import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1A1614' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1614' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B7355' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#C9913A' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#C9913A' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8B7355' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3020' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D0B0A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5A4A30' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#151210' }] },
];

let scriptPromise = null;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => { scriptPromise = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function LocationPicker({ open, onClose, onPick, initialLocation, initialLat, initialLng }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const gmapsRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const placesRef = useRef(null);
  const searchInputRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMapsConfig');
        const apiKey = res.data?.apiKey;
        if (!apiKey) throw new Error('Google Maps API key not configured');
        const gmaps = await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;
        gmapsRef.current = gmaps;
        placesRef.current = gmaps.places;

        const hasCoords = initialLat && initialLng;
        const center = hasCoords
          ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) }
          : { lat: -25, lng: 135 };

        mapRef.current = new gmaps.Map(containerRef.current, {
          center,
          zoom: hasCoords ? 12 : 4,
          styles: darkMapStyles,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        // Click to place marker
        mapRef.current.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          placeMarker(lat, lng);
          reverseGeocode(lat, lng);
        });

        // Initial marker if coords exist
        if (hasCoords) {
          placeMarker(parseFloat(initialLat), parseFloat(initialLng));
          setPicked({
            lat: parseFloat(initialLat),
            lng: parseFloat(initialLng),
            name: initialLocation || '',
          });
        }

        // Autocomplete on search input
        if (searchInputRef.current) {
          const ac = new gmaps.places.Autocomplete(searchInputRef.current, {
            types: ['geocode'],
          });
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            mapRef.current.setCenter({ lat, lng });
            mapRef.current.setZoom(14);
            placeMarker(lat, lng);
            setPicked({ lat, lng, name: place.formatted_address || place.name || '' });
          });
          autocompleteRef.current = ac;
        }

        setLoading(false);
      } catch (e) {
        setError(e.message || 'Failed to load map');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Clean up marker when closing
  useEffect(() => {
    if (!open && markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (!open) {
      setPicked(null);
      if (searchInputRef.current) searchInputRef.current.value = '';
      setError(null);
      setLoading(true);
    }
  }, [open]);

  const placeMarker = (lat, lng) => {
    const gmaps = gmapsRef.current;
    if (!gmaps || !mapRef.current) return;
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new gmaps.Marker({
      position: { lat, lng },
      map: mapRef.current,
      title: 'Event location',
    });
  };

  const reverseGeocode = (lat, lng) => {
    const gmaps = gmapsRef.current;
    if (!gmaps || !placesRef.current) {
      setPicked({ lat, lng, name: '' });
      return;
    }
    try {
      const geocoder = new gmaps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const name = results[0].formatted_address || '';
          setPicked({ lat, lng, name });
          if (searchInputRef.current) searchInputRef.current.value = name;
        } else {
          setPicked({ lat, lng, name: '' });
        }
      });
    } catch {
      setPicked({ lat, lng, name: '' });
    }
  };

  const handleSearch = () => {
    const query = searchInputRef.current?.value?.trim();
    if (!query) return;
    const gmaps = gmapsRef.current;
    if (!gmaps) return;
    setSearching(true);
    try {
      const geocoder = new gmaps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const loc = results[0].geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();
          mapRef.current?.setCenter({ lat, lng });
          mapRef.current?.setZoom(14);
          placeMarker(lat, lng);
          const name = results[0].formatted_address || query;
          setPicked({ lat, lng, name });
          if (searchInputRef.current) searchInputRef.current.value = name;
        } else {
          setError('No results found for that address. Try a different search, or click on the map.');
        }
        setSearching(false);
      });
    } catch {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleConfirm = () => {
    if (picked) {
      onPick({
        location_name: picked.name || searchInputRef.current?.value || `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`,
        latitude: String(picked.lat),
        longitude: String(picked.lng),
      });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div className="aged-card rounded-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,145,58,0.2)]">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">Locate on Google Maps</h3>
          </div>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-[rgba(201,145,58,0.1)]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                onKeyDown={handleKeyDown}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A] placeholder:text-parchment/30"
                placeholder="Search for a place, address, or city..."
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || loading}
              className="flex items-center gap-1.5 px-4 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>
          <p className="text-xs text-parchment/30 mt-2">Type an address and press Search (or Enter), or click directly on the map to drop a pin.</p>
        </div>

        {/* Map */}
        <div className="relative">
          {error ? (
            <div className="flex items-center justify-center" style={{ height: '400px' }}>
              <div className="text-center p-8">
                <p className="text-red-400 text-sm mb-2">⚠️ {error}</p>
                <p className="text-parchment/40 text-xs">Set GOOGLE_MAPS_API_KEY in dashboard settings.</p>
              </div>
            </div>
          ) : (
            <>
              <div ref={containerRef} style={{ height: '400px', background: '#0D0B0A' }} />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0D0B0A]/80">
                  <Loader2 size={28} className="text-gold animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[rgba(201,145,58,0.2)] flex items-center justify-between gap-4">
          <div className="text-xs text-parchment/50 min-h-[1.25rem] flex-1">
            {picked ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-gold" />
                {picked.name || `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`}
                <span className="text-parchment/30 ml-1">({picked.lat.toFixed(4)}, {picked.lng.toFixed(4)})</span>
              </span>
            ) : (
              <span className="text-parchment/30">No location selected yet</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!picked}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Check size={14} /> Use Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}