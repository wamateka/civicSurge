'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== 0 && lng !== 0) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, address?: string) => void;
}

export default function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      onChange(clickLat, clickLng);
    },
    [onChange]
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery
      )}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const results = await res.json();
      if (results.length > 0) {
        const newLat = parseFloat(results[0].lat);
        const newLng = parseFloat(results[0].lon);
        onChange(newLat, newLng, results[0].display_name);
        setFlyTarget({ lat: newLat, lng: newLng });
        setSearchQuery(results[0].display_name.split(',')[0]);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const hasLocation = lat !== 0 && lng !== 0;

  return (
    <div className="space-y-2">
      {/* Address search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="Search your address..."
          className="flex-1 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-3 py-2.5 rounded-xl transition-colors"
        >
          {searching ? '...' : '🔍'}
        </button>
      </div>

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border border-slate-600/50 relative"
        style={{ height: '260px' }}
      >
        {!hasLocation && (
          <div className="absolute inset-0 flex items-end justify-center pb-3 z-[500] pointer-events-none">
            <div className="bg-slate-900/80 text-slate-300 text-xs px-4 py-2 rounded-full border border-slate-600/50">
              Search or click the map to set your location
            </div>
          </div>
        )}
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />
          <ClickHandler onMapClick={handleMapClick} />
          {flyTarget && <MapFlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          {hasLocation && <Marker position={[lat, lng]} />}
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500">
        {hasLocation
          ? `📍 Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          : 'Your precise location is used for emergency proximity matching'}
      </p>
    </div>
  );
}
