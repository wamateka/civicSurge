'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const epicenterIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #ef4444;
    border: 3px solid white;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.5), 0 0 16px rgba(239,68,68,0.4);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
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
      map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

interface EpicenterMapPickerProps {
  lat: number;
  lng: number;
  radiusKm: number;
  volunteerCount?: number;
  onChange: (lat: number, lng: number, radiusKm: number) => void;
}

export default function EpicenterMapPicker({
  lat,
  lng,
  radiusKm,
  volunteerCount = 0,
  onChange,
}: EpicenterMapPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      onChange(clickLat, clickLng, radiusKm);
    },
    [radiusKm, onChange]
  );

  const handleRadiusChange = useCallback(
    (newRadius: number) => {
      onChange(lat, lng, newRadius);
    },
    [lat, lng, onChange]
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
        onChange(newLat, newLng, radiusKm);
        setFlyTarget({ lat: newLat, lng: newLng });
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const hasLocation = lat !== 0 && lng !== 0;

  return (
    <div className="space-y-3">
      {/* Address search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="Search address or location..."
          className="flex-1 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
        >
          {searching ? '...' : '🔍'}
        </button>
      </div>

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border border-slate-600/50 relative"
        style={{ height: '420px' }}
      >
        {!hasLocation && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 z-[500] pointer-events-none">
            <div className="bg-slate-900/80 text-slate-300 text-xs px-4 py-2 rounded-full border border-slate-600/50">
              Click anywhere on the map to set the epicenter
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
          {hasLocation && (
            <>
              <Marker position={[lat, lng]} icon={epicenterIcon} />
              <Circle
                center={[lat, lng]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.12,
                  weight: 2,
                  dashArray: '6 4',
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Radius slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Radius:{' '}
            <span className="text-white font-bold">{radiusKm} km</span>
          </label>
          {hasLocation && (
            <span className="text-xs text-blue-400 font-semibold">
              ~{volunteerCount} volunteer{volunteerCount !== 1 ? 's' : ''} in range
            </span>
          )}
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={radiusKm}
          onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
          className="w-full accent-red-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-0.5">
          <span>1 km</span>
          <span>25 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Coordinates display */}
      {hasLocation && (
        <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 font-mono flex items-center gap-2">
          <span className="text-red-400">📍</span>
          {lat.toFixed(5)}, {lng.toFixed(5)} · radius {radiusKm} km
        </div>
      )}
    </div>
  );
}
