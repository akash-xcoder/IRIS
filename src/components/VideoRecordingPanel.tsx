import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Play,
  Square,
  Download,
  RotateCcw,
  Sparkles,
  Camera,
  Film,
  Clock,
  Eye,
  Trash2,
} from 'lucide-react';

interface VideoRecordingPanelProps {
  mediaStream: MediaStream | null;
  isCameraActive: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onAnalyzeFrameFromVideo: (imageDataUrl: string) => void;
  isAnalyzing: boolean;
}

export const VideoRecordingPanel: React.FC<VideoRecordingPanelProps> = ({
  mediaStream,
  isCameraActive,
  onStartCamera,
  onStopCamera,
  onAnalyzeFrameFromVideo,
  isAnalyzing,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAutoScanningVideo, setIsAutoScanningVideo] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Timer loop for recording
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Start recording from the active camera stream
  const startRecording = () => {
    if (!mediaStream) {
      onStartCamera();
      return;
    }

    try {
      chunksRef.current = [];
      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4',
      };

      const recorder = new MediaRecorder(mediaStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedVideoUrl(url);
      };

      recorder.start(500); // 500ms chunk timeslice
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearRecordedVideo = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setRecordedBlob(null);
    setIsAutoScanningVideo(false);
  };

  const downloadRecording = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `aegisvision-session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Extract current playback frame from recorded video and analyze
  const captureAndAnalyzePlaybackFrame = () => {
    const video = playbackVideoRef.current;
    if (!video) return;

    if (!playbackCanvasRef.current) {
      playbackCanvasRef.current = document.createElement('canvas');
    }
    const canvas = playbackCanvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 640, 480);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onAnalyzeFrameFromVideo(dataUrl);
  };

  // Auto scan recorded video every 2 seconds during playback
  useEffect(() => {
    let scanTimer: any = null;
    if (isAutoScanningVideo && recordedVideoUrl && isVideoPlaying) {
      scanTimer = setInterval(() => {
        if (!isAnalyzing) {
          captureAndAnalyzePlaybackFrame();
        }
      }, 2000);
    }
    return () => {
      if (scanTimer) clearInterval(scanTimer);
    };
  }, [isAutoScanningVideo, recordedVideoUrl, isVideoPlaying, isAnalyzing]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col shadow-xl gap-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              LIVE CAMERA VIDEO CAPTURING & RECORDING PANEL
              {isRecording && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 text-[10px] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> REC {formatTime(recordingDuration)}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Record live walk sessions, review footage, and analyze spatial hazards frame-by-frame
            </p>
          </div>
        </div>

        {/* Camera Power Toggle */}
        <div className="flex items-center gap-2">
          {isCameraActive ? (
            <button
              onClick={onStopCamera}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-600/80 text-rose-300 text-xs font-mono font-medium transition-all"
            >
              Turn Off Camera
            </button>
          ) : (
            <button
              onClick={onStartCamera}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-cyan-900/30 flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Enable Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video Recording Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Active Stream Recording Station */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 uppercase">CAMERA FEED RECORDER</span>
            <span className={`px-2 py-0.5 rounded text-[10px] ${isCameraActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
              {isCameraActive ? 'SENSOR READY' : 'CAMERA STANDBY'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={!isCameraActive}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-mono font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/40"
              >
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                <span>START RECORDING SESSION</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-rose-500 text-rose-300 font-mono font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg animate-pulse"
              >
                <Square className="w-4 h-4 fill-current text-rose-400" />
                <span>STOP RECORDING [{formatTime(recordingDuration)}]</span>
              </button>
            )}

            <p className="text-[10px] text-slate-400 text-center font-mono">
              Captures live video buffer using HTML5 MediaRecorder API (WebM/MP4)
            </p>
          </div>
        </div>

        {/* Right: Recorded Clip Playback & Extraction */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 uppercase">RECORDED FOOTAGE INSPECTOR</span>
            {recordedBlob && (
              <span className="text-cyan-400 text-[10px]">
                {(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          {recordedVideoUrl ? (
            <div className="flex flex-col gap-2.5">
              {/* Video Playback element */}
              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-700 bg-black">
                <video
                  ref={playbackVideoRef}
                  src={recordedVideoUrl}
                  controls
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Actions on Recorded Video */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={captureAndAnalyzePlaybackFrame}
                  disabled={isAnalyzing}
                  className="px-2 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Analyze Frame</span>
                </button>

                <button
                  onClick={() => setIsAutoScanningVideo(!isAutoScanningVideo)}
                  className={`px-2 py-1.5 rounded-lg font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isAutoScanningVideo
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAutoScanningVideo ? 'Stop Auto-Scan' : 'Auto-Scan Clip'}</span>
                </button>

                <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                  <button
                    onClick={downloadRecording}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[11px] flex items-center justify-center gap-1 border border-slate-700"
                    title="Download recorded clip"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>

                  <button
                    onClick={clearRecordedVideo}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700"
                    title="Discard recorded clip"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[90px] border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-center p-3 gap-1">
              <Film className="w-5 h-5 text-slate-600" />
              <span className="font-mono text-xs text-slate-400">No recorded clips in current session</span>
              <span className="text-[10px] text-slate-500">
                Hit "START RECORDING SESSION" with camera active to capture walking video
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
