import React, { useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { loadGoogleMaps } from '@/lib/googleMaps';

/**
 * Location input with Google Maps Autocomplete (address autofill).
 *
 * Uses an uncontrolled input (defaultValue + ref) to avoid the React re-render
 * issue that causes Google's suggestion dropdown to disappear.
 *
 * Props:
 *  - value:         controlled value (synced to the input via ref, not via `value` prop)
 *  - onChange:       called with { location_name, latitude?, longitude? }
 *                    on manual typing only location_name is set; on place selection all three
 *  - placeholder:    input placeholder
 *  - className:      classes applied to the bare <input>
 */
export default function LocationAutocompleteInput({ value, onChange, placeholder, className }) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync external value changes (e.g. AI analysis fills in the location)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== (value || '')) {
      inputRef.current.value = value || '';
    }
  }, [value]);

  // Load Google Maps and attach Autocomplete once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMapsConfig');
        const apiKey = res.data?.apiKey;
        if (!apiKey) return;
        const gmaps = await loadGoogleMaps(apiKey);
        if (cancelled || !inputRef.current) return;
        const ac = new gmaps.places.Autocomplete(inputRef.current, { types: ['geocode'] });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place.geometry) return;
          onChangeRef.current({
            location_name: place.formatted_address || place.name || '',
            latitude: String(place.geometry.location.lat()),
            longitude: String(place.geometry.location.lng()),
          });
        });
      } catch (e) {
        // Silent fail — input still works as a plain text field
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    onChangeRef.current({ location_name: e.target.value });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      autoComplete="off"
      defaultValue={value || ''}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
}