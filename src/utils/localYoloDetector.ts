import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Detection } from '../types';

export interface LocalYoloResult {
  detections: Detection[];
  rawDetections: cocoSsd.DetectedObject[];
  fps: number;
  inferenceTimeMs: number;
  speechGuidance: string;
  urgency: 'normal' | 'caution' | 'critical';
}

class LocalYoloDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  private isLoading: boolean = false;
  private isReady: boolean = false;
  private lastInferenceTime: number = 0;
  private frameCount: number = 0;
  private currentFps: number = 0;
  private fpsTimer: number = 0;

  // Initialize browser-local YOLO / COCO-SSD edge model
  public async loadModel(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      // Ensure TensorFlow.js backend is ready (WebGL or CPU fallback)
      await tf.ready();
      console.log('[Local YOLO] TF Backend initialized:', tf.getBackend());

      // Load lightweight nano-speed model
      this.model = await cocoSsd.load({
        base: 'mobilenet_v2', // Fast mobile-optimized weights equivalent to yolov8n
      });

      this.isReady = true;
      this.isLoading = false;
      console.log('[Local YOLO] Local edge detector model loaded successfully.');
      return true;
    } catch (err) {
      console.error('[Local YOLO] Failed to load local detector model:', err);
      this.isLoading = false;
      return false;
    }
  }

  public isModelReady(): boolean {
    return this.isReady;
  }

  public isModelLoading(): boolean {
    return this.isLoading;
  }

  // Run real-time detection on HTML5 video element (just like model(frame) in OpenCV)
  public async detectFrame(video: HTMLVideoElement): Promise<LocalYoloResult | null> {
    if (!this.model || !this.isReady || video.readyState < 2) {
      return null;
    }

    const startTime = performance.now();

    try {
      const predictions = await this.model.detect(video, 10, 0.4);
      const elapsed = performance.now() - startTime;
      this.lastInferenceTime = Math.round(elapsed);

      // Calculate real-time FPS
      this.frameCount++;
      const now = performance.now();
      if (now - this.fpsTimer >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.fpsTimer = now;
      }

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;

      // Transform raw predictions to 1000-point normalized grid [ymin, xmin, ymax, xmax]
      const detections: Detection[] = predictions.map((pred) => {
        const [x, y, w, h] = pred.bbox;

        const ymin = Math.max(0, Math.min(1000, Math.round((y / videoHeight) * 1000)));
        const xmin = Math.max(0, Math.min(1000, Math.round((x / videoWidth) * 1000)));
        const ymax = Math.max(0, Math.min(1000, Math.round(((y + h) / videoHeight) * 1000)));
        const xmax = Math.max(0, Math.min(1000, Math.round(((x + w) / videoWidth) * 1000)));

        return {
          label: pred.class.toUpperCase(),
          confidence: Math.round(pred.score * 100),
          box_2d: [ymin, xmin, ymax, xmax],
        };
      });

      // Formulate immediate spatial navigation guidance
      const { speechGuidance, urgency } = this.deriveGuidance(detections);

      return {
        detections,
        rawDetections: predictions,
        fps: this.currentFps || Math.round(1000 / Math.max(1, elapsed)),
        inferenceTimeMs: this.lastInferenceTime,
        speechGuidance,
        urgency,
      };
    } catch (err) {
      console.warn('[Local YOLO] Frame detection error:', err);
      return null;
    }
  }

  // Derive calm, direct spoken instruction for blind user
  private deriveGuidance(detections: Detection[]): {
    speechGuidance: string;
    urgency: 'normal' | 'caution' | 'critical';
  } {
    if (detections.length === 0) {
      return {
        speechGuidance: 'Path is clear, continue straight forward.',
        urgency: 'normal',
      };
    }

    // Sort by proximity: objects lower in frame (higher ymax) or larger are closest
    const sorted = [...detections].sort((a, b) => {
      const aClose = a.box_2d[2];
      const bClose = b.box_2d[2];
      return bClose - aClose;
    });

    const closest = sorted[0];
    const [ymin, xmin, ymax, xmax] = closest.box_2d;
    const centerX = (xmin + xmax) / 2;
    const height = ymax - ymin;

    let position = 'directly ahead';
    if (centerX < 360) position = 'on your left';
    else if (centerX > 640) position = 'on your right';

    const isCriticalObject = ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE'].includes(closest.label);
    const isVeryClose = ymax > 750 || height > 400;

    let urgency: 'normal' | 'caution' | 'critical' = 'caution';
    let speechGuidance = '';

    if (isCriticalObject && isVeryClose) {
      urgency = 'critical';
      speechGuidance = `Stop immediately. ${closest.label.toLowerCase()} approaching ${position}.`;
    } else if (isVeryClose) {
      urgency = 'critical';
      speechGuidance = `Caution, ${closest.label.toLowerCase()} two steps ${position}. Step aside to pass.`;
    } else {
      urgency = 'caution';
      speechGuidance = `Notice: ${closest.label.toLowerCase()} ahead ${position}. Path remains passable.`;
    }

    return { speechGuidance, urgency };
  }
}

export const localYolo = new LocalYoloDetector();
