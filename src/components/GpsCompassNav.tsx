import React, { useState } from 'react';
import {
  Compass,
  Navigation,
  MapPin,
  Target,
  ArrowUp,
  RotateCw,
  LocateFixed,
  Volume2,
  CheckCircle,
} from 'lucide-react';
import { GpsLocation, GpsGuidanceResult, NavigationTarget } from '../utils/gpsNavigation';

interface GpsCompassNavProps {
  gpsLocation: GpsLocation | null;
  target: NavigationTarget;
  guidance: GpsGuidanceResult | null;
  onSetTarget: (target: NavigationTarget) => void;
  onSetRelativeTarget: (metersAhead: number, metersRight: number) => void;
  onSpeakGuidance: () => void;
  isGpsActive: boolean;
  onStartGps: () => void;
}

export const GpsCompassNav: React.FC<GpsCompassNavProps> = ({
  gpsLocation,
  target,
  guidance,
  onSetTarget,
  onSetRelativeTarget,
  onSpeakGuidance,
  isGpsActive,
  onStartGps,
}) => {
  const [customLat, setCustomLat] = useState(target.latitude.toString());
  const [customLon, setCustomLon] = useState(target.longitude.toString());
  const [customName, setCustomName] = useState(target.name);
  const [showConfig, setShowConfig] = useState(false);

  // Quick preset waypoints
  const presets: NavigationTarget[] = [
    { name: 'Metro Station Entrance', latitude: 12.9716, longitude: 77.5946 },
    { name: 'Pharmacy & Clinic', latitude: 12.9725, longitude: 77.596 },
    { name: 'Pedestrian Crossing', latitude: 12.9708, longitude: 77.5935 },
    { name: 'Community Center', latitude: 12.973, longitude: 77.592 },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      onSetTarget({
        name: customName || 'Custom Waypoint',
        latitude: lat,
        longitude: lon,
      });
      setShowConfig(false);
    }
  };

  const angleDiff = guidance?.angleDifferenceDeg || 0;
  const userHeading = guidance?.userHeadingDeg || 0;
  const targetBearing = guidance?.targetBearingDeg || 0;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5 flex-wrap">
              GPS & COMPASS WAYPOINT
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 text-[9px] sm:text-[10px] font-normal">
                Pure Math
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              Zero external APIs • Computes Haversine distance & bearing
            </p>
          </div>
        </div>

        {!isGpsActive ? (
          <button
            onClick={onStartGps}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/30 active:scale-95"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Enable GPS</span>
          </button>
        ) : (
          <div className="self-start sm:self-center flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] sm:text-[11px] font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>GPS LOCKED [±{gpsLocation?.accuracy || 5}m]</span>
          </div>
        )}
      </div>

      {/* Main Guidance Banner (#guidance-output) */}
      <div
        id="guidance-output"
        className={`p-3.5 sm:p-4 rounded-xl border-2 flex items-center justify-between gap-3 sm:gap-4 transition-all shadow-lg ${
          guidance?.isArrived
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            : Math.abs(angleDiff) < 20
            ? 'bg-cyan-950/80 border-cyan-500 text-cyan-100'
            : 'bg-amber-950/80 border-amber-500 text-amber-100'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/10 shrink-0">
            {guidance?.isArrived ? (
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            ) : (
              <div
                className="transition-transform duration-300"
                style={{ transform: `rotate(${angleDiff}deg)` }}
              >
                <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-slate-400">
              VOICE NAVIGATION DIRECTIVE
            </span>
            <span className="text-xs sm:text-base font-bold font-mono tracking-tight leading-snug break-words">
              {guidance?.turnInstruction || 'Calculating GPS waypoint coordinates...'}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-300/80 font-mono mt-0.5 truncate">
              Target: <strong className="text-white">{target.name}</strong> ({guidance?.distanceMeters || '--'}m)
            </span>
          </div>
        </div>

        <button
          onClick={onSpeakGuidance}
          className="p-2.5 sm:p-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white shrink-0 active:scale-95 transition-all"
          title="Repeat spoken guidance"
        >
          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
        </button>
      </div>

      {/* Merged Unified Cockpit: Compass Rose, Telemetry & Waypoint Navigation */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
        {/* Unified Cockpit Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              NAVIGATION COCKPIT & ACTIVE WAYPOINT
            </span>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline font-medium"
          >
            {showConfig ? 'Hide Settings' : 'Edit Coordinates'}
          </button>
        </div>

        {/* Unified Cockpit Body */}
        {showConfig ? (
          <form onSubmit={handleApplyCustom} className="flex flex-col gap-2.5 text-xs font-mono p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold uppercase">Configure Target Waypoint</span>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Waypoint Name"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="Target Latitude"
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white text-[11px] outline-none focus:border-cyan-400"
              />
              <input
                type="number"
                step="any"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                placeholder="Target Longitude"
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white text-[11px] outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Set Waypoint
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Top row: Dial + Orientation Telemetry + Position Readouts */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
              {/* Compass Dial Graphic (4 cols on sm) */}
              <div className="sm:col-span-4 flex flex-col items-center justify-center p-2 bg-slate-900/50 rounded-xl border border-slate-800/80">
                <div className="relative w-26 h-26 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center shrink-0 shadow-inner">
                  {/* Cardinal Marks */}
                  <span className="absolute top-1 text-[9px] font-mono font-bold text-rose-400">N</span>
                  <span className="absolute bottom-1 text-[9px] font-mono text-slate-400">S</span>
                  <span className="absolute left-1.5 text-[9px] font-mono text-slate-400">W</span>
                  <span className="absolute right-1.5 text-[9px] font-mono text-slate-400">E</span>

                  {/* Target Bearing Needle */}
                  <div
                    className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
                    style={{ transform: `rotate(${angleDiff}deg)` }}
                  >
                    <div className="w-1.5 h-11 bg-gradient-to-t from-transparent via-cyan-400 to-cyan-300 rounded-full shadow-[0_0_8px_#22d3ee]" />
                  </div>

                  {/* Center Core */}
                  <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  </div>
                </div>

                <div className="mt-2 text-center">
                  <span className="text-[10px] font-mono text-slate-400 block">STEERING DEFLECTION</span>
                  <strong className={`text-xs font-mono font-bold ${Math.abs(angleDiff) < 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {angleDiff > 0 ? `+${angleDiff}° RIGHT` : `${angleDiff}° LEFT`}
                  </strong>
                </div>
              </div>

              {/* Live Flight Telemetry Metrics (4 cols on sm) */}
              <div className="sm:col-span-4 flex flex-col gap-2 text-xs font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 self-stretch justify-center">
                <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-[10px] text-slate-400 uppercase">HEADING</span>
                  <strong className="text-white text-sm">{userHeading}°</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-[10px] text-slate-400 uppercase">TARGET BEARING</span>
                  <strong className="text-cyan-300 text-sm">{targetBearing}°</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] text-slate-400 uppercase">DISTANCE</span>
                  <strong className="text-emerald-300 text-sm">{guidance?.distanceMeters || '--'} m</strong>
                </div>
              </div>

              {/* Coordinates Info & Active Waypoint (4 cols on sm) */}
              <div className="sm:col-span-4 flex flex-col gap-2 text-[11px] font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 self-stretch justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">TARGET WAYPOINT</span>
                  <strong className="text-cyan-200 text-xs truncate block font-sans font-bold mt-0.5">{target.name}</strong>
                  <span className="text-cyan-400/90 text-[10px] font-mono block mt-0.5">
                    {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">CURRENT GPS FIX</span>
                  <span className="text-slate-300 text-[10px] font-mono block mt-0.5">
                    {gpsLocation ? `${gpsLocation.latitude.toFixed(5)}, ${gpsLocation.longitude.toFixed(5)}` : 'Waiting for GPS fix...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons Bar */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
                QUICK WAYPOINTS:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      onSetTarget(p);
                      setCustomName(p.name);
                      setCustomLat(p.latitude.toString());
                      setCustomLon(p.longitude.toString());
                    }}
                    className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-mono transition-all border ${
                      target.name === p.name
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}

                {gpsLocation && (
                  <button
                    onClick={() => onSetRelativeTarget(50, 0)}
                    className="px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700 hover:bg-emerald-900/80 font-bold sm:ml-auto"
                    title="Set target 50 meters directly ahead of current position"
                  >
                    +50m Ahead
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
