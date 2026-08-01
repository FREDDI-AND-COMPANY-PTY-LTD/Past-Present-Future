import React, { useState, useEffect } from 'react';
import { Loader2, Search, Brain, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AdminEventEditor from '@/components/admin/AdminEventEditor';

const typeOptions = [
  { value: 'photo', label: 'Photograph' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'press_clipping', label: 'Press Clipping' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'passport', label: 'Passport' },
  { value: 'identity_document', label: 'Identity Document' },
  { value: 'memorial', label: 'Memorial' },
];

export default function AdminUncategorized({ refreshKey, scope }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [recategorizing, setRecategorizing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ContentItem.filter({ content_type: 'uncategorized' });
      let filtered = data || [];
      if (scope) {
        filtered = filtered.filter(i =>
          (scope.branchIds && scope.branchIds.has(i.branch_id)) ||
          (scope.ancestorIds && (i.ancestor_ids || []).some(aid => scope.ancestorIds.has(aid)))
        );
      }
      setItems(filtered);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [refreshKey]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    setShowAnalysis(true);
    try {
      const res = await base44.functions.invoke('reviewUncategorizedItems', {});
      setAnalysis(res.data);
    } catch (e) {
      setAnalysis({ error: 'Failed to run analysis. Please try again.' });
    }
    setAnalyzing(false);
  };

  const recategorize = async (itemId, newType) => {
    setRecategorizing(itemId);
    try {
      await base44.entities.ContentItem.update(itemId, { content_type: newType, review_status: 'reviewed' });
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) {}
    setRecategorizing(null);
  };

  const filtered = search
    ? items.filter(i =>
        (i.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.categorization_notes || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.transcribed_text || '').toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(i.visual_elements || {}).toLowerCase().includes(search.toLowerCase()) ||
        (i.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="text-gold animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-[#C9913A]"
            placeholder="Search by title, text, tags, visual elements..."
          />
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing || items.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.25)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
          {analyzing ? 'Analyzing...' : 'Run AI Pattern Review'}
        </button>
      </div>

      <p className="text-xs text-parchment/40">
        {items.length} uncategorized item{items.length !== 1 ? 's' : ''}{search && ` · ${filtered.length} matching search`}
      </p>

      {showAnalysis && (
        <div className="aged-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={20} className="text-gold" />
            <h3 className="font-display text-lg text-parchment">AI Pattern Analysis</h3>
            <button onClick={() => setShowAnalysis(false)} className="ml-auto text-parchment/40 hover:text-parchment text-xs">Close</button>
          </div>
          {analyzing ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 size={24} className="text-gold animate-spin mb-3" />
              <p className="text-sm text-parchment/50">Reviewing {items.length} uncategorized items for patterns...</p>
            </div>
          ) : analysis?.error ? (
            <p className="text-sm text-red-300">{analysis.error}</p>
          ) : analysis ? (
            <div className="space-y-4">
              {analysis.summary && <p className="text-sm text-parchment/60 leading-relaxed">{analysis.summary}</p>}
              {analysis.reclassification_suggestions?.length > 0 && (
                <div>
                  <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Reclassification Suggestions</p>
                  <div className="space-y-2">
                    {analysis.reclassification_suggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-parchment truncate">{s.current_title}</p>
                          <p className="text-xs text-parchment/40">→ {s.suggested_type} · {s.reasoning}</p>
                        </div>
                        {items.find(it => it.id === s.item_id) && (
                          <button
                            onClick={() => recategorize(s.item_id, s.suggested_type)}
                            disabled={recategorizing === s.item_id}
                            className="px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs hover:bg-[rgba(201,145,58,0.2)] transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {recategorizing === s.item_id ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.patterns_identified?.length > 0 && (
                <div>
                  <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Patterns Identified</p>
                  <div className="space-y-2">
                    {analysis.patterns_identified.map((p, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                        <p className="text-sm text-amber-light font-medium">{p.pattern_name}</p>
                        <p className="text-xs text-parchment/50 mt-1">{p.description}</p>
                        <p className="text-xs text-parchment/40 mt-1">{p.item_ids?.length || 0} items · Suggested: {p.suggested_category}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.emerging_categories?.length > 0 && (
                <div>
                  <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Emerging Categories</p>
                  <div className="space-y-2">
                    {analysis.emerging_categories.map((c, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#0D0B0A] border border-[rgba(201,145,58,0.1)]">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-amber-light font-medium">{c.proposed_name}</p>
                          <span className="text-xs text-parchment/40 ml-auto">{c.item_count} items</span>
                        </div>
                        <p className="text-xs text-parchment/50 mt-1">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="aged-card rounded-xl p-12 text-center">
          <HelpCircle size={32} className="text-gold/40 mx-auto mb-3" />
          <p className="text-parchment/50">
            {items.length === 0 ? 'No uncategorized items. Items that cannot be classified during upload will appear here.' : 'No items match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="aged-card rounded-xl">
                {/* Header */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {item.file_url ? (
                      <img src={item.file_url} alt={item.title} className="w-16 h-16 rounded-lg object-cover sepia-tint flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] flex items-center justify-center flex-shrink-0">
                        <HelpCircle size={20} className="text-gold" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-parchment/40 uppercase tracking-wider">Uncategorized</span>
                        {item.ai_confidence != null && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${item.ai_confidence >= 0.7 ? 'bg-green-500/10 text-green-300' : item.ai_confidence >= 0.4 ? 'bg-[rgba(201,145,58,0.1)] text-amber-light' : 'bg-red-500/10 text-red-300'}`}>
                            {Math.round(item.ai_confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-base text-parchment">{item.title}</h3>
                      {item.description && <p className="text-sm text-parchment/50 mt-0.5">{item.description}</p>}
                      <span className="text-xs text-parchment/40 mt-1 block">
                        {new Date(item.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-amber-light border border-[rgba(201,145,58,0.12)] hover:bg-[rgba(201,145,58,0.12)] transition-colors text-xs font-medium">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Collapse' : 'Review & Edit'}
                      </button>
                      <a href={`/content/${item.id}`} target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-parchment/40 border border-[rgba(201,145,58,0.1)] hover:text-amber-light transition-colors" title="Open detail page">
                        <ExternalLink size={14} />
                      </a>
                      <select
                        value=""
                        onChange={e => { if (e.target.value) recategorize(item.id, e.target.value); }}
                        disabled={recategorizing === item.id}
                        className="bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-[#C9913A] disabled:opacity-50"
                      >
                        <option value="">Reclassify...</option>
                        {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Full extraction — expands inline */}
                {isExpanded && (
                  <div className="border-t border-[rgba(201,145,58,0.12)] p-5">
                    <AdminEventEditor item={item} onApproved={(id) => { setItems(prev => prev.filter(i => i.id !== id)); setExpandedId(null); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}