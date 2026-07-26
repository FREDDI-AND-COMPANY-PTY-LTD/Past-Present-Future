import React from 'react';
import { MapPin, Calendar, Users, FileText } from 'lucide-react';

// Inline edit form for an ancestor profile, rendered inside the going-live
// swipe review. Swipe right = confirm (admin_verified), left = flag (staged).
export default function SwipeAncestorForm({ formData, setFormData, ancestors }) {
  const setField = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const inputClass = "w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]";

  const mother = (ancestors || []).find(a => a.id === formData.mother_id);
  const father = (ancestors || []).find(a => a.id === formData.father_id);
  const partner = (ancestors || []).find(a => a.id === formData.partner_id);
  const rels = [
    mother && `Mother: ${mother.full_name}`,
    father && `Father: ${father.full_name}`,
    partner && `Partner: ${partner.full_name}`,
  ].filter(Boolean);

  return (
    <div className="p-4 space-y-3">
      <div>
        <label className="text-xs text-parchment/50 mb-1 block">Full Name</label>
        <input value={formData.full_name || ''} onChange={e => setField('full_name', e.target.value)} className={inputClass} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><Calendar size={11} /> Birth Date</label>
          <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(formData.birth_date) ? formData.birth_date : ''} onChange={e => setField('birth_date', e.target.value)} className={inputClass} style={{ colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><Calendar size={11} /> Death Date</label>
          <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(formData.death_date) ? formData.death_date : ''} onChange={e => setField('death_date', e.target.value)} className={inputClass} style={{ colorScheme: 'dark' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><MapPin size={11} /> Birth Place</label>
          <input value={formData.birth_place || ''} onChange={e => setField('birth_place', e.target.value)} className={inputClass} placeholder="Venice, Italy" />
        </div>
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><MapPin size={11} /> Death Place</label>
          <input value={formData.death_place || ''} onChange={e => setField('death_place', e.target.value)} className={inputClass} placeholder="Geelong, Australia" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-parchment/50 mb-1 block">Sex</label>
          <select value={formData.sex || ''} onChange={e => setField('sex', e.target.value)} className={inputClass}>
            <option value="">Unknown</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-parchment/50 mb-1 block">Nationality</label>
          <input value={formData.nationality || ''} onChange={e => setField('nationality', e.target.value)} className={inputClass} placeholder="Italian" />
        </div>
      </div>

      {formData.sex === 'female' && (
        <div>
          <label className="text-xs text-parchment/50 mb-1 block">Maiden Name (birth surname)</label>
          <input value={formData.maiden_name || ''} onChange={e => setField('maiden_name', e.target.value)} className={inputClass} placeholder="e.g. Freddi — links to her birth branch" />
        </div>
      )}

      <div>
        <label className="text-xs text-parchment/50 mb-1 block">Status</label>
        <select value={formData.living === false ? 'false' : 'true'} onChange={e => setField('living', e.target.value === 'true')} className={inputClass}>
          <option value="true">Living</option>
          <option value="false">Deceased</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><FileText size={11} /> Biography</label>
        <textarea value={formData.biography || ''} onChange={e => setField('biography', e.target.value)} rows={3} className={inputClass} />
      </div>

      {rels.length > 0 && (
        <div>
          <label className="text-xs text-parchment/50 mb-1 block flex items-center gap-1"><Users size={11} /> Relationships (edit on profile page)</label>
          <p className="text-xs text-parchment/60">{rels.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}