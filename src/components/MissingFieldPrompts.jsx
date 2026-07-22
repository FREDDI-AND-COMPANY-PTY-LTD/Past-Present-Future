import React from 'react';
import { MapPin, Calendar, HelpCircle, X } from 'lucide-react';

/**
 * Dismissable AI prompts for fields the analysis couldn't fill. Visibility is
 * driven solely by `isVisible(field)` + `dismissField(field)` — never by field
 * values — matching the parent's stable missing-field tracking.
 */
export default function MissingFieldPrompts({
  isVisible,
  dismissField,
  form,
  setForm,
  openLocationPicker,
}) {
  const nothing = !isVisible('location') && !isVisible('date') && !isVisible('description');
  if (nothing) return null;

  return (
    <>
      {isVisible('location') && (
        <div className="aged-card rounded-xl p-4 border-[rgba(201,145,58,0.25)]">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-gold" />
            <p className="text-sm text-parchment font-medium">Event location not identified</p>
            <button onClick={() => dismissField('location')} className="ml-auto text-parchment/30 hover:text-parchment transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-parchment/40 mt-2">The AI couldn't determine where this event took place. Please enter the city, state, or address in the <span className="text-amber-light">Event Location</span> field below.</p>
        </div>
      )}

      {isVisible('date') && (
        <div className="aged-card rounded-xl p-4 border-[rgba(201,145,58,0.25)]">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gold" />
            <p className="text-sm text-parchment font-medium">Event date not identified</p>
            <button onClick={() => dismissField('date')} className="ml-auto text-parchment/30 hover:text-parchment transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-parchment/40 mt-2">The AI couldn't determine when this event took place. Please enter the date (or an approximate era) in the <span className="text-amber-light">Date</span> field below.</p>
        </div>
      )}

      {isVisible('description') && (
        <div className="aged-card rounded-xl p-4 border-[rgba(201,145,58,0.25)]">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={18} className="text-gold" />
            <p className="text-sm text-parchment font-medium">Event description not identified</p>
            <button onClick={() => dismissField('description')} className="ml-auto text-parchment/30 hover:text-parchment transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-parchment/40 mb-3">The AI couldn't confidently describe what this event or item is. Please enter a title and description so the archive can categorise it properly.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                placeholder="e.g. Birth Certificate — Giuseppe Freddi (1898)"
              />
            </div>
            <div>
              <label className="text-xs text-parchment/50 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
                placeholder="What is this item? (e.g. A photograph of the family home in Venice, circa 1920)"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}