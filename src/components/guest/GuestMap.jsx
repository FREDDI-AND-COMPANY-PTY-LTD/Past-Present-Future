import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

export default function GuestMap({ items, onSelect }) {
  const geo = (items || []).filter(
    (i) => i.latitude != null && i.longitude != null && !i.parent_content_item_id
  );
  if (geo.length === 0) {
    return (
      <div className="aged-card rounded-xl p-12 text-center">
        <MapPin size={32} className="text-gold/30 mx-auto mb-3" />
        <p className="text-parchment/50 text-sm">No mapped locations in the archive.</p>
      </div>
    );
  }
  const lats = geo.map((i) => i.latitude);
  const lngs = geo.map((i) => i.longitude);
  const center = [lats.reduce((a, b) => a + b, 0) / lats.length, lngs.reduce((a, b) => a + b, 0) / lngs.length];

  return (
    <div className="aged-card rounded-xl overflow-hidden h-[70vh]">
      <MapContainer center={center} zoom={3} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {geo.map((item) => (
          <CircleMarker key={item.id} center={[item.latitude, item.longitude]} radius={7}
            pathOptions={{ color: '#C9913A', fillColor: '#E8C97A', fillOpacity: 0.7 }}>
            <Popup>
              <div>
                <p className="font-display text-sm text-parchment">{item.title}</p>
                {item.location_name && <p className="text-xs text-parchment/60">{item.location_name}</p>}
                <button onClick={() => onSelect(item)} className="text-xs text-amber-light hover:underline mt-1">View details</button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}