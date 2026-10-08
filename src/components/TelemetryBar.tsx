import React from 'react';
import { UrgencyLevel } from '../types';
import { Activity, Cpu, Clock, Zap, Play, Square, Sliders } from 'lucide-react';

interface TelemetryBarProps {
  latencyMs: number | null;
  urgency: UrgencyLevel;
  detectionCount: number;
  isAutoScanning: boolean;
  autoScanInterval: number; // in seconds
  onToggleAutoScan: () => void;
  onChangeInterval: (val: number) => void;
  isAnalyzing: boolean;
  totalFramesAnalyzed: number;
  engineMode?: 'hybrid' | 'local-yolo' | 'gemini';
  yoloFps?: number;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  latencyMs,
  urgency,
  detectionCount,
  isAutoScanning,
  autoScanInterval,
  onToggleAutoScan,
  onChangeInterval,
  isAnalyzing,
  totalFramesAnalyzed,
  engineMode = 'hybrid',
  yoloFps = 30,
}) => {
  const modelLabel =
    engineMode === 'hybrid'
      ? `Hybrid (YOLO ${yoloFps}FPS + Gemini)`
      : engineMode === 'local-yolo'
      ? `Local YOLO Nano (${yoloFps} FPS)`
      : 'Gemini 3.8 Flash (Cloud)';

  return (
    <div className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      {/* Metrics Row */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Model Spec */}
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">ACTIVE DETECTOR ENGINE</div>
            <div className="font-bold text-slate-200">{modelLabel}</div>
          </div>
        </div>

        {/* Latency */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">INFERENCE LATENCY</div>
            <div className="font-bold text-cyan-300">
              {latencyMs !== null ? `${latencyMs} ms` : '-- ms'}
            </div>
          </div>
        </div>

        {/* Total Frames Analyzed */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">FRAMES ANALYZED</div>
            <div className="font-bold text-slate-200">{totalFramesAnalyzed}</div>
          </div>
        </div>

        {/* Active Targets */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">OBSTACLES IDENTIFIED</div>
            <div className="font-bold text-amber-300">{detectionCount}</div>
          </div>
        </div>
      </div>

      {/* Auto-Scan Controls for Hands-Free Navigation */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400">RATE:</span>
          <select
            value={autoScanInterval}
            onChange={(e) => onChangeInterval(Number(e.target.value))}
            disabled={isAutoScanning}
            className="bg-transparent text-cyan-400 text-xs font-mono outline-none cursor-pointer"
          >
            <option value={2} className="bg-slate-900">2s Interval</option>
            <option value={3} className="bg-slate-900">3s Interval</option>
            <option value={4} className="bg-slate-900">4s Interval</option>
          </select>
        </div>

        <button
          onClick={onToggleAutoScan}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold transition-all border ${
            isAutoScanning
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 hover:bg-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
              : 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/30'
          }`}
        >
          {isAutoScanning ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP LOOP</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>HANDS-FREE LOOP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
