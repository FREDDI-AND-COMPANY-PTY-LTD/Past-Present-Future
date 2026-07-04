import React from 'react';
import { Link } from 'react-router-dom';

export default function AncestorAvatar({ ancestor, size = 'md' }) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const sizeClass = sizes[size] || sizes.md;
  const showLink = ancestor.id;

  const content = (
    <div className={`${sizeClass} rounded-full overflow-hidden border-2 ${ancestor.living ? 'border-[#E8C97A]' : 'border-[#C9913A]/50'} ${ancestor.living ? 'gold-glow' : ''} bg-[#1A1614] flex items-center justify-center relative`}>
      {ancestor.profile_photo ? (
        <img
          src={ancestor.profile_photo}
          alt={ancestor.full_name}
          className={`w-full h-full object-cover ${!ancestor.living ? 'sepia-tint' : ''}`}
        />
      ) : (
        <span className="font-display text-gold/60 text-xl">
          {ancestor.full_name?.charAt(0) || '?'}
        </span>
      )}
    </div>
  );

  if (showLink) {
    return (
      <Link to={`/ancestor/${ancestor.id}`} className="inline-block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}