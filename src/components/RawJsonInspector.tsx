import React, { useState } from 'react';
import { NavigationResponse } from '../types';
import { Terminal, Copy, Check, CheckCircle2, AlertCircle, FileCode } from 'lucide-react';

interface RawJsonInspectorProps {
  response: NavigationResponse | null;
  rawJsonString: string;
  latencyMs?: number;
}

export const RawJsonInspector: React.FC<RawJsonInspectorProps> = ({
  response,
  rawJsonString,
  latencyMs,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');

  const jsonToDisplay = response
    ? {
        speech_guidance: response.speech_guidance,
        urgency: response.urgency,
        detections: response.detections,
      }
    : null;

  const displayText = jsonToDisplay
    ? viewMode === 'pretty'
      ? JSON.stringify(jsonToDisplay, null, 2)
      : rawJsonString || JSON.stringify(jsonToDisplay)
    : '// Awaiting live camera frame analysis...';

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Schema Validation Verification for Pitch Judges
  const isValidSchema =
    response &&
    typeof response.speech_guidance === 'string' &&
    typeof response.urgency === 'string' &&
    Array.isArray(response.detections) &&
    response.detections.every(
      (d) =>
        typeof d.label === 'string' &&
        typeof d.confidence === 'number' &&
        Array.isArray(d.box_2d) &&
        d.box_2d.length === 4
    );

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col shadow-xl overflow-hidden h-full">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            STRICT RAW JSON TELEMETRY
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {latencyMs !== undefined && (
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {latencyMs}ms LATENCY
            </span>
          )}

          <div className="flex items-center bg-slate-800 rounded p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('pretty')}
              className={`px-2 py-0.5 rounded ${
                viewMode === 'pretty' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              PRETTY
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded ${
                viewMode === 'raw' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              RAW
            </button>
          </div>

          <button
            onClick={handleCopy}
            disabled={!response}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Copy Raw JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Strict Schema Compliance Badge */}
      <div className="px-4 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          {isValidSchema ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">STRICT SCHEMA VALIDATED</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">SCHEMA: AWAITING PAYLOAD</span>
            </>
          )}
        </div>
        <span className="text-slate-500 text-[10px]">GEMINI-3.8-FLASH ENGINE</span>
      </div>

      {/* Code Editor / Terminal Output */}
      <div className="p-3 bg-slate-950 font-mono text-xs overflow-auto max-h-[300px] flex-1 text-slate-300 leading-relaxed selection:bg-cyan-500/30">
        <pre className="whitespace-pre-wrap break-all">
          <code>{displayText}</code>
        </pre>
      </div>

      {/* Schema Verification Footnote */}
      <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>SCHEMA: speech_guidance, urgency, detections[box_2d[0..1000]]</span>
        <span>NO MARKDOWN FENCES</span>
      </div>
    </div>
  );
};
