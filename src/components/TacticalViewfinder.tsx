import React, { useRef, useEffect } from 'react';
import { Detection, UrgencyLevel } from '../types';
import { Camera, RefreshCw, Eye, AlertTriangle, ShieldCheck, Crosshair, Zap, Cpu, Sparkles } from 'lucide-react';

interface TacticalViewfinderProps {
  imageSrc: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  detections: Detection[];
  urgency: UrgencyLevel;
  isAnalyzing: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  onCaptureFrame: () => void;
  onSwitchCamera: () => void;
  facingMode: 'environment' | 'user';
  onToggleCamera?: () => void;
  isRecording?: boolean;
  engineMode?: 'hybrid' | 'local-yolo' | 'gemini';
  onSelectEngineMode?: (mode: 'hybrid' | 'local-yolo' | 'gemini') => void;
  yoloFps?: number;
  yoloInferenceMs?: number;
  isYoloReady?: boolean;
}

export const TacticalViewfinder: React.FC<TacticalViewfinderProps> = ({
  imageSrc,
  videoRef,
  isCameraActive,
  detections,
  urgency,
  isAnalyzing,
  showGrid,
  onToggleGrid,
  onCaptureFrame,
  onSwitchCamera,
  facingMode,
  onToggleCamera,
  isRecording,
  engineMode = 'hybrid',
  onSelectEngineMode,
  yoloFps = 30,
  yoloInferenceMs = 22,
  isYoloReady = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine border glow color based on urgency
  const urgencyColor = {
    normal: 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    caution: 'border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.35)]',
    warning: 'border-amber-500/90 shadow-[0_0_25px_rgba(245,158,11,0.4)]',
    critical: 'border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.5)]',
    emergency: 'border-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.6)] animate-pulse',
  }[urgency] || 'border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)]';

  const badgeBg = {
    normal: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    caution: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    critical: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
    emergency: 'bg-rose-600/30 text-rose-200 border-rose-600/60',
  }[urgency];

  return (
    <div className="relative w-full rounded-2xl bg-slate-950 border border-slate-800/80 overflow-hidden flex flex-col shadow-2xl">
      {/* Tactical Top Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-400' : 'bg-cyan-400'} animate-ping absolute`} />
            <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-500' : 'bg-cyan-500'} relative`} />
          </div>
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-300 uppercase">
            {isCameraActive ? `LIVE SENSOR [${facingMode.toUpperCase()}]` : 'TACTICAL FRAME INSPECTOR'}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-medium ${badgeBg}`}>
            {urgency} STATUS
          </span>

          {isCameraActive && engineMode !== 'gemini' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold">
              <Zap className="w-3 h-3 text-emerald-400" />
              YOLO-NANO: {yoloFps} FPS ({yoloInferenceMs}ms)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleGrid}
            className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors border ${
              showGrid
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle 1000-Point Normalized Grid"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1000pt Grid</span>
          </button>

          {isCameraActive && (
            <button
              onClick={onSwitchCamera}
              className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Switch Front/Rear Camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all border ${
                isCameraActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-sm'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCameraActive ? 'Camera ON' : 'Turn On Cam'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewport Frame */}
      <div
        ref={containerRef}
        className={`relative aspect-[4/3] w-full bg-black overflow-hidden border-2 transition-all duration-300 ${urgencyColor}`}
      >
        {/* Recording Overlay Indicator */}
        {isRecording && (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/80 border border-rose-500 text-rose-300 text-xs font-mono font-bold shadow-lg animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>● REC LIVE</span>
          </div>
        )}

        {/* Live Real-World Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Live Real-World Stream Watermark / HUD Badge */}
        {isCameraActive && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/80 border border-emerald-500/70 text-emerald-300 text-[11px] font-mono font-bold shadow-lg backdrop-blur-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>REAL-WORLD LIVE DETECTOR</span>
          </div>
        )}

        {/* If camera is not yet active, show dedicated Live Camera Detector Activator */}
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border-2 border-cyan-400/60 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-pulse">
              <Camera className="w-8 h-8 text-cyan-300" />
            </div>

            <h4 className="font-mono text-base font-extrabold text-slate-100 uppercase tracking-wide">
              REAL-WORLD LIVE CAMERA DETECTOR
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
              Looks at the physical environment through your camera to detect immediate obstacles, compute spatial paths, and navigate blind users safely.
            </p>

            {onToggleCamera && (
              <button
                onClick={onToggleCamera}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-mono text-sm font-extrabold flex items-center gap-2.5 shadow-xl shadow-cyan-900/50 transition-all active:scale-95 border border-cyan-300"
              >
                <Camera className="w-5 h-5" />
                <span>START LIVE CAMERA NOW</span>
              </button>
            )}

            {imageSrc && (
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                Custom test frame loaded • Turn on camera for continuous live detection
              </div>
            )}
          </div>
        )}

        {/* 1000-Point Normalized Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* 3x3 Tactical Sector Division */}
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-cyan-500/20">
              <div className="border-r border-b border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50">TOP-LEFT</div>
              <div className="border-r border-b border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50 text-center">TOP-CENTER</div>
              <div className="border-b border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50 text-right">TOP-RIGHT</div>

              <div className="border-r border-b border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50">MID-LEFT</div>
              <div className="border-r border-b border-cyan-500/20 p-1 flex items-center justify-center font-mono text-[9px] text-cyan-500/30">
                <Crosshair className="w-8 h-8 text-cyan-400/30" />
              </div>
              <div className="border-b border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50 text-right">MID-RIGHT</div>

              <div className="border-r border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50">GROUND-LEFT</div>
              <div className="border-r border-cyan-500/20 p-1 font-mono text-[9px] text-cyan-500/50 text-center">GROUND-PATH</div>
              <div className="p-1 font-mono text-[9px] text-cyan-500/50 text-right">GROUND-RIGHT</div>
            </div>

            {/* Grid coordinate markers on axis */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 font-mono text-[8px] text-cyan-400/60 bg-black/60 px-1 rounded">
              Y: 500
            </div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[8px] text-cyan-400/60 bg-black/60 px-1 rounded">
              X: 500
            </div>
          </div>
        )}

        {/* Real-time Detections Bounding Boxes (Normalized [ymin, xmin, ymax, xmax]) */}
        {detections.map((detection, idx) => {
          const [ymin, xmin, ymax, xmax] = detection.box_2d;

          // Convert 0..1000 coordinates to percentages
          const top = Math.max(0, Math.min(100, (ymin / 1000) * 100));
          const left = Math.max(0, Math.min(100, (xmin / 1000) * 100));
          const width = Math.max(2, Math.min(100, ((xmax - xmin) / 1000) * 100));
          const height = Math.max(2, Math.min(100, ((ymax - ymin) / 1000) * 100));

          // Heuristic hazard tier based on label and location
          const isCritical =
            urgency === 'critical' ||
            urgency === 'emergency' ||
            ['CAR', 'VEHICLE', 'TRUCK', 'BUS', 'STAIRS', 'STAIRCASE', 'DROP', 'HOLE'].some((k) =>
              detection.label.includes(k)
            );

          const boxTheme = isCritical
            ? {
                border: 'border-rose-500 bg-rose-500/15 text-rose-300',
                badge: 'bg-rose-950/90 text-rose-200 border-rose-500',
                corner: 'border-rose-400',
                glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
              }
            : {
                border: 'border-amber-400 bg-amber-400/10 text-amber-200',
                badge: 'bg-amber-950/90 text-amber-200 border-amber-400',
                corner: 'border-amber-300',
                glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
              };

          return (
            <div
              key={`${detection.label}-${idx}`}
              className={`absolute transition-all duration-200 border-2 rounded-sm ${boxTheme.border} ${boxTheme.glow} pointer-events-none z-20`}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              {/* Tactical Corner Brackets */}
              <span className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${boxTheme.corner}`} />
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${boxTheme.corner}`} />
              <span className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${boxTheme.corner}`} />
              <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${boxTheme.corner}`} />

              {/* Tag Header */}
              <div
                className={`absolute -top-6 left-0 px-2 py-0.5 rounded border text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 shadow-md whitespace-nowrap ${boxTheme.badge}`}
              >
                <span>{detection.label}</span>
                <span className="opacity-75 font-normal">{detection.confidence}%</span>
              </div>

              {/* Coordinate Footer Readout */}
              <div className="absolute -bottom-5 right-0 px-1.5 py-0.2 rounded bg-black/80 text-[8px] font-mono text-cyan-300/80 border border-cyan-500/30 whitespace-nowrap">
                [{ymin},{xmin},{ymax},{xmax}]
              </div>
            </div>
          );
        })}

        {/* Scanning sweep line during analysis */}
        {isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scanline" />
            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/80 border border-cyan-500/50 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="font-mono text-xs text-cyan-300">SPATIAL REASONING...</span>
            </div>
          </div>
        )}

        {/* Assistive Path Clear Indicator overlay when no hazards */}
        {detections.length === 0 && !isAnalyzing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 shadow-lg backdrop-blur-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-semibold text-emerald-200 uppercase tracking-wide">
              CLEAR NAVIGATION VECTOR DETECTED
            </span>
          </div>
        )}

        {/* HUD Crosshairs in corner */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/30 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/30 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/30 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/30 pointer-events-none" />
      </div>

      {/* Quick Status Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            TARGETS: <strong className="text-slate-100">{detections.length}</strong>
          </span>
          <span className="hidden sm:inline">
            GRID: <strong className="text-cyan-400">1000 x 1000</strong>
          </span>

          {/* Engine Selector */}
          {onSelectEngineMode && (
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
              <button
                onClick={() => onSelectEngineMode('hybrid')}
                className={`px-2 py-0.5 rounded transition-all ${
                  engineMode === 'hybrid'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Local YOLO 30-FPS Tracking + Gemini Spatial Reasoning"
              >
                Hybrid (YOLO+Gemini)
              </button>
              <button
                onClick={() => onSelectEngineMode('local-yolo')}
                className={`px-2 py-0.5 rounded transition-all ${
                  engineMode === 'local-yolo'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="100% Local Browser YOLO 30-FPS Detection"
              >
                Local YOLO (30 FPS)
              </button>
              <button
                onClick={() => onSelectEngineMode('gemini')}
                className={`px-2 py-0.5 rounded transition-all ${
                  engineMode === 'gemini'
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Cloud Gemini 3.8 Flash Spatial Reasoning"
              >
                Gemini Cloud
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onCaptureFrame}
          disabled={isAnalyzing}
          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-900/30"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Scan Frame</span>
        </button>
      </div>
    </div>
  );
};
