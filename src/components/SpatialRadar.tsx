import React from 'react';
import { Detection, UrgencyLevel } from '../types';
import { Radio, Navigation, AlertOctagon } from 'lucide-react';

interface SpatialRadarProps {
  detections: Detection[];
  urgency: UrgencyLevel;
  onPingSector?: (pan: number, freq: number) => void;
}

export const SpatialRadar: React.FC<SpatialRadarProps> = ({
  detections,
  urgency,
  onPingSector,
}) => {
  // Map detections to radar coordinate blips
  // Center of radar is at bottom-middle (x: 50%, y: 92%) representing the walking user
  const blips = detections.map((det) => {
    const [ymin, xmin, ymax, xmax] = det.box_2d;
    const centerX = (xmin + xmax) / 2; // 0..1000
    const boxHeight = ymax - ymin;
    const boxWidth = xmax - xmin;

    // Estimate relative distance (0 is right in front of user, 100 is furthest horizon)
    // Objects lower in camera frame (high ymax) or large area are closer
    const groundFactor = ymax / 1000;
    const areaFactor = Math.min(1, (boxWidth * boxHeight) / 250000);
    const closeness = Math.max(0.1, Math.min(0.95, groundFactor * 0.7 + areaFactor * 0.3));

    // Calculate angle (-60deg to +60deg)
    // 0 is straight forward, -60 is left, +60 is right
    const angleRad = ((centerX - 500) / 500) * (Math.PI / 3); // -PI/3 to +PI/3
    const distanceNorm = 1 - closeness; // 0 is touching user, 1 is edge of radar

    // Map into radar polar space (radius = 110px)
    const radius = 25 + distanceNorm * 85;
    const radarX = 140 + Math.sin(angleRad) * radius;
    const radarY = 140 - Math.cos(angleRad) * radius;

    // Pan for stereo audio
    const pan = (centerX - 500) / 500;

    return {
      label: det.label,
      confidence: det.confidence,
      x: radarX,
      y: radarY,
      distanceMeters: (1 + distanceNorm * 4.5).toFixed(1),
      pan,
      isDanger: urgency === 'critical' || urgency === 'emergency' || det.label.includes('CAR'),
    };
  });

  // Calculate sector blockage
  const isLeftBlocked = blips.some((b) => b.pan < -0.25 && Number(b.distanceMeters) < 3);
  const isCenterBlocked = blips.some((b) => Math.abs(b.pan) <= 0.25 && Number(b.distanceMeters) < 3.5);
  const isRightBlocked = blips.some((b) => b.pan > 0.25 && Number(b.distanceMeters) < 3);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-col shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            SPATIAL HAZARD RADAR (180° ARC)
          </h3>
        </div>
        <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
          STEREO MAPPED
        </span>
      </div>

      {/* Radar Visualizer Screen */}
      <div className="relative w-[280px] h-[160px] mx-auto bg-slate-950 rounded-t-full border-t-2 border-l-2 border-r-2 border-cyan-500/40 overflow-hidden flex items-end justify-center shadow-inner">
        {/* Radar Rings */}
        <div className="absolute w-[240px] h-[120px] rounded-t-full border-t border-cyan-500/20 border-l border-r pointer-events-none" />
        <div className="absolute w-[160px] h-[80px] rounded-t-full border-t border-cyan-500/30 border-l border-r pointer-events-none" />
        <div className="absolute w-[80px] h-[40px] rounded-t-full border-t border-cyan-500/40 border-l border-r pointer-events-none" />

        {/* Radar Sector Radial Lines */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-cyan-500/20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-cyan-500/15 -rotate-30 origin-bottom pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-cyan-500/15 rotate-30 origin-bottom pointer-events-none" />

        {/* Sweep beam */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140px] h-[140px] bg-gradient-to-tr from-cyan-500/20 to-transparent rounded-full origin-bottom animate-radar-sweep pointer-events-none" />

        {/* Range markers */}
        <span className="absolute bottom-11 right-6 font-mono text-[8px] text-cyan-400/50">1.5m</span>
        <span className="absolute bottom-22 right-3 font-mono text-[8px] text-cyan-400/50">3.0m</span>
        <span className="absolute top-2 right-12 font-mono text-[8px] text-cyan-400/50">5.0m</span>

        {/* Left / Center / Right Label Indicators */}
        <span className="absolute bottom-2 left-4 font-mono text-[9px] text-slate-500 font-bold">LEFT</span>
        <span className="absolute top-2 font-mono text-[9px] text-slate-500 font-bold">FORWARD</span>
        <span className="absolute bottom-2 right-4 font-mono text-[9px] text-slate-500 font-bold">RIGHT</span>

        {/* Detected Obstacle Blips */}
        {blips.map((blip, i) => (
          <div
            key={i}
            onClick={() => onPingSector && onPingSector(blip.pan, blip.isDanger ? 880 : 520)}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            style={{ left: `${blip.x}px`, top: `${blip.y}px` }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                blip.isDanger ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'
              } absolute inset-0 opacity-75`}
            />
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                blip.isDanger ? 'bg-rose-600 border border-white' : 'bg-amber-500 border border-amber-200'
              } relative flex items-center justify-center shadow-lg`}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>

            {/* Hover Tooltip */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-[9px] font-mono px-2 py-1 rounded border border-slate-700 whitespace-nowrap pointer-events-none z-30">
              <span className="font-bold text-cyan-300">{blip.label}</span> ~{blip.distanceMeters}m
            </div>
          </div>
        ))}

        {/* User position anchor (Walker) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_10px_#22d3ee] flex items-center justify-center">
            <Navigation className="w-2.5 h-2.5 text-slate-950 fill-current -rotate-45" />
          </div>
          <span className="font-mono text-[7px] text-cyan-300 tracking-tighter uppercase font-semibold">
            WALKER
          </span>
        </div>
      </div>

      {/* Sector Clearance Readout */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center font-mono text-xs">
        <div
          className={`py-1.5 px-2 rounded border ${
            isLeftBlocked
              ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
          }`}
        >
          <div className="text-[9px] uppercase text-slate-400">Left Path</div>
          <div className="font-bold">{isLeftBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>

        <div
          className={`py-1.5 px-2 rounded border ${
            isCenterBlocked
              ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
          }`}
        >
          <div className="text-[9px] uppercase text-slate-400">Center Path</div>
          <div className="font-bold">{isCenterBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>

        <div
          className={`py-1.5 px-2 rounded border ${
            isRightBlocked
              ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
          }`}
        >
          <div className="text-[9px] uppercase text-slate-400">Right Path</div>
          <div className="font-bold">{isRightBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>
      </div>
    </div>
  );
};
