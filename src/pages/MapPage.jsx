import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import GoogleMap from '@/components/GoogleMap';
import { useBranchRoot } from '@/hooks/useBranchRoot';

const routeColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C'];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildMarkerHtml(item, taggedAncestors) {
  const thumb = item.file_url
    ? `<img src="${escapeHtml(item.file_url)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px" />`
    : '';
  const ancestorLinks = taggedAncestors.length > 0
    ? taggedAncestors.map(a =>
        `<a data-spa-link="/ancestor/${a.id}" style="color:#C9913A;font-size:12px;cursor:pointer;text-decoration:none">${escapeHtml(a.full_name)}</a>`
      ).join(', ')
    : '';
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-AU') : '';
  const loc = item.location_name || '';
  return `<div style="min-width:200px;padding:4px">
    ${thumb}
    <p style="color:#F5ECD7;font-weight:600;font-size:14px;margin:0">${escapeHtml(item.title)}</p>
    ${ancestorLinks ? `<p style="margin:2px 0 0">${ancestorLinks}</p>` : ''}
    ${dateStr ? `<p style="color:#F5ECD7;font-size:11px;opacity:0.6;margin:2px 0 0">${dateStr}</p>` : ''}
    ${loc ? `<p style="color:#F5ECD7;font-size:11px;opacity:0.6;margin:0">${escapeHtml(loc)}</p>` : ''}
    <a data-spa-link="/content/${item.id}" style="display:inline-block;margin-top:8px;color:#C9913A;font-size:13px;text-decoration:none;font-weight:600;cursor:pointer">View →</a>
  </div>`;
}

export default function MapPage() {
  const [contentItems, setContentItems] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { descendantIds, loading: branchLoading } = useBranchRoot();

  useEffect(() => {
    Promise.all([
      base44.entities.ContentItem.filter({}),
      base44.entities.MigrationRoute.filter({}),
      base44.entities.Ancestor.list(),
    ]).then(([items, rts, ancs]) => {
      setContentItems(items || []);
      setRoutes(rts || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const branchItems = descendantIds.size > 0
    ? contentItems.filter(i => (i.ancestor_ids || []).some(aid => descendantIds.has(aid)))
    : contentItems;
  const branchRoutes = descendantIds.size > 0
    ? routes.filter(r => !r.ancestor_id || descendantIds.has(r.ancestor_id))
    : routes;
  const branchAncestors = descendantIds.size > 0
    ? ancestors.filter(a => descendantIds.has(a.id))
    : ancestors;

  const markers = useMemo(() => {
    return branchItems
      .filter(i => i.latitude && i.longitude)
      .map(item => {
        const tagged = (item.ancestor_ids || [])
          .map(aid => branchAncestors.find(a => a.id === aid))
          .filter(Boolean);
        return {
          position: { lat: item.latitude, lng: item.longitude },
          title: item.title,
          htmlContent: buildMarkerHtml(item, tagged),
        };
      });
  }, [branchItems, branchAncestors]);

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-4xl text-parchment mb-2">Migration Map</h1>
          <p className="text-parchment/50 text-sm">Trace the Freddi bloodlines from their international origins to Victoria. Click any pin to explore — jump straight to ancestor profiles and media.</p>
        </div>
      </div>

      <div className="px-6 lg:px-12 pb-12 max-w-7xl mx-auto">
        <GoogleMap markers={markers} routes={branchRoutes} loading={loading || branchLoading} />

        {branchRoutes.length > 0 && (
          <div className="aged-card rounded-xl p-4 mt-4">
            <p className="text-xs text-parchment/40 uppercase tracking-wider mb-2">Migration Routes</p>
            <div className="flex flex-wrap gap-4">
              {branchRoutes.map((route, ri) => (
                <div key={route.id} className="flex items-center gap-2">
                  <div className="w-6 h-0.5" style={{ backgroundColor: route.color || routeColors[ri % routeColors.length] }} />
                  <span className="text-sm text-parchment/70">{route.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}