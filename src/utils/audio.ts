// Web Audio API & Speech Synthesis Engine for Spatial Navigation
class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // Deduplication & Anti-Spam Memory
  private lastSpokenMessage: string = '';
  private lastSpokenTimestamp: number = 0;
  private readonly DEFAULT_COOLDOWN_SECONDS: number = 6;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Smart Speech Synthesizer with intelligent deduplication:
   * - Won't repeat the exact same message for COOLDOWN_SECONDS (default: 6s)
   * - Immediately interrupts and speaks if a NEW hazard/instruction appears
   * - Rate 1.05 for crisp, intelligible accessibility delivery
   * - Cancels overlapping speech before speaking
   */
  public speakSmart(
    message: string,
    urgency: string = 'normal',
    cooldownSeconds: number = 6,
    force: boolean = false
  ): boolean {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    if (!message || message.trim() === '') {
      return false;
    }

    const trimmed = message.trim();
    const now = Date.now();

    // If it's the exact same message and cooldown hasn't passed, IGNORE IT (Stop spamming!)
    if (!force && trimmed === this.lastSpokenMessage && now - this.lastSpokenTimestamp < cooldownSeconds * 1000) {
      return false;
    }

    // Update memory
    this.lastSpokenMessage = trimmed;
    this.lastSpokenTimestamp = now;

    try {
      // Stop any overlapping garbage audio safely
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(trimmed);
      this.currentUtterance = utterance;

      // Rate: 1.05 for crisp delivery, 1.15 for critical emergency
      if (urgency === 'critical' || urgency === 'emergency') {
        utterance.rate = 1.15;
        utterance.pitch = 1.05;
      } else if (urgency === 'caution' || urgency === 'warning') {
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
      } else {
        utterance.rate = 1.05; // Slightly faster, crisp delivery requested by user
        utterance.pitch = 1.0;
      }

      // Try selecting an English natural voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel'))
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      console.warn('Speech synthesis error in speakSmart:', e);
      return false;
    }
  }

  // Speak navigation guidance directly (e.g. For manual buttons or forced repeats)
  public speakGuidance(text: string, urgency: string = 'normal', onEnd?: () => void) {
    this.speakSmart(text, urgency, this.DEFAULT_COOLDOWN_SECONDS, true);
    if (onEnd) {
      setTimeout(onEnd, 1500);
    }
  }

  // Play a directional spatial radar ping using Web Audio API StereoPanner
  public playSpatialPing(pan: number = 0, frequency: number = 520, duration: number = 0.15) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Stereo panning (-1 is full left, +1 is full right)
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Web Audio ping error:', e);
    }
  }

  // Play urgency tone (two rapid high alerts for warning/critical)
  public playUrgencyAlert(urgency: string) {
    if (this.isMuted) return;
    if (urgency === 'critical' || urgency === 'emergency') {
      this.playSpatialPing(0, 880, 0.12);
      setTimeout(() => this.playSpatialPing(0, 1040, 0.18), 140);
      this.triggerHaptic([180, 80, 180]);
    } else if (urgency === 'caution' || urgency === 'warning') {
      this.playSpatialPing(0, 640, 0.14);
      this.triggerHaptic([90]);
    } else {
      this.playSpatialPing(0, 440, 0.08);
    }
  }

  // Haptic feedback for tactile sense
  public triggerHaptic(pattern: number[] = [100]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignored if browser prevents vibration without direct touch
      }
    }
  }

  public stopAll() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const spatialAudio = new SpatialAudioEngine();

/**
 * Global speakSmart helper function
 * Keeps track of what was last said and when.
 * Ignores identical messages within COOLDOWN_SECONDS (default: 6s) to prevent spamming.
 */
export const speakSmart = (
  message: string,
  urgency: string = 'normal',
  cooldownSeconds: number = 6,
  force: boolean = false
): boolean => {
  return spatialAudio.speakSmart(message, urgency, cooldownSeconds, force);
};
