import React from 'react';
import { PresetScenario } from '../types';
import { Layers, Upload, Camera, AlertCircle } from 'lucide-react';

interface ScenarioSelectorProps {
  scenarios: PresetScenario[];
  activeScenarioId: string | null;
  onSelectScenario: (scenario: PresetScenario) => void;
  onUploadCustomImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUseLiveCamera: () => void;
  isCameraActive: boolean;
  isAnalyzing: boolean;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onUploadCustomImage,
  onUseLiveCamera,
  isCameraActive,
  isAnalyzing,
}) => {
  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-col shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            TEST SCENARIOS & FEED INPUTS
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Camera Button */}
          <button
            onClick={onUseLiveCamera}
            disabled={isAnalyzing}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all border ${
              isCameraActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCameraActive ? 'Camera Live' : 'Use Camera'}</span>
          </button>

          {/* Upload Custom Test Image */}
          <label className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUploadCustomImage}
              disabled={isAnalyzing}
            />
          </label>
        </div>
      </div>

      {/* Preset Scenario Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {scenarios.map((scenario) => {
          const isSelected = !isCameraActive && activeScenarioId === scenario.id;

          const badgeColor = {
            critical: 'text-rose-400 border-rose-800 bg-rose-950/60',
            caution: 'text-amber-400 border-amber-800 bg-amber-950/60',
            normal: 'text-emerald-400 border-emerald-800 bg-emerald-950/60',
            warning: 'text-amber-400 border-amber-800 bg-amber-950/60',
            emergency: 'text-rose-400 border-rose-800 bg-rose-950/60',
          }[scenario.expectedUrgency];

          return (
            <button
              key={scenario.id}
              onClick={() => onSelectScenario(scenario)}
              disabled={isAnalyzing}
              className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                isSelected
                  ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-semibold ${badgeColor}`}
                >
                  {scenario.expectedUrgency}
                </span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">{scenario.category}</span>
              </div>

              <div className="font-semibold text-xs text-slate-200 line-clamp-1 group-hover:text-cyan-300 transition-colors">
                {scenario.title}
              </div>

              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {scenario.description}
              </p>

              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
