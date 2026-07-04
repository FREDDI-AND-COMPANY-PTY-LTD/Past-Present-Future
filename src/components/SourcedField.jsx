import React from 'react';
import SourceIndicator from './SourceIndicator';

export default function SourcedField({ entityType, entityId, fieldName, label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={14} className="text-gold/60 flex-shrink-0" />}
      <span className="text-sm text-parchment/60">{value || 'Not specified'}</span>
      <SourceIndicator entityType={entityType} entityId={entityId} fieldName={fieldName} label={label} />
    </div>
  );
}