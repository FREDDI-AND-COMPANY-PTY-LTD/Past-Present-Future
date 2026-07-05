import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import { useBranchRoot } from '@/hooks/useBranchRoot';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const goldIcon = L.divIcon({
  className: 'custom-gold-pin',
  html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#E8C97A,#C9913A);border:2px solid #0D0B0A;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

const routeColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C'];

// Calls invalidateSize on mount + window resize — fixes grey tiles / glitching
// when the sidebar toggles or the container dimensions change.
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const timer = setTimeout(fix, 100);
    window.addEventListener('resize', fix);
    return () => { clearTimeout(timer); window.removeEventListener('resize', fix); };
  }, [map]);
  return null;
}

// Auto-fits the map to show all markers, or falls back to a default view.
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 10);
    } else {
      map.fitBounds(positions, { padding: [60, 60], maxZoom: 12 });
    }
  }, [map, positions]);
  return null;
}

export default function MapPage() {
  const [contentItems, setContentItems] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
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
  const itemsWithLocation = branchItems.filter(i => i.latitude && i.longitude);

  // Collect all marker positions for auto-fit
  const allPositions = [
    ...itemsWithLocation.map(i => [i.latitude, i.longitude]),
    ...branchRoutes.flatMap(r => (r.waypoints || []).filter(w => w.lat && w.lng).map(w => [w.lat, w.lng])),
  ];

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-4xl text-parchment mb-2">Migration Map</h1>
          <p className="text-parchment/50 text-sm">Trace the Freddi bloodlines from their international origins to Victoria. Click any pin to explore.</p>
        </div>
      </div>

      <div className="px-6 lg:px-12 pb-12 max-w-7xl mx-auto">
        {(loading || branchLoading) ? (
          <div className="aged-card rounded-2xl h-[600px] animate-pulse" />
        ) : (
          <div className="aged-card rounded-2xl overflow-hidden p-1">
            <MapContainer
              ref={mapRef}
              center={[-25, 135]}
              zoom={3}
              minZoom={2}
              maxZoom={18}
              scrollWheelZoom
              style={{ height: '65vh', minHeight: '500px', borderRadius: '14px', background: '#0D0B0A' }}
            >
              <MapResizer />
              <FitBounds positions={allPositions} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />

              {/* Migration routes */}
              {branchRoutes.map((route, ri) => {
                const waypoints = (route.waypoints || []).filter(w => w.lat && w.lng);
                if (waypoints.length < 2) return null;
                const color = route.color || routeColors[ri % routeColors.length];
                return (
                  <React.Fragment key={route.id}>
                    <Polyline
                      positions={waypoints.map(w => [w.lat, w.lng])}
                      pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: '8 6' }}
                    />
                    {waypoints.map((wp, wi) => (
                      <Marker key={`${route.id}-${wi}`} position={[wp.lat, wp.lng]} icon={goldIcon}>
                        <Popup>
                          <div style={{ minWidth: '180px' }}>
                            <p style={{ color: '#C9913A', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{wp.label || 'Waypoint'}</p>
                            {wp.date && <p style={{ color: '#F5ECD7', fontSize: '12px', opacity: 0.7 }}>{wp.date}</p>}
                            {wp.description && <p style={{ color: '#F5ECD7', fontSize: '12px', marginTop: '4px', opacity: 0.6 }}>{wp.description}</p>}
                            <p style={{ color: '#C9913A', fontSize: '11px', marginTop: '6px', opacity: 0.6 }}>{route.name}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Content item pins */}
              {itemsWithLocation.map(item => {
                const tagged = (item.ancestor_ids || [])
                                 .map(aid => branchAncestors.find(a => a.id === aid))
                                 .filter(Boolean);
                return (
                  <Marker key={item.id} position={[item.latitude, item.longitude]} icon={goldIcon}>
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        {item.file_url && (
                          <img src={item.file_url} alt={item.title} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                        )}
                        <p style={{ color: '#F5ECD7', fontWeight: 600, fontSize: '14px' }}>{item.title}</p>
                        {tagged.length > 0 && (
                          <p style={{ color: '#C9913A', fontSize: '12px', marginTop: '2px' }}>{tagged.map(a => a.full_name).join(', ')}</p>
                        )}
                        {item.date && <p style={{ color: '#F5ECD7', fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>{new Date(item.date).toLocaleDateString('en-AU')}</p>}
                        {item.location_name && <p style={{ color: '#F5ECD7', fontSize: '11px', opacity: 0.6 }}>{item.location_name}</p>}
                        <Link to={`/content/${item.id}`} style={{ display: 'inline-block', marginTop: '8px', color: '#C9913A', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}

        {/* Legend */}
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