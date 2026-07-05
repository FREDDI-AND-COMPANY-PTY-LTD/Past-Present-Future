import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const routeColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C'];

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1A1614' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1614' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B7355' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#C9913A' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#C9913A' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8B7355' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3020' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A2218' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D0B0A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5A4A30' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#151210' }] },
];

let scriptPromise = null;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => { scriptPromise = null; reject(new Error('Failed to load Google Maps script')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

const goldPinSvg = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">' +
  '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" ' +
  'fill="#C9913A" stroke="#0D0B0A" stroke-width="2"/>' +
  '<circle cx="14" cy="14" r="5" fill="#E8C97A"/></svg>'
);

let clustererScriptPromise = null;

function loadMarkerClusterer() {
  if (window.MarkerClusterer) return Promise.resolve(window.MarkerClusterer);
  if (clustererScriptPromise) return clustererScriptPromise;
  clustererScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-marker-clusterer/1.0.0/markerclusterer.min.js';
    s.async = true;
    s.onload = () => resolve(window.MarkerClusterer);
    s.onerror = () => { clustererScriptPromise = null; reject(new Error('Failed to load MarkerClusterer')); };
    document.head.appendChild(s);
  });
  return clustererScriptPromise;
}

function clusterIconSvg(size, fillColor) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + (size / 2 - 3) + '" fill="' + fillColor + '" stroke="#0D0B0A" stroke-width="2" opacity="0.9"/>' +
    '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + (size / 2 - 7) + '" fill="none" stroke="#0D0B0A" stroke-width="1" opacity="0.3"/>' +
    '</svg>';
  return 'data:image/svg+xml;utf-8,' + encodeURIComponent(svg);
}

const clusterStyles = [
  { url: clusterIconSvg(40, '#C9913A'), height: 40, width: 40, textColor: '#0D0B0A', textSize: 13, textDecoration: 'none' },
  { url: clusterIconSvg(50, '#D4A04C'), height: 50, width: 50, textColor: '#0D0B0A', textSize: 14, textDecoration: 'none' },
  { url: clusterIconSvg(60, '#E8C97A'), height: 60, width: 60, textColor: '#0D0B0A', textSize: 15, textDecoration: 'none' },
];

export default function GoogleMap({ markers = [], routes = [], loading = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const gmapsRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const clustererRef = useRef(null);
  const [error, setError] = useState(null);
  const [mapsReady, setMapsReady] = useState(false);

  // SPA link handler — intercepts clicks on data-spa-link attributes (inside info windows)
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest('[data-spa-link]');
      if (link) {
        e.preventDefault();
        const path = link.getAttribute('data-spa-link');
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Initialize map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMapsConfig');
        const apiKey = res.data?.apiKey;
        if (!apiKey) throw new Error('Google Maps API key not configured');
        const gmaps = await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;
        gmapsRef.current = gmaps;
        mapRef.current = new gmaps.Map(containerRef.current, {
          center: { lat: -25, lng: 135 },
          zoom: 4,
          styles: darkMapStyles,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
        });
        try {
          await loadMarkerClusterer();
        } catch (e) { /* clustering optional */ }
        setMapsReady(true);
      } catch (e) {
        setError(e.message || 'Failed to load map');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Update markers + routes when data changes
  useEffect(() => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map || !mapsReady) return;

    // Clear existing overlays
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    const bounds = new gmaps.LatLngBounds();
    const infoWindow = new gmaps.InfoWindow();
    const pinIcon = {
      url: `data:image/svg+xml;utf-8,${goldPinSvg}`,
      scaledSize: new gmaps.Size(28, 36),
      anchor: new gmaps.Point(14, 36),
    };

    // Draw migration routes + waypoint markers
    routes.forEach((route, ri) => {
      const wps = (route.waypoints || []).filter(w => w.lat && w.lng);
      if (wps.length === 0) return;
      const color = route.color || routeColors[ri % routeColors.length];

      if (wps.length >= 2) {
        const polyline = new gmaps.Polyline({
          path: wps.map(w => ({ lat: w.lat, lng: w.lng })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map,
        });
        polylinesRef.current.push(polyline);
      }

      wps.forEach(wp => {
        const pos = { lat: wp.lat, lng: wp.lng };
        bounds.extend(pos);
        const html = `<div style="min-width:180px;padding:4px">
          <p style="color:#C9913A;font-weight:600;font-size:14px;margin:0 0 4px">${wp.label || 'Waypoint'}</p>
          ${wp.date ? `<p style="color:#F5ECD7;font-size:12px;opacity:0.7;margin:0">${wp.date}</p>` : ''}
          ${wp.description ? `<p style="color:#F5ECD7;font-size:12px;opacity:0.6;margin:4px 0 0">${wp.description}</p>` : ''}
          <p style="color:#C9913A;font-size:11px;opacity:0.6;margin:6px 0 0">${route.name}</p>
        </div>`;
        const marker = new gmaps.Marker({ position: pos, icon: pinIcon, title: wp.label || 'Waypoint' });
        marker.addListener('click', () => { infoWindow.setContent(html); infoWindow.open(map, marker); });
        markersRef.current.push(marker);
      });
    });

    // Content item markers
    markers.forEach(m => {
      if (!m.position) return;
      bounds.extend(m.position);
      const marker = new gmaps.Marker({ position: m.position, icon: pinIcon, title: m.title });
      marker.addListener('click', () => { infoWindow.setContent(m.htmlContent); infoWindow.open(map, marker); });
      markersRef.current.push(marker);
    });

    // Cluster markers for cleaner display at lower zoom levels
    if (window.MarkerClusterer && markersRef.current.length > 0) {
      clustererRef.current = new window.MarkerClusterer(map, markersRef.current, {
        styles: clusterStyles,
        maxZoom: 15,
        gridSize: 50,
      });
    } else {
      markersRef.current.forEach(m => m.setMap(map));
    }

    // Auto-fit bounds to show all pins
    if (!bounds.isEmpty()) {
      if (markers.length === 1 && routes.length === 0) {
        map.setCenter(markers[0].position);
        map.setZoom(10);
      } else {
        map.fitBounds(bounds, 60);
      }
    }
  }, [markers, routes, mapsReady]);

  if (error) {
    return (
      <div className="aged-card rounded-2xl flex items-center justify-center" style={{ height: '65vh', minHeight: '500px' }}>
        <div className="text-center p-8">
          <p className="text-red-400 text-sm mb-2">⚠️ {error}</p>
          <p className="text-parchment/40 text-xs">Set GOOGLE_MAPS_API_KEY in dashboard settings → environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aged-card rounded-2xl overflow-hidden p-1">
      <div ref={containerRef} style={{ height: '65vh', minHeight: '500px', borderRadius: '14px', background: '#0D0B0A' }} />
      {(loading || !mapsReady) && (
        <div className="flex items-center justify-center pointer-events-none" style={{ height: '65vh', minHeight: '500px', marginTop: '-65vh' }}>
          <div className="w-8 h-8 border-4 border-[rgba(201,145,58,0.2)] border-t-[#C9913A] rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}