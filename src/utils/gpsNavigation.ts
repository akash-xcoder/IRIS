/**
 * Pure Client-Side GPS & Compass Navigation Engine
 * Zero external APIs needed - Uses standard W3C Geolocation & DeviceOrientation
 * Computes Haversine distance and Great-Circle bearing locally in pure math.
 */

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null; // 0 - 360 degrees
  speed: number | null; // m/s
  timestamp: number;
}

export interface NavigationTarget {
  name: string;
  latitude: number;
  longitude: number;
}

export interface GpsGuidanceResult {
  distanceMeters: number;
  targetBearingDeg: number;
  userHeadingDeg: number;
  angleDifferenceDeg: number; // -180 to 180 (negative = turn left, positive = turn right)
  turnInstruction: string;
  isArrived: boolean;
}

/**
 * Great-Circle forward azimuth / bearing from Point A to Point B (0 - 360 degrees)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Haversine formula: Calculates distance in meters between two GPS coordinates
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes guidance instruction comparing target bearing with current user heading
 */
export function computeNavigationGuidance(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  userHeading: number
): GpsGuidanceResult {
  const distance = calculateDistanceMeters(currentLat, currentLon, targetLat, targetLon);
  const targetBearing = calculateBearing(currentLat, currentLon, targetLat, targetLon);

  // Normalize angle difference to -180 to 180
  let angleDifference = targetBearing - userHeading;
  angleDifference = ((angleDifference + 540) % 360) - 180;

  let turnInstruction = '';
  const isArrived = distance < 6;

  if (isArrived) {
    turnInstruction = 'You have arrived at your destination.';
  } else if (Math.abs(angleDifference) < 20) {
    turnInstruction = `Continue straight for ${distance} meters.`;
  } else if (angleDifference > 20 && angleDifference <= 70) {
    turnInstruction = `Destination is ${distance}m ahead. Turn slightly right.`;
  } else if (angleDifference > 70) {
    turnInstruction = `Destination is ${distance}m away. Turn right.`;
  } else if (angleDifference < -20 && angleDifference >= -70) {
    turnInstruction = `Destination is ${distance}m ahead. Turn slightly left.`;
  } else {
    turnInstruction = `Destination is ${distance}m away. Turn left.`;
  }

  return {
    distanceMeters: distance,
    targetBearingDeg: Math.round(targetBearing),
    userHeadingDeg: Math.round(userHeading),
    angleDifferenceDeg: Math.round(angleDifference),
    turnInstruction,
    isArrived,
  };
}

class GpsTracker {
  private watchId: number | null = null;
  private currentPosition: GpsLocation | null = null;
  private compassHeading: number = 0;
  private listeners: Array<(location: GpsLocation) => void> = [];
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;

  public start(onUpdate?: (location: GpsLocation) => void): boolean {
    if (onUpdate) {
      this.listeners.push(onUpdate);
    }

    // Start Compass / DeviceOrientation listener
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      this.orientationListener = (e: DeviceOrientationEvent) => {
        let heading = 0;
        // iOS webkitCompassHeading
        if ((e as any).webkitCompassHeading !== undefined) {
          heading = (e as any).webkitCompassHeading;
        } else if (e.alpha !== null) {
          // Android standard alpha (0-360)
          heading = 360 - e.alpha;
        }
        this.compassHeading = (heading + 360) % 360;
      };

      window.addEventListener('deviceorientation', this.orientationListener, true);
    }

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation is not supported by this browser.');
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading)
          ? pos.coords.heading
          : this.compassHeading;

        const loc: GpsLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 5),
          heading: heading,
          speed: pos.coords.speed !== null ? Math.round((pos.coords.speed || 0) * 10) / 10 : 0,
          timestamp: pos.timestamp,
        };

        this.currentPosition = loc;
        this.listeners.forEach((fn) => fn(loc));
      },
      (err) => {
        console.warn('GPS position watch notice:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return true;
  }

  public stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
    }
    this.listeners = [];
  }

  public getCurrentPosition(): GpsLocation | null {
    return this.currentPosition;
  }

  public getHeading(): number {
    return this.compassHeading;
  }
}

export const gpsTracker = new GpsTracker();
