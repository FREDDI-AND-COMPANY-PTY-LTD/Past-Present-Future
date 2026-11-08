import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ScrollText, AlertTriangle, FileText, Quote, Users, HelpCircle } from 'lucide-react';

const GRADE_STYLE = {
  documented: 'bg-[rgba(120,180,120,0.12)] text-[#a8d5a2] border-[rgba(120,180,120,0.3)]',
  testimony: 'bg-[rgba(201,145,58,0.12)] text-amber-light border-[rgba(201,145,58,0.3)]',
  hypothesis: 'bg-[rgba(245,236,215,0.06)] text-parchment/50 border-[rgba(245,236,215,0.15)]',
};

const GRADE_ICON = { documented: FileText, testimony: Users, hypothesis: HelpCircle };

const label = (field) => field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function GradeBadge({ grade }) {
  const Icon = GRADE_ICON[grade] || HelpCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${GRADE_STYLE[grade] || GRADE_STYLE.testimony}`}>
      <Icon size={10} /> {grade}
    </span>
  );
}

/**
 * The evidence register for one ancestor: every claim the archive holds,
 * grouped by field, beside the value currently shown on the record.
 * "As recorded" is never overwritten — disagreements are shown, not silently resolved.
 */
export default function AssertionRegister({ ancestor }) {
  const [assertions, setAssertions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ancestor?.id) return;
    base44.entities.Assertion
      .filter({ subject_id: ancestor.id }, { sort: '-created_date', limit: 200 })
      .then((page) => setAssertions(page?.items || []))
      .catch(() => setAssertions([]))
      .finally(() => setLoading(false));
  }, [ancestor?.id]);

  if (loading) {
    return <div className="aged-card rounded-2xl h-32 animate-pulse mb-8" />;
  }

  if (assertions.length === 0) {
    return (
      <div className="aged-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ScrollText size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-parchment">Register of Evidence</h2>
        </div>
        <p className="text-sm text-parchment/50">
          No claims have been recorded for this ancestor yet. Once the archive holds a letter,
          certificate or statement that asserts a fact about them, it will appear here beside the
          value the record currently shows.
        </p>
      </div>
    );
  }

  const fields = [...new Set(assertions.map((a) => a.field_name))];

  return (
    <div className="aged-card rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <ScrollText size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-parchment">Register of Evidence</h2>
      </div>
      <p className="text-xs text-parchment/40 mb-5">
        Every claim held for this ancestor, with its evidence grade and the item that states it.
        The accepted value is what the profile shows; the other claims are kept as recorded.
      </p>

      <div className="space-y-5">
        {fields.map((field) => {
          const claims = assertions.filter((a) => a.field_name === field);
          const contested = claims.some((c) => c.conflict);
          const acceptedValue = ancestor?.[field];
          return (
            <div key={field} className="border border-[rgba(201,145,58,0.12)] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[rgba(201,145,58,0.05)]">
                <span className="text-xs uppercase tracking-wider text-parchment/50">{label(field)}</span>
                {contested && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-light">
                    <AlertTriangle size={11} /> competing claims
                  </span>
                )}
              </div>
              <div className="divide-y divide-[rgba(201,145,58,0.08)]">
                {claims.map((a) => {
                  const isAccepted =
                    a.accepted ||
                    (acceptedValue !== undefined &&
                      acceptedValue !== null &&
                      String(acceptedValue).trim().toLowerCase() === String(a.value).trim().toLowerCase());
                  return (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${isAccepted ? 'text-parchment font-medium' : 'text-parchment/70'}`}>
                          {a.value}
                        </span>
                        <GradeBadge grade={a.grade} />
                        {isAccepted ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-[rgba(201,145,58,0.3)] text-amber-light">
                            as accepted
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-[rgba(245,236,215,0.12)] text-parchment/40">
                            as recorded
                          </span>
                        )}
                        {a.status === 'superseded' && (
                          <span className="text-[11px] text-parchment/30">superseded</span>
                        )}
                      </div>
                      {a.source_excerpt && (
                        <p className="flex items-start gap-1.5 text-xs text-parchment/45 mt-1.5 italic">
                          <Quote size={11} className="mt-0.5 flex-shrink-0" /> {a.source_excerpt}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-parchment/40">
                        {a.source_content_item_id ? (
                          <Link to={`/content/${a.source_content_item_id}`} className="text-amber-light/80 hover:text-amber-light hover:underline">
                            {a.source_label || 'View source item'}
                          </Link>
                        ) : (
                          <span>{a.source_label || 'No source document attached'}</span>
                        )}
                        {a.asserted_by_name && <span>· recorded by {a.asserted_by_name}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}