'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

// Match iot-simulator.ts SENSORS array
const SENSORS = [
  { id: 'sensor-downtown', name: 'Downtown Manhattan', latitude: 40.7128, longitude: -74.006 },
  { id: 'sensor-midtown', name: 'Midtown Manhattan', latitude: 40.7549, longitude: -73.984 },
  { id: 'sensor-uptown', name: 'Upper Manhattan', latitude: 40.7831, longitude: -73.9712 },
  { id: 'sensor-brooklyn', name: 'Brooklyn Heights', latitude: 40.6892, longitude: -73.9904 },
  { id: 'sensor-queens', name: 'Astoria Queens', latitude: 40.7721, longitude: -73.9302 },
];

interface SensorState {
  water_level: number;
  wind_speed: number;
  temperature: number;
  snow_depth: number;
}

const THRESHOLDS = {
  water_level: { threshold: 80, unit: '%', label: 'Water Level', icon: '🌊', eventType: 'FLOOD' },
  wind_speed: { threshold: 95, unit: 'mph', label: 'Wind Speed', icon: '🌪️', eventType: 'TORNADO' },
  temperature: { threshold: 110, unit: '°F', label: 'Temperature', icon: '🔥', eventType: 'WILDFIRE' },
  snow_depth: { threshold: 24, unit: 'in', label: 'Snow Depth', icon: '❄️', eventType: 'SNOW' },
};

export default function SensorSimulator() {
  const [selectedSensorIdx, setSelectedSensorIdx] = useState(0);
  const [values, setValues] = useState<SensorState>({
    water_level: 20,
    wind_speed: 15,
    temperature: 75,
    snow_depth: 2,
  });
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [autoType, setAutoType] = useState<keyof SensorState>('water_level');
  const autoRef = useRef<NodeJS.Timeout | null>(null);
  const autoValueRef = useRef(20);

  const selectedSensor = SENSORS[selectedSensorIdx];

  // Auto-escalation mode
  useEffect(() => {
    if (autoMode) {
      const cfg = THRESHOLDS[autoType];
      autoValueRef.current = values[autoType];

      autoRef.current = setInterval(async () => {
        autoValueRef.current = Math.min(
          cfg.threshold * 1.2,
          autoValueRef.current + (Math.random() * 6 + 2)
        );
        const newValue = parseFloat(autoValueRef.current.toFixed(1));
        setValues((prev) => ({ ...prev, [autoType]: newValue }));
        await sendReading(autoType, newValue);
      }, 3000);
    } else {
      if (autoRef.current) clearInterval(autoRef.current);
    }
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [autoMode, autoType, selectedSensorIdx]);

  const sendReading = async (type: keyof SensorState, value?: number) => {
    const cfg = THRESHOLDS[type];
    const val = value ?? values[type];
    const sensor = SENSORS[selectedSensorIdx];

    setSending(true);
    try {
      const res = await fetch('/api/sensors/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensorId: `sim_${type}_${sensor.id}`,
          latitude: sensor.latitude,
          longitude: sensor.longitude,
          type,
          value: val,
          threshold: cfg.threshold,
        }),
      });
      const data = await res.json();
      setLastResult({ type, value: val, ...data, timestamp: new Date().toISOString() });

      const socket = getSocket();
      socket.emit('sensor:reading', {
        reading: {
          sensorId: `sim_${type}`,
          latitude: sensor.latitude,
          longitude: sensor.longitude,
          type,
          value: val,
          threshold: cfg.threshold,
        },
      });
    } catch (e) {
      console.error('Send failed', e);
    } finally {
      setSending(false);
    }
  };

  const triggerNow = async (type: keyof SensorState) => {
    const cfg = THRESHOLDS[type];
    const triggerValue = cfg.threshold + 5;
    setValues((prev) => ({ ...prev, [type]: triggerValue }));
    await sendReading(type, triggerValue);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span className="text-xl">📡</span> IoT Sensor Simulator
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      </div>

      {/* Sensor location selector */}
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Sensor Location</label>
        <select
          value={selectedSensorIdx}
          onChange={(e) => setSelectedSensorIdx(parseInt(e.target.value))}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SENSORS.map((s, i) => (
            <option key={s.id} value={i}>
              {s.name} ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Auto-triggered events will be created at this sensor&apos;s coordinates.
        </p>
      </div>

      {/* Sensor sliders */}
      <div className="space-y-4">
        {(Object.keys(THRESHOLDS) as (keyof SensorState)[]).map((type) => {
          const cfg = THRESHOLDS[type];
          const val = values[type];
          const exceeded = val >= cfg.threshold;
          const pct = Math.min(100, (val / (cfg.threshold * 1.2)) * 100);

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span>{cfg.icon}</span>
                  <span className="text-sm text-slate-300">{cfg.label}</span>
                  {exceeded && (
                    <span className="text-xs bg-red-900/50 text-red-400 border border-red-700/50 px-1.5 py-0.5 rounded animate-pulse">
                      THRESHOLD EXCEEDED
                    </span>
                  )}
                </div>
                <span className={`text-sm font-bold ${exceeded ? 'text-red-400' : 'text-white'}`}>
                  {val.toFixed(1)} {cfg.unit}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-2 mb-2 relative">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${exceeded ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute top-0 w-0.5 h-2 bg-amber-400 rounded"
                  style={{ left: `${(1 / 1.2) * 100}%`, transform: 'translateX(-50%)' }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={cfg.threshold * 1.3}
                  step={0.5}
                  value={val}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [type]: parseFloat(e.target.value) }))
                  }
                  className="flex-1 accent-blue-500 cursor-pointer"
                />
                <button
                  onClick={() => sendReading(type)}
                  disabled={sending}
                  className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                >
                  Send
                </button>
                <button
                  onClick={() => triggerNow(type)}
                  disabled={sending}
                  className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                  title="Immediately exceed threshold to trigger auto-surge"
                >
                  🚨
                </button>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Threshold: {cfg.threshold} {cfg.unit} → triggers {cfg.eventType} event
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-escalation mode */}
      <div className="border-t border-slate-700/50 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">Auto-Escalation Demo</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>
        {autoMode && (
          <div className="space-y-2">
            <select
              value={autoType}
              onChange={(e) => setAutoType(e.target.value as keyof SensorState)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
            >
              {(Object.keys(THRESHOLDS) as (keyof SensorState)[]).map((t) => (
                <option key={t} value={t}>
                  {THRESHOLDS[t].icon} {THRESHOLDS[t].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-amber-400">
              Values escalating every 3s at {selectedSensor.name}. Will auto-trigger when threshold crossed.
            </p>
          </div>
        )}
      </div>

      {/* Last result */}
      {lastResult && (
        <div
          className={`text-xs rounded-lg p-3 border font-mono ${
            lastResult.autoTriggered
              ? 'bg-red-900/20 border-red-700/50 text-red-300'
              : 'bg-slate-700/50 border-slate-600/50 text-slate-300'
          }`}
        >
          {lastResult.autoTriggered ? (
            <>
              🚨 AUTO-TRIGGERED! Surge event created (ID: {lastResult.surgeEventId?.slice(-6)}
              )<br />
              Volunteers notified: {lastResult.volunteersNotified}
            </>
          ) : (
            <>
              ✓ Reading saved: {lastResult.type} = {lastResult.value} @{' '}
              {new Date(lastResult.timestamp).toLocaleTimeString()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
