import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const routeColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C'];

// Light, high-contrast styling readable outdoors in bright sunlight,
// while keeping warm gold accents consistent with the archive theme.
const outdoorMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#F5EFE2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5A4A30' }] },
  { elementType: 'labels.text', stylers: [{ weight: 0.5 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8B6914' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#8B6914' }], stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#C9913A', weight: 1.5 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#D4C4A0', weight: 1 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7A6A4A' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D8E8C8' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5A7A3A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F0E8D4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8C97A' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#C9913A', weight: 1 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#5A4A30' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#E8E0CC' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#A8C8D8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3A5A7A' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#EDE4CE' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#DDE8C8' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#E8E0CC' }] },
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

// Numbered pin for migration waypoints — shows sequence order
function numberedPinSvg(number, color) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">' +
    '<path d="M17 0C7.61 0 0 7.61 0 17c0 13 17 27 17 27s17-14 17-27C34 7.61 26.39 0 17 0z" ' +
    `fill="${color}" stroke="#0D0B0A" stroke-width="2"/>` +
    '<circle cx="17" cy="17" r="9" fill="#E8C97A"/>' +
    `<text x="17" y="21" text-anchor="middle" fill="#0D0B0A" font-size="13" font-weight="bold" font-family="Arial,sans-serif">${number}</text>` +
    '</svg>';
  return 'data:image/svg+xml;utf-8,' + encodeURIComponent(svg);
}

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
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const clusterStyles = [
  { url: clusterIconSvg(40, '#C9913A'), height: 40, width: 40, textColor: '#0D0B0A', textSize: 13, textDecoration: 'none' },
  { url: clusterIconSvg(50, '#D4A04C'), height: 50, width: 50, textColor: '#0D0B0A', textSize: 14, textDecoration: 'none' },
  { url: clusterIconSvg(60, '#E8C97A'), height: 60, width: 60, textColor: '#0D0B0A', textSize: 15, textDecoration: 'none' },
];

export default function GoogleMap({ markers = [], routes = [], loading = false, activeWaypoint, onWaypointSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const gmapsRef = useRef(null);
  const markersRef = useRef([]);
  const waypointMarkersRef = useRef([]);   // numbered waypoint markers (never clustered)
  const polylinesRef = useRef([]);
  const clustererRef = useRef(null);
  const userMarkerRef = useRef(null);
  const activeInfoWindowRef = useRef(null);
  const [error, setError] = useState(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [userCenter, setUserCenter] = useState(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const initialViewSetRef = useRef(false);

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
          styles: outdoorMapStyles,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          draggable: true,
          gestureHandling: 'greedy',
        });
        try {
          await loadMarkerClusterer();
        } catch (e) { /* clustering optional */ }
        setMapsReady(true);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setUserCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setGeoResolved(true);
            },
            () => { setGeoResolved(true); },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        } else {
          setGeoResolved(true);
        }
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
    waypointMarkersRef.current.forEach(w => w.marker.setMap(null));
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current = [];
    waypointMarkersRef.current = [];
    polylinesRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    if (activeInfoWindowRef.current) {
      activeInfoWindowRef.current.close();
      activeInfoWindowRef.current = null;
    }

    const bounds = new gmaps.LatLngBounds();
    const infoWindow = new gmaps.InfoWindow();
    activeInfoWindowRef.current = infoWindow;
    const pinIcon = {
      url: `data:image/svg+xml;utf-8,${goldPinSvg}`,
      scaledSize: new gmaps.Size(28, 36),
      anchor: new gmaps.Point(14, 36),
    };

    // Draw migration routes + numbered waypoint markers
    const flatWaypoints = [];
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
        const wpIdx = flatWaypoints.length;
        const pos = { lat: wp.lat, lng: wp.lng };
        bounds.extend(pos);
        const num = wpIdx + 1;
        const html = `<div style="min-width:200px;padding:4px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#C9913A;color:#0D0B0A;font-size:11px;font-weight:bold;border:2px solid #E8C97A">${num}</span>
            <p style="color:#C9913A;font-weight:600;font-size:14px;margin:0">${wp.label || 'Waypoint'}</p>
          </div>
          ${wp.date ? `<p style="color:#F5ECD7;font-size:12px;opacity:0.7;margin:0">${wp.date}</p>` : ''}
          ${wp.description ? `<p style="color:#F5ECD7;font-size:12px;opacity:0.6;margin:4px 0 0">${wp.description}</p>` : ''}
          <p style="color:#C9913A;font-size:11px;opacity:0.5;margin:6px 0 0">${route.name}</p>
        </div>`;
        const marker = new gmaps.Marker({
          position: pos,
          icon: {
            url: numberedPinSvg(num, color),
            scaledSize: new gmaps.Size(34, 44),
            anchor: new gmaps.Point(17, 44),
          },
          title: wp.label || `Waypoint ${num}`,
          map,
          zIndex: 1000 + wpIdx,
        });
        marker.addListener('click', () => {
          infoWindow.setContent(html);
          infoWindow.open(map, marker);
          if (onWaypointSelect) onWaypointSelect(wpIdx);
        });
        waypointMarkersRef.current.push({ marker, infoHtml: html, lat: wp.lat, lng: wp.lng, label: wp.label, date: wp.date, description: wp.description, routeName: route.name });
        flatWaypoints.push({ lat: wp.lat, lng: wp.lng, label: wp.label, date: wp.date, description: wp.description, routeName: route.name });
      });
    });

    // Content item markers
    // Residence pin — warm-amber home-shaped marker, distinct from the gold event pins
    const residencePinSvg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">' +
      '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" ' +
      'fill="#8B6914" stroke="#0D0B0A" stroke-width="2"/>' +
      '<path d="M7 17 L14 10 L21 17 L21 22 L7 22 Z" fill="#E8C97A" stroke="#0D0B0A" stroke-width="1"/>' +
      '</svg>'
    );
    const residencePinIcon = {
      url: `data:image/svg+xml;utf-8,${residencePinSvg}`,
      scaledSize: new gmaps.Size(28, 36),
      anchor: new gmaps.Point(14, 36),
    };

    markers.forEach(m => {
      if (!m.position) return;
      bounds.extend(m.position);
      const icon = m.icon === 'residence' ? residencePinIcon : pinIcon;
      const marker = new gmaps.Marker({ position: m.position, icon, title: m.title });
      marker.addListener('click', () => { infoWindow.setContent(m.htmlContent); infoWindow.open(map, marker); });
      markersRef.current.push(marker);
    });

    // Cluster content item markers for cleaner display at lower zoom levels
    // (waypoint markers are always visible — they're already on the map)
    if (window.MarkerClusterer && markersRef.current.length > 0) {
      clustererRef.current = new window.MarkerClusterer(map, markersRef.current, {
        styles: clusterStyles,
        maxZoom: 15,
        gridSize: 50,
      });
    } else {
      markersRef.current.forEach(m => m.setMap(map));
    }

    if (!initialViewSetRef.current && geoResolved) {
      if (userCenter) {
        map.setCenter(userCenter);
        map.setZoom(6);
        initialViewSetRef.current = true;
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 60);
        initialViewSetRef.current = true;
      }
    }
  }, [markers, routes, mapsReady, userCenter, geoResolved]);

  // Fly to active waypoint when it changes (from timeline panel)
  useEffect(() => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map || !mapsReady || activeWaypoint == null) return;
    const wp = waypointMarkersRef.current[activeWaypoint];
    if (!wp) return;
    map.panTo({ lat: wp.lat, lng: wp.lng });
    map.setZoom(7);
    if (activeInfoWindowRef.current) {
      activeInfoWindowRef.current.setContent(wp.infoHtml);
      activeInfoWindowRef.current.open(map, wp.marker);
    }
  }, [activeWaypoint, mapsReady]);

  // Drop a "you are here" marker at the user's current location
  useEffect(() => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map || !mapsReady || !userCenter) return;
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    const blueDotSvg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#FFFFFF" stroke-width="3" opacity="0.9"/>' +
      '<circle cx="12" cy="12" r="4" fill="#1D4ED8"/></svg>'
    );
    userMarkerRef.current = new gmaps.Marker({
      position: userCenter,
      map,
      icon: {
        url: `data:image/svg+xml;utf8,${blueDotSvg}`,
        scaledSize: new gmaps.Size(24, 24),
        anchor: new gmaps.Point(12, 12),
      },
      title: 'You are here',
      zIndex: 9999,
    });
  }, [userCenter, mapsReady]);

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