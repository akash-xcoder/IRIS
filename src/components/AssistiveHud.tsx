import React from 'react';
import { NavigationResponse, UrgencyLevel } from '../types';
import { Volume2, VolumeX, ShieldAlert, CheckCircle, AlertTriangle, Play, RotateCcw, Sparkles } from 'lucide-react';

interface AssistiveHudProps {
  response: NavigationResponse | null;
  isAnalyzing: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onRepeatSpeech: () => void;
  onTriggerScan: () => void;
}

export const AssistiveHud: React.FC<AssistiveHudProps> = ({
  response,
  isAnalyzing,
  isMuted,
  onToggleMute,
  onRepeatSpeech,
  onTriggerScan,
}) => {
  const urgency: UrgencyLevel = response?.urgency || 'normal';
  const guidanceText =
    response?.speech_guidance ||
    'Camera active. Tap anywhere on screen or hold steady to scan your path.';

  const isHazard = urgency === 'critical' || urgency === 'emergency';
  const isCaution = urgency === 'caution' || urgency === 'warning';

  const theme = isHazard
    ? {
        bg: 'bg-rose-950/95 border-rose-500',
        badgeBg: 'bg-rose-600 text-white',
        text: 'text-rose-100',
        heading: 'text-rose-400',
        icon: <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 animate-bounce" />,
        status: 'CRITICAL HAZARD STOP',
        pulse: 'ring-2 ring-rose-500/50',
      }
    : isCaution
    ? {
        bg: 'bg-amber-950/90 border-amber-500',
        badgeBg: 'bg-amber-500 text-black',
        text: 'text-amber-100',
        heading: 'text-amber-400',
        icon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />,
        status: 'CAUTION - OBSTACLE AHEAD',
        pulse: 'ring-1 ring-amber-500/40',
      }
    : {
        bg: 'bg-slate-900/90 border-emerald-500/80',
        badgeBg: 'bg-emerald-500 text-black',
        text: 'text-emerald-100',
        heading: 'text-emerald-400',
        icon: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />,
        status: 'PATH CLEAR - SAFE TO WALK',
        pulse: 'ring-1 ring-emerald-500/30',
      };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* High-Contrast Primary Assistive Panel */}
      <div
        onClick={onTriggerScan}
        role="button"
        tabIndex={0}
        aria-label="Assistive Navigation Audio Guidance. Press or tap to re-scan scene."
        className={`relative w-full rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all duration-300 shadow-xl cursor-pointer select-none ${theme.bg} ${theme.pulse}`}
      >
        {/* Screen Reader Live Region */}
        <div aria-live="assertive" className="sr-only">
          {guidanceText}. Urgency level: {urgency}.
        </div>

        {/* Top Status Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0">{theme.icon}</div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400">
                STATUS
              </div>
              <div className={`font-mono text-xs sm:text-sm font-extrabold uppercase truncate ${theme.heading}`}>
                {theme.status}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onRepeatSpeech}
              className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all border border-white/20"
              title="Repeat Spoken Guidance"
            >
              <Volume2 className="w-4 h-4 text-cyan-300" />
            </button>

            <button
              onClick={onToggleMute}
              className={`p-1.5 sm:p-2 rounded-lg transition-all border ${
                isMuted
                  ? 'bg-rose-900/50 border-rose-500 text-rose-300'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
              title={isMuted ? 'Unmute Audio Guidance' : 'Mute Audio Guidance'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Crisp Spoken Instruction Readout */}
        <div className="py-0.5 sm:py-1">
          <p
            className={`text-sm sm:text-lg font-bold tracking-tight leading-snug ${theme.text}`}
          >
            "{guidanceText}"
          </p>
        </div>

        {/* Bottom Banner */}
        <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-cyan-300 font-medium">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>TAP SCREEN TO RE-SCAN</span>
          </span>

          {isAnalyzing && (
            <span className="text-amber-300 animate-pulse font-bold">
              SCANNING...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
