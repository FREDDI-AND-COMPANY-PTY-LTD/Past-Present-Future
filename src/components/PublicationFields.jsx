import React, { useState } from 'react';
import { FileBadge, MapPin, Calendar, HelpCircle } from 'lucide-react';
import DateSelectInput from '@/components/DateSelectInput';
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput';
import LocationPicker from '@/components/LocationPicker';

/**
 * "The Document" form section — the date and location a record was ISSUED or
 * PUBLISHED, kept distinct from the event date/location it documents
 * (e.g. a birth certificate's issue date/registry city vs. the birth itself).
 *
 * Controlled by the parent form state via `form` + `onChange(field, value)`.
 */
export default function PublicationFields({ form, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const setPub = (patch) => {
    Object.entries(patch).forEach(([k, v]) => onChange(k, v));
  };

  return (
    <div className="aged-card rounded-xl p-6 space-y-4 border-[rgba(201,145,58,0.15)]">
      <div className="flex items-start gap-2">
        <FileBadge size={18} className="text-gold flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-display text-lg text-parchment">The Document</h3>
          <p className="text-xs text-parchment/40 mt-0.5 flex items-center gap-1">
            <HelpCircle size={11} className="text-gold/60" />
            The date and place this record was issued or published — not the event it records.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1">
            <Calendar size={12} className="text-gold/60" /> Issue / Publication Date
          </label>
          <DateSelectInput
            value={form.publication_date}
            onChange={(v) => onChange('publication_date', v)}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm text-parchment/60 mb-1 block flex items-center gap-1">
            <MapPin size={12} className="text-gold/60" /> Issue / Publication Location
          </label>
          <div className="flex gap-2">
            <LocationAutocompleteInput
              value={form.publication_location_name}
              onChange={({ location_name, latitude, longitude }) => setPub({
                publication_location_name: location_name,
                publication_latitude: latitude !== undefined ? latitude : form.publication_latitude,
                publication_longitude: longitude !== undefined ? longitude : form.publication_longitude,
              })}
              placeholder="e.g. Registry office, Melbourne"
              className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0"
            >
              <MapPin size={14} /> Map
            </button>
          </div>
        </div>
      </div>

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={({ location_name, latitude, longitude }) => setPub({
          publication_location_name: location_name,
          publication_latitude: latitude,
          publication_longitude: longitude,
        })}
        initialLocation={form.publication_location_name}
        initialLat={form.publication_latitude}
        initialLng={form.publication_longitude}
      />
    </div>
  );
}