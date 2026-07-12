import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Calendar, Navigation, ArrowDown, Route as RouteIcon, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import { useBranchRoot } from '@/hooks/useBranchRoot';

const routeColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C', '#A67C2E', '#F0D98C'];

function parseWaypointDate(dateStr) {
  if (!dateStr) return null;
  // Try ISO first
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso.getTime();
  // Try year-only
  const year = parseInt(dateStr, 10);
  if (!isNaN(year) && year > 1500 && year < 2200) return new Date(year, 0, 1).getTime();
  return null;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Date unknown';
  const ts = parseWaypointDate(dateStr);
  if (ts) {
    return new Date(ts).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return dateStr;
}

export default function MigrationJourney() {
  const [routes, setRoutes] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(null);
  const { descendantIds, loading: branchLoading } = useBranchRoot();

  useEffect(() => {
    Promise.all([
      base44.entities.MigrationRoute.filter({}),
      base44.entities.Ancestor.list(),
    ]).then(([rts, ancs]) => {
      setRoutes(rts || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const branchRoutes = descendantIds.size > 0
    ? routes.filter(r => !r.ancestor_id || descendantIds.has(r.ancestor_id))
    : routes;

  const branchAncestors = useMemo(() => {
    const map = new Map();
    (descendantIds.size > 0 ? ancestors.filter(a => descendantIds.has(a.id)) : ancestors)
      .forEach(a => map.set(a.id, a));
    return map;
  }, [ancestors, descendantIds]);

  // Flatten all waypoints across all routes, then sort chronologically
  const allWaypoints = useMemo(() => {
    const list = [];
    branchRoutes.forEach((route, ri) => {
      const color = route.color || routeColors[ri % routeColors.length];
      const routeAncestor = route.ancestor_id ? branchAncestors.get(route.ancestor_id) : null;
      (route.waypoints || []).forEach((wp, wpi) => {
        list.push({
          ...wp,
          routeName: route.name,
          routeColor: color,
          routeAncestor,
          routeIndex: ri,
          wpIndex: wpi,
          timestamp: parseWaypointDate(wp.date),
        });
      });
    });
    // Sort chronologically; waypoints without dates go to the end, preserving route order
    list.sort((a, b) => {
      if (a.timestamp == null && b.timestamp == null) return 0;
      if (a.timestamp == null) return 1;
      if (b.timestamp == null) return -1;
      return a.timestamp - b.timestamp;
    });
    return list;
  }, [branchRoutes, branchAncestors]);

  const isLoading = loading || branchLoading;

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl text-parchment mb-2">Migration Journey</h1>
          <p className="text-parchment/50 text-sm max-w-2xl">
            Every waypoint from every migration route, woven into a single chronological timeline. Follow the family's journey across the world through time.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="text-gold animate-spin" />
          </div>
        ) : allWaypoints.length === 0 ? (
          <div className="aged-card rounded-2xl p-12 text-center">
            <MapPin size={32} className="text-parchment/30 mx-auto mb-3" />
            <p className="text-parchment/50 text-sm">No migration waypoints have been recorded yet.</p>
          </div>
        ) : (
          <>
            {/* Route legend */}
            {branchRoutes.length > 1 && (
              <div className="aged-card rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
                <span className="text-xs text-parchment/40 uppercase tracking-wider flex items-center gap-1.5">
                  <RouteIcon size={12} /> Routes
                </span>
                {branchRoutes.map((route, ri) => {
                  const color = route.color || routeColors[ri % routeColors.length];
                  const anc = route.ancestor_id ? branchAncestors.get(route.ancestor_id) : null;
                  return (
                    <div key={route.id} className="flex items-center gap-2">
                      <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-parchment/70">{route.name}</span>
                      {anc && <span className="text-xs text-parchment/40">· {anc.full_name}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scrollable timeline */}
            <div className="relative">
              {/* Central vertical line */}
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[rgba(201,145,58,0.4)] via-[rgba(201,145,58,0.2)] to-transparent" />

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {allWaypoints.map((wp, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={`${wp.routeIndex}-${wp.wpIndex}`}
                      onClick={() => setActiveIdx(isActive ? null : idx)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Marker dot on the line */}
                        <div className="relative flex-shrink-0 z-10">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all"
                            style={{
                              backgroundColor: isActive ? wp.routeColor : '#0D0B0A',
                              borderColor: wp.routeColor,
                              boxShadow: isActive ? `0 0 20px ${wp.routeColor}55` : 'none',
                            }}
                          >
                            <MapPin size={14} style={{ color: isActive ? '#0D0B0A' : wp.routeColor }} />
                          </div>
                        </div>

                        {/* Content card */}
                        <div className={`flex-1 aged-card rounded-xl p-5 transition-all duration-200 ${isActive ? 'border-[rgba(201,145,58,0.4)] gold-glow' : 'opacity-90 hover:opacity-100'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${wp.routeColor}22`, color: wp.routeColor }}
                            >
                              {wp.routeName}
                            </span>
                            {wp.routeAncestor && (
                              <a
                                href={`/ancestor/${wp.routeAncestor.id}`}
                                onClick={(e) => { e.stopPropagation(); }}
                                className="text-xs text-amber-light/70 hover:text-amber-light transition-colors"
                              >
                                {wp.routeAncestor.full_name}
                              </a>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-display text-lg ${isActive ? 'text-gold' : 'text-parchment'}`}>
                                {wp.label || 'Unknown location'}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-parchment/50">
                                <Calendar size={12} />
                                {formatDateLabel(wp.date)}
                              </div>
                            </div>
                            {wp.lat && wp.lng && (
                              <a
                                href={`https://www.google.com/maps?q=${wp.lat},${wp.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors flex-shrink-0"
                              >
                                <Navigation size={11} /> Map
                              </a>
                            )}
                          </div>

                          {wp.description && (
                            <p className="text-sm text-parchment/60 leading-relaxed mt-3">{wp.description}</p>
                          )}

                          {isActive && (
                            <div className="mt-3 pt-3 border-t border-[rgba(201,145,58,0.15)] flex items-center gap-1.5 text-xs text-gold">
                              <ArrowDown size={12} />
                              {idx < allWaypoints.length - 1 ? 'Next stop below' : 'End of journey'}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary footer */}
            <div className="mt-6 flex items-center justify-between text-xs text-parchment/40">
              <span>{allWaypoints.length} waypoints · {branchRoutes.length} route{branchRoutes.length !== 1 ? 's' : ''}</span>
              {activeIdx != null && (
                <button onClick={() => setActiveIdx(null)} className="text-amber-light/70 hover:text-amber-light transition-colors">
                  Clear selection
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}