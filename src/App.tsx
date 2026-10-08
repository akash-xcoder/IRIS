/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavigationResponse, PresetScenario, UrgencyLevel, Detection } from './types';
import { getPresetScenarios } from './data/presetScenarios';
import { spatialAudio, speakSmart } from './utils/audio';
import { TacticalViewfinder } from './components/TacticalViewfinder';
import { SpatialRadar } from './components/SpatialRadar';
import { RawJsonInspector } from './components/RawJsonInspector';
import { AssistiveHud } from './components/AssistiveHud';
import { TelemetryBar } from './components/TelemetryBar';
import { ScenarioSelector } from './components/ScenarioSelector';
import { VideoRecordingPanel } from './components/VideoRecordingPanel';
import { localYolo } from './utils/localYoloDetector';
import { GpsCompassNav } from './components/GpsCompassNav';
import { IrisLogo } from './components/IrisLogo';
import {
  gpsTracker,
  computeNavigationGuidance,
  GpsLocation,
  GpsGuidanceResult,
  NavigationTarget,
} from './utils/gpsNavigation';
import {
  Eye,
  Shield,
  Volume2,
  VolumeX,
  Compass,
  LayoutDashboard,
  Smartphone,
  Info,
  Sparkles,
  AlertTriangle,
  Film,
  Layers,
  Zap,
} from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'pitch-dashboard' | 'assistive-hud'>('pitch-dashboard');
  const [activeFeedTab, setActiveFeedTab] = useState<'video-recorder' | 'presets'>('video-recorder');
  const [engineMode, setEngineMode] = useState<'hybrid' | 'local-yolo' | 'gemini'>('local-yolo');
  const [yoloFps, setYoloFps] = useState<number>(30);
  const [yoloInferenceMs, setYoloInferenceMs] = useState<number>(18);
  const [isYoloReady, setIsYoloReady] = useState<boolean>(false);
  const lastSpokenTimeRef = useRef<number>(0);

  // GPS & Compass Geolocation State (Pure Client-Side Math)
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [targetDestination, setTargetDestination] = useState<NavigationTarget>({
    name: 'Metro Station Entrance',
    latitude: 12.9716,
    longitude: 77.5946,
  });
  const [gpsGuidance, setGpsGuidance] = useState<GpsGuidanceResult | null>(null);
  const gpsGuidanceRef = useRef<GpsGuidanceResult | null>(null);

  // Synchronize ref for animation loop
  useEffect(() => {
    gpsGuidanceRef.current = gpsGuidance;
  }, [gpsGuidance]);

  // Start GPS Geolocation Tracking & Compass
  const startGpsNavigation = useCallback(() => {
    setIsGpsActive(true);
    gpsTracker.start((loc) => {
      setGpsLocation(loc);
      const guidance = computeNavigationGuidance(
        loc.latitude,
        loc.longitude,
        targetDestination.latitude,
        targetDestination.longitude,
        loc.heading || 0
      );
      setGpsGuidance(guidance);
    });
  }, [targetDestination]);

  const handleSetTarget = (newTarget: NavigationTarget) => {
    setTargetDestination(newTarget);
    const baseLat = gpsLocation?.latitude || 12.9716;
    const baseLon = gpsLocation?.longitude || 77.5946;
    const heading = gpsLocation?.heading || 0;
    const guidance = computeNavigationGuidance(
      baseLat,
      baseLon,
      newTarget.latitude,
      newTarget.longitude,
      heading
    );
    setGpsGuidance(guidance);
  };

  const handleSetRelativeTarget = (metersAhead: number, metersRight: number) => {
    const baseLat = gpsLocation?.latitude || 12.9716;
    const baseLon = gpsLocation?.longitude || 77.5946;
    const latOffset = metersAhead / 111320;
    const lonOffset = metersRight / (111320 * Math.cos((baseLat * Math.PI) / 180));
    const newTarget: NavigationTarget = {
      name: `Waypoint (+${metersAhead}m ahead)`,
      latitude: baseLat + latOffset,
      longitude: baseLon + lonOffset,
    };
    handleSetTarget(newTarget);
  };

  const speakGpsGuidance = () => {
    if (gpsGuidance) {
      spatialAudio.speakGuidance(gpsGuidance.turnInstruction, 'normal');
    }
  };

  const [scenarios, setScenarios] = useState<PresetScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<PresetScenario | null>(null);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Analysis & Navigation state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [response, setResponse] = useState<NavigationResponse | null>(null);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [totalFramesAnalyzed, setTotalFramesAnalyzed] = useState<number>(0);

  // Preferences & Controls
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isAutoScanning, setIsAutoScanning] = useState<boolean>(false);
  const [autoScanInterval, setAutoScanInterval] = useState<number>(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden offscreen canvas for capturing camera frames
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize live real-world camera on mount, load local YOLO, and start GPS
  useEffect(() => {
    const list = getPresetScenarios();
    setScenarios(list);

    // Load lightweight local edge YOLO model
    localYolo.loadModel().then((ok) => {
      setIsYoloReady(ok);
    });

    // Start pure client-side GPS navigation
    startGpsNavigation();

    // Automatically initialize the real-world live camera detector
    startCamera('environment');

    return () => {
      stopCamera();
      gpsTracker.stop();
      spatialAudio.stopAll();
    };
  }, [startGpsNavigation]);

  // Real-Time Local YOLO detection loop on live webcam stream (like cv2.imshow / r.plot)
  useEffect(() => {
    let animationFrameId: number;
    let isDetecting = false;

    const runYoloLoop = async () => {
      if (
        isCameraActive &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        (engineMode === 'hybrid' || engineMode === 'local-yolo') &&
        localYolo.isModelReady()
      ) {
        if (!isDetecting) {
          isDetecting = true;
          const result = await localYolo.detectFrame(videoRef.current);
          isDetecting = false;

          if (result) {
            setYoloFps(result.fps);
            setYoloInferenceMs(result.inferenceTimeMs);

            setResponse((prev) => {
              if (engineMode === 'local-yolo') {
                return {
                  speech_guidance: result.speechGuidance,
                  urgency: result.urgency,
                  detections: result.detections,
                  _metadata: {
                    latencyMs: result.inferenceTimeMs,
                    timestamp: new Date().toISOString(),
                    model: 'yolov8-nano-edge',
                    rawOutput: JSON.stringify(
                      {
                        speech_guidance: result.speechGuidance,
                        urgency: result.urgency,
                        detections: result.detections,
                        gpsGuidance: gpsGuidanceRef.current?.turnInstruction || 'Calculating GPS...',
                      },
                      null,
                      2
                    ),
                  },
                };
              } else if (engineMode === 'hybrid') {
                return {
                  speech_guidance: prev?.speech_guidance || result.speechGuidance,
                  urgency: prev?.urgency || result.urgency,
                  detections: result.detections.length > 0 ? result.detections : prev?.detections || [],
                  _metadata: prev?._metadata || {
                    latencyMs: result.inferenceTimeMs,
                    model: 'hybrid (yolo-nano + gemini-3.8-flash)',
                  },
                };
              }
              return prev;
            });

            // Fused Dual-Guidance Voice Synthesizer with speakSmart Anti-Spam Cooldown
            if ((engineMode === 'local-yolo' || engineMode === 'hybrid') && !spatialAudio.getIsMuted()) {
              let alertToSpeak = result.speechGuidance;
              let alertUrgency = result.urgency;

              // If obstacles are detected in proximity, prioritize obstacle avoidance!
              if (result.urgency !== 'normal') {
                alertToSpeak = result.speechGuidance;
                alertUrgency = result.urgency;
              } else if (gpsGuidanceRef.current?.turnInstruction) {
                // If path is clear, speak GPS turn-by-turn waypoint direction!
                alertToSpeak = gpsGuidanceRef.current.turnInstruction;
                alertUrgency = 'normal';
              }

              // speakSmart: only speaks if it's a new instruction or the 6-second cooldown has passed!
              const spoken = speakSmart(alertToSpeak, alertUrgency, 6);
              if (spoken && alertUrgency !== 'normal') {
                spatialAudio.playUrgencyAlert(alertUrgency);
              }
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(runYoloLoop);
    };

    animationFrameId = requestAnimationFrame(runYoloLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCameraActive, engineMode]);

  // WebRTC Camera Management
  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    stopCamera();
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setActiveScenario(null);
      setActiveImageSrc(null);
      setCameraFacing(facing);
    } catch (err: any) {
      console.warn('Camera access could not be initialized:', err);
      setIsCameraActive(false);
      setMediaStream(null);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission needed for real-world obstacle detection. Click "START LIVE CAMERA NOW" to grant access.'
          : 'Please grant camera access to look at the real physical world and detect obstacles.'
      );
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMediaStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const switchCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  // Capture frame from active camera stream
  const captureCurrentCameraFrame = (): string | null => {
    if (!videoRef.current || !isCameraActive) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Primary API Call to Server-Side Gemini 3.8 Flash Engine
  const analyzeImageFrame = async (imageSrcToAnalyze?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorMessage(null);

    let base64Payload = imageSrcToAnalyze;

    if (!base64Payload && isCameraActive) {
      base64Payload = captureCurrentCameraFrame() || undefined;
    }

    if (!base64Payload) {
      base64Payload = activeImageSrc || undefined;
    }

    if (!base64Payload) {
      setIsAnalyzing(false);
      setErrorMessage('No camera frame or image available to analyze.');
      return;
    }

    try {
      const res = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Payload,
          mimeType: 'image/jpeg',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMessage = String(errorData.error || errorData.details || '');
        const isQuota =
          res.status === 429 ||
          errMessage.includes('429') ||
          errMessage.includes('RESOURCE_EXHAUSTED') ||
          errMessage.includes('quota');

        if (isQuota) {
          // Automatic failover to local in-browser YOLO model
          setEngineMode('local-yolo');
          setIsAutoScanning(false);
          setErrorMessage(
            'Gemini free tier daily quota (20 req/day) reached. Switched seamlessly to On-Device Real-Time YOLO (30 FPS) with unlimited local obstacle detection!'
          );
          return;
        }

        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data: NavigationResponse & { _quotaExceeded?: boolean } = await res.json();

      if (data._quotaExceeded) {
        setEngineMode('local-yolo');
        setIsAutoScanning(false);
        setErrorMessage(
          'Gemini free tier quota reached. Switched seamlessly to On-Device Real-Time YOLO (30 FPS) with unlimited offline obstacle tracking!'
        );
      }

      setResponse(data);
      setRawJsonText(data._metadata?.rawOutput || JSON.stringify(data, null, 2));
      setLatencyMs(data._metadata?.latencyMs || 0);
      setTotalFramesAnalyzed((prev) => prev + 1);

      // Trigger Audio & Haptic Feedback
      if (!spatialAudio.getIsMuted()) {
        spatialAudio.playUrgencyAlert(data.urgency);

        // Directional ping if obstacles detected
        if (data.detections.length > 0) {
          const firstDet = data.detections[0];
          const centerX = (firstDet.box_2d[1] + firstDet.box_2d[3]) / 2;
          const pan = (centerX - 500) / 500;
          spatialAudio.playSpatialPing(pan, data.urgency === 'critical' ? 880 : 540);
        }

        // Voice Guidance Speech
        spatialAudio.speakGuidance(data.speech_guidance, data.urgency);
      }
    } catch (err: any) {
      console.warn('Frame analysis notice:', err);
      const isQuota =
        String(err.message || '').includes('429') ||
        String(err.message || '').includes('quota') ||
        String(err.message || '').includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        setEngineMode('local-yolo');
        setIsAutoScanning(false);
        setErrorMessage(
          'Gemini free tier quota reached. Switched seamlessly to On-Device Real-Time YOLO (30 FPS) for uninterrupted blind navigation!'
        );
      } else {
        setErrorMessage(`Inference notice: ${err.message || 'Check network / API connection.'}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Continuous Auto-Scan Navigation Loop
  useEffect(() => {
    let intervalId: any = null;
    if (isAutoScanning) {
      intervalId = setInterval(() => {
        if (!isAnalyzing) {
          analyzeImageFrame();
        }
      }, autoScanInterval * 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoScanning, autoScanInterval, isAnalyzing, isCameraActive, activeImageSrc]);

  // Handle Scenario Select
  const handleSelectScenario = (scenario: PresetScenario) => {
    stopCamera();
    setActiveScenario(scenario);
    setActiveImageSrc(scenario.imageDataUrl || null);
    if (scenario.imageDataUrl) {
      analyzeImageFrame(scenario.imageDataUrl);
    }
  };

  // Handle Custom Uploaded Image
  const handleUploadCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setActiveScenario(null);
      setActiveImageSrc(dataUrl);
      analyzeImageFrame(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Handle Frame extracted from Recorded Video
  const handleAnalyzeFrameFromVideo = (frameDataUrl: string) => {
    setActiveScenario(null);
    setActiveImageSrc(frameDataUrl);
    analyzeImageFrame(frameDataUrl);
  };

  // Audio Controls
  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    spatialAudio.setMuted(nextMute);
  };

  const repeatSpeech = () => {
    if (response) {
      spatialAudio.speakGuidance(response.speech_guidance, response.urgency);
    }
  };

  const handlePingSector = (pan: number, freq: number) => {
    spatialAudio.playSpatialPing(pan, freq, 0.2);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 tactical-grid-bg">
      {/* Top Navigation & Pitch Mode Switcher */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-950 via-slate-900 to-purple-950/80 flex items-center justify-center shadow-lg shadow-cyan-500/15 border border-cyan-400/40 p-1">
              <IrisLogo className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  AegisVision <span className="text-cyan-400 font-mono text-xs">AI HUD</span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Assistive Computer Vision & Spatial Reasoning Engine
              </p>
            </div>
          </div>

          {/* Mode Switcher & Global Audio Toggle */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle: Pitch Dashboard vs Assistive HUD */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs font-mono">
              <button
                onClick={() => setViewMode('pitch-dashboard')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'pitch-dashboard'
                    ? 'bg-cyan-600 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tactical Pitch Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </button>

              <button
                onClick={() => setViewMode('assistive-hud')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'assistive-hud'
                    ? 'bg-emerald-600 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Assistive Walker HUD</span>
                <span className="sm:hidden">Walker HUD</span>
              </button>
            </div>

            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl transition-all border ${
                isMuted
                  ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute Audio Speech & Radar' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Error Alert if any */}
        {errorMessage && (
          <div className="bg-amber-950/70 border border-amber-500/60 rounded-xl p-3.5 flex items-start gap-3 text-amber-200 text-xs font-mono shadow-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold uppercase">System Notice: </span>
              {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-400 hover:text-white font-bold text-sm leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Primary Assistive Voice HUD (Always visible prominently) */}
        <AssistiveHud
          response={response}
          isAnalyzing={isAnalyzing}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onRepeatSpeech={repeatSpeech}
          onTriggerScan={() => analyzeImageFrame()}
        />

        {/* Pitch Dashboard View: Full Tactical Monitoring Layout */}
        {viewMode === 'pitch-dashboard' ? (
          <div className="flex flex-col gap-6">
            {/* Real-time Telemetry Metrics Bar */}
            <TelemetryBar
              latencyMs={latencyMs}
              urgency={response?.urgency || 'normal'}
              detectionCount={response?.detections.length || 0}
              isAutoScanning={isAutoScanning}
              autoScanInterval={autoScanInterval}
              onToggleAutoScan={() => setIsAutoScanning(!isAutoScanning)}
              onChangeInterval={setAutoScanInterval}
              isAnalyzing={isAnalyzing}
              totalFramesAnalyzed={totalFramesAnalyzed}
              engineMode={engineMode}
              yoloFps={yoloFps}
            />

            {/* Split Screen Grid: Viewfinder on Left, Tactical Intelligence on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 1000-Point Normalized Viewfinder (7 cols on lg) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <TacticalViewfinder
                  imageSrc={activeImageSrc}
                  videoRef={videoRef}
                  isCameraActive={isCameraActive}
                  detections={response?.detections || []}
                  urgency={response?.urgency || 'normal'}
                  isAnalyzing={isAnalyzing}
                  showGrid={showGrid}
                  onToggleGrid={() => setShowGrid(!showGrid)}
                  onCaptureFrame={() => analyzeImageFrame()}
                  onSwitchCamera={switchCameraFacing}
                  facingMode={cameraFacing}
                  onToggleCamera={() => (isCameraActive ? stopCamera() : startCamera(cameraFacing))}
                  engineMode={engineMode}
                  onSelectEngineMode={setEngineMode}
                  yoloFps={yoloFps}
                  yoloInferenceMs={yoloInferenceMs}
                  isYoloReady={isYoloReady}
                />

                {/* Feed Source Mode Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveFeedTab('video-recorder')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all border ${
                      activeFeedTab === 'video-recorder'
                        ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-rose-400" />
                    <span>Video Capturing & Recorder</span>
                  </button>

                  <button
                    onClick={() => setActiveFeedTab('presets')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all border ${
                      activeFeedTab === 'presets'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preset Hazard Scenarios</span>
                  </button>
                </div>

                {/* Active Tab: Live Video Recorder Station vs Preset Scenarios */}
                {activeFeedTab === 'video-recorder' ? (
                  <VideoRecordingPanel
                    mediaStream={mediaStream}
                    isCameraActive={isCameraActive}
                    onStartCamera={() => startCamera(cameraFacing)}
                    onStopCamera={stopCamera}
                    onAnalyzeFrameFromVideo={handleAnalyzeFrameFromVideo}
                    isAnalyzing={isAnalyzing}
                  />
                ) : (
                  <ScenarioSelector
                    scenarios={scenarios}
                    activeScenarioId={activeScenario?.id || null}
                    onSelectScenario={handleSelectScenario}
                    onUploadCustomImage={handleUploadCustomImage}
                    onUseLiveCamera={() => startCamera('environment')}
                    isCameraActive={isCameraActive}
                    isAnalyzing={isAnalyzing}
                  />
                )}
              </div>

              {/* Right Column: GPS Compass Navigation + Spatial Radar + Raw JSON Inspector (5 cols on lg) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Pure Client-Side GPS Waypoint & Compass Heading Navigation */}
                <GpsCompassNav
                  gpsLocation={gpsLocation}
                  target={targetDestination}
                  guidance={gpsGuidance}
                  onSetTarget={handleSetTarget}
                  onSetRelativeTarget={handleSetRelativeTarget}
                  onSpeakGuidance={speakGpsGuidance}
                  isGpsActive={isGpsActive}
                  onStartGps={startGpsNavigation}
                />

                {/* 180° Spatial Hazard Radar */}
                <SpatialRadar
                  detections={response?.detections || []}
                  urgency={response?.urgency || 'normal'}
                  onPingSector={handlePingSector}
                />

                {/* Pitch Judge Raw JSON Inspector */}
                <div className="flex-1 min-h-[250px]">
                  <RawJsonInspector
                    response={response}
                    rawJsonString={rawJsonText}
                    latencyMs={latencyMs || undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Focused Assistive Walker HUD View (Minimalist & High-Contrast for visually impaired users) */
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
            {/* Big Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => analyzeImageFrame()}
                disabled={isAnalyzing}
                className="py-6 px-8 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-black text-xl flex flex-col items-center justify-center gap-2 shadow-2xl transition-all border-2 border-cyan-400"
              >
                <Eye className="w-8 h-8 text-cyan-200" />
                <span>{isAnalyzing ? 'SCANNING...' : 'SCAN PATH NOW'}</span>
                <span className="text-xs font-mono font-normal opacity-80">
                  Large touch target
                </span>
              </button>

              <button
                onClick={repeatSpeech}
                className="py-6 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-emerald-300 font-black text-xl flex flex-col items-center justify-center gap-2 shadow-2xl transition-all border-2 border-emerald-500/60"
              >
                <Volume2 className="w-8 h-8 text-emerald-400" />
                <span>REPEAT GUIDANCE</span>
                <span className="text-xs font-mono font-normal opacity-80">
                  Replays spoken voice
                </span>
              </button>
            </div>

            {/* Viewfinder in Assistive Mode */}
            <div className="rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl">
              <TacticalViewfinder
                imageSrc={activeImageSrc}
                videoRef={videoRef}
                isCameraActive={isCameraActive}
                detections={response?.detections || []}
                urgency={response?.urgency || 'normal'}
                isAnalyzing={isAnalyzing}
                showGrid={false}
                onToggleGrid={() => {}}
                onCaptureFrame={() => analyzeImageFrame()}
                onSwitchCamera={switchCameraFacing}
                facingMode={cameraFacing}
                onToggleCamera={() => (isCameraActive ? stopCamera() : startCamera(cameraFacing))}
                engineMode={engineMode}
                onSelectEngineMode={setEngineMode}
                yoloFps={yoloFps}
                yoloInferenceMs={yoloInferenceMs}
                isYoloReady={isYoloReady}
              />
            </div>

            {/* GPS Waypoint & Compass Directive in Walker Mode */}
            <GpsCompassNav
              gpsLocation={gpsLocation}
              target={targetDestination}
              guidance={gpsGuidance}
              onSetTarget={handleSetTarget}
              onSetRelativeTarget={handleSetRelativeTarget}
              onSpeakGuidance={speakGpsGuidance}
              isGpsActive={isGpsActive}
              onStartGps={startGpsNavigation}
            />

            {/* Live Video Recording Panel in Walker Mode */}
            <VideoRecordingPanel
              mediaStream={mediaStream}
              isCameraActive={isCameraActive}
              onStartCamera={() => startCamera(cameraFacing)}
              onStopCamera={stopCamera}
              onAnalyzeFrameFromVideo={handleAnalyzeFrameFromVideo}
              isAnalyzing={isAnalyzing}
            />

            {/* Quick Scenario Picker in Assistive Mode */}
            <ScenarioSelector
              scenarios={scenarios}
              activeScenarioId={activeScenario?.id || null}
              onSelectScenario={handleSelectScenario}
              onUploadCustomImage={handleUploadCustomImage}
              onUseLiveCamera={() => startCamera('environment')}
              isCameraActive={isCameraActive}
              isAnalyzing={isAnalyzing}
            />
          </div>
        )}
      </main>

      {/* Footer / Pitch Notes */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/80 px-4 py-3 text-center text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span>AegisVision Assistive Navigation v2.4</span>
        </div>
        <div>
          <span>Strict Schema [speech_guidance, urgency, detections[box_2d]]</span>
        </div>
      </footer>
    </div>
  );
}
