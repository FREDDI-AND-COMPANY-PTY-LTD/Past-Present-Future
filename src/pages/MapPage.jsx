import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import GoogleMap from '@/components/GoogleMap';
import MigrationTimeline from '@/components/MigrationTimeline';
import { useBranchRoot } from '@/hooks/useBranchRoot';
import BranchScopeToggle from '@/components/BranchScopeToggle';

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
  const [activeWaypoint, setActiveWaypoint] = useState(null);
  const [scope, setScope] = useState('branch');
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

  // Only show admin-reviewed content on the public map
  const reviewedItems = contentItems.filter(i => i.review_status === 'reviewed' && !i.parent_content_item_id);
  const branchScoped = scope === 'branch' && descendantIds.size > 0;
  const branchItems = branchScoped
    ? reviewedItems.filter(i => (i.ancestor_ids || []).some(aid => descendantIds.has(aid)))
    : reviewedItems;
  const branchRoutes = branchScoped
    ? routes.filter(r => !r.ancestor_id || descendantIds.has(r.ancestor_id))
    : routes;
  const branchAncestors = branchScoped
    ? ancestors.filter(a => descendantIds.has(a.id))
    : ancestors;

  // Compute flat waypoint list from routes (same iteration order as GoogleMap uses)
  const flatWaypoints = useMemo(() => {
    const list = [];
    branchRoutes.forEach((route) => {
      (route.waypoints || []).forEach(wp => {
        if (wp.lat && wp.lng) {
          list.push({
            lat: wp.lat, lng: wp.lng,
            label: wp.label, date: wp.date, description: wp.description,
            routeName: route.name,
          });
        }
      });
    });
    return list;
  }, [branchRoutes]);

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

  const handleWaypointSelect = useCallback((idx) => {
    setActiveWaypoint(idx);
  }, []);

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-4xl text-parchment mb-2">Migration Map</h1>
            <p className="text-parchment/50 text-sm">Trace the Freddi bloodlines from their international origins to Victoria. Click any numbered pin or use the timeline to follow the migration journey over time.</p>
          </div>
          <BranchScopeToggle value={scope} onChange={setScope} />
        </div>
      </div>

      <div className="px-6 lg:px-12 pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map takes 2 columns on desktop */}
          <div className="lg:col-span-2">
            <GoogleMap
              markers={markers}
              routes={branchRoutes}
              loading={loading || branchLoading}
              activeWaypoint={activeWaypoint}
              onWaypointSelect={handleWaypointSelect}
            />

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

          {/* Timeline panel takes 1 column on desktop */}
          <div className="lg:col-span-1">
            <MigrationTimeline
              waypoints={flatWaypoints}
              activeIndex={activeWaypoint}
              onSelect={handleWaypointSelect}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}