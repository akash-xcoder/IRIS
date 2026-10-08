export interface Detection {
  label: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] scaled 0 to 1000
}

export type UrgencyLevel = 'normal' | 'caution' | 'warning' | 'critical' | 'emergency';

export interface NavigationResponse {
  speech_guidance: string;
  urgency: UrgencyLevel;
  detections: Detection[];
  _metadata?: {
    latencyMs?: number;
    timestamp?: string;
    model?: string;
    rawOutput?: string;
  };
}

export interface PresetScenario {
  id: string;
  title: string;
  category: 'outdoor' | 'indoor' | 'hazard' | 'transit';
  description: string;
  expectedUrgency: UrgencyLevel;
  expectedGuidance: string;
  imageDataUrl: string;
}

export interface SpatialSector {
  zone: 'left' | 'center' | 'right';
  distance: 'near' | 'mid' | 'far'; // estimated based on bounding box
  hazardLabel?: string;
  confidence?: number;
}
