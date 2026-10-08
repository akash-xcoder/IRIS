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
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-black animate-pulse" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
            SPATIAL HAZARD RADAR (180° ARC)
          </h3>
        </div>
        <span className="font-mono text-[10px] text-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold">
          STEREO MAPPED
        </span>
      </div>

      {/* Radar Visualizer Screen */}
      <div className="relative w-[280px] h-[160px] mx-auto bg-white rounded-t-full border-t-2 border-l-2 border-r-2 border-slate-300 overflow-hidden flex items-end justify-center shadow-inner">
        {/* Radar Rings */}
        <div className="absolute w-[240px] h-[120px] rounded-t-full border-t border-slate-300/70 border-l border-r pointer-events-none" />
        <div className="absolute w-[160px] h-[80px] rounded-t-full border-t border-slate-300/70 border-l border-r pointer-events-none" />
        <div className="absolute w-[80px] h-[40px] rounded-t-full border-t border-slate-300/70 border-l border-r pointer-events-none" />

        {/* Radar Sector Radial Lines */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-slate-300/60 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-slate-300/40 -rotate-30 origin-bottom pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[160px] bg-slate-300/40 rotate-30 origin-bottom pointer-events-none" />

        {/* Sweep beam */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140px] h-[140px] bg-gradient-to-tr from-black/10 to-transparent rounded-full origin-bottom animate-radar-sweep pointer-events-none" />

        {/* Range markers */}
        <span className="absolute bottom-11 right-6 font-mono text-[8px] text-slate-500 font-semibold">1.5m</span>
        <span className="absolute bottom-22 right-3 font-mono text-[8px] text-slate-500 font-semibold">3.0m</span>
        <span className="absolute top-2 right-12 font-mono text-[8px] text-slate-500 font-semibold">5.0m</span>

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
                blip.isDanger ? 'bg-black animate-ping' : 'bg-slate-700 animate-pulse'
              } absolute inset-0 opacity-75`}
            />
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                blip.isDanger ? 'bg-black border border-white' : 'bg-slate-800 border border-white'
              } relative flex items-center justify-center shadow-xs`}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>

            {/* Hover Tooltip */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[9px] font-mono px-2 py-1 rounded shadow-md border border-neutral-700 whitespace-nowrap pointer-events-none z-30">
              <span className="font-bold text-white">{blip.label}</span> ~{blip.distanceMeters}m
            </div>
          </div>
        ))}

        {/* User position anchor (Walker) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="w-4 h-4 rounded-full bg-black border-2 border-white shadow-xs flex items-center justify-center">
            <Navigation className="w-2.5 h-2.5 text-white fill-current -rotate-45" />
          </div>
          <span className="font-mono text-[7px] text-slate-700 tracking-tighter uppercase font-bold">
            WALKER
          </span>
        </div>
      </div>

      {/* Sector Clearance Readout */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center font-mono text-xs">
        <div
          className={`py-1.5 px-2 rounded border ${
            isLeftBlocked
              ? 'bg-black text-white border-black font-bold'
              : 'bg-white text-black border-slate-200'
          }`}
        >
          <div className={`text-[9px] uppercase font-semibold ${isLeftBlocked ? 'text-slate-300' : 'text-slate-500'}`}>Left Path</div>
          <div>{isLeftBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>

        <div
          className={`py-1.5 px-2 rounded border ${
            isCenterBlocked
              ? 'bg-black text-white border-black font-bold'
              : 'bg-white text-black border-slate-200'
          }`}
        >
          <div className={`text-[9px] uppercase font-semibold ${isCenterBlocked ? 'text-slate-300' : 'text-slate-500'}`}>Center Path</div>
          <div>{isCenterBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>

        <div
          className={`py-1.5 px-2 rounded border ${
            isRightBlocked
              ? 'bg-black text-white border-black font-bold'
              : 'bg-white text-black border-slate-200'
          }`}
        >
          <div className={`text-[9px] uppercase font-semibold ${isRightBlocked ? 'text-slate-300' : 'text-slate-500'}`}>Right Path</div>
          <div>{isRightBlocked ? 'BLOCKED' : 'CLEAR'}</div>
        </div>
      </div>
    </div>
  );
};
