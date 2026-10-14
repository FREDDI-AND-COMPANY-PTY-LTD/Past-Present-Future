import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Upload, Users, Flag, Copy, Edit3, Heart, ChevronRight } from 'lucide-react';
import { useBranchAdminPendingCount } from '@/hooks/useBranchAdminPendingCount';

/**
 * Prominent card shown on the Home page for branch admins — surfaces pending
 * review counts (uploads, ancestors, disputes, duplicates, edits, family links)
 * with a direct link to the Branch Admin Dashboard. Makes admin tools
 * discoverable without relying on the sidebar link alone.
 */
export default function BranchAdminReviewCard() {
  const { count, breakdown, isBranchAdmin, loading } = useBranchAdminPendingCount();

  if (loading || !isBranchAdmin) return null;

  const items = [
    { label: 'Uploads', value: breakdown.uploads, icon: Upload },
    { label: 'New Ancestors', value: breakdown.ancestors, icon: Users },
    { label: 'Disputes', value: breakdown.disputes, icon: Flag },
    { label: 'Duplicates', value: breakdown.duplicates, icon: Copy },
    { label: 'Edits', value: breakdown.edits, icon: Edit3 },
    { label: 'Family Links', value: breakdown.familyLinks, icon: Heart },
  ].filter(i => i.value > 0);

  return (
    <section className="px-6 lg:px-12 py-6 max-w-7xl mx-auto">
      <Link
        to="/branch-admin"
        className="block aged-card rounded-2xl p-6 hover:border-[rgba(201,145,58,0.5)] transition-all duration-300 group"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C9913A] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
            <Shield size={24} className="text-charcoal" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-parchment group-hover:text-gold transition-colors">
              Branch Admin Review
            </h2>
            <p className="text-sm text-parchment/50">
              {count > 0
                ? `You have ${count} item${count === 1 ? '' : 's'} to review — pending uploads, duplicate detection, ancestor merges, and more`
                : 'Review pending uploads, run duplicate detection, merge ancestor profiles, and approve content'}
            </p>
          </div>
          {count > 0 && (
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8B6914] text-amber-light font-bold text-sm flex-shrink-0">
              {count}
            </span>
          )}
          <ChevronRight size={24} className="text-gold/40 group-hover:text-gold group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-[rgba(201,145,58,0.12)]">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-xs text-amber-light"
                >
                  <Icon size={12} />
                  {item.value} {item.label}
                </span>
              );
            })}
          </div>
        )}
      </Link>
    </section>
  );
}