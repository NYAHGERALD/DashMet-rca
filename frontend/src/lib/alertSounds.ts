/**
 * Alert Sound Service
 * 
 * Synthesizes notification sounds using Web Audio API.
 * No external audio files needed — works in all modern browsers.
 * 
 * Sound Types:
 * - chime:  Gentle two-tone chime (default)
 * - bell:   Classic notification bell
 * - ping:   Short, crisp ping
 * - urgent: Attention-grabbing three-tone alert
 * - alarm:  Persistent alarm pattern (for critical items)
 */

export type SoundType = 'chime' | 'bell' | 'ping' | 'urgent' | 'alarm';

class AlertSoundService {
  private static instance: AlertSoundService;
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private repeatTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): AlertSoundService {
    if (!AlertSoundService.instance) {
      AlertSoundService.instance = new AlertSoundService();
    }
    return AlertSoundService.instance;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Play a notification sound
   */
  async play(type: SoundType = 'chime', volume: number = 80): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.isPlaying) return;

    this.isPlaying = true;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, Math.max(0, volume / 100));
    gain.connect(ctx.destination);

    try {
      switch (type) {
        case 'chime':
          await this.playChime(ctx, gain);
          break;
        case 'bell':
          await this.playBell(ctx, gain);
          break;
        case 'ping':
          await this.playPing(ctx, gain);
          break;
        case 'urgent':
          await this.playUrgent(ctx, gain);
          break;
        case 'alarm':
          await this.playAlarm(ctx, gain);
          break;
      }
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Start repeating a sound at a given interval (for overdue items)
   */
  startRepeat(type: SoundType, volume: number, intervalMinutes: number): void {
    this.stopRepeat();
    this.play(type, volume);
    this.repeatTimer = setInterval(() => {
      this.play(type, volume);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop repeating sounds
   */
  stopRepeat(): void {
    if (this.repeatTimer) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  /**
   * Preview a sound (for settings UI)
   */
  async preview(type: SoundType, volume: number = 80): Promise<void> {
    this.isPlaying = false; // Allow override
    await this.play(type, volume);
  }

  // ─── Sound Generators ──────────────────────────────────────────────────

  private playChime(ctx: AudioContext, gain: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const now = ctx.currentTime;
      // Two gentle rising tones
      this.playTone(ctx, gain, 523.25, now, 0.15, 'sine');        // C5
      this.playTone(ctx, gain, 659.25, now + 0.15, 0.2, 'sine');  // E5
      setTimeout(resolve, 400);
    });
  }

  private playBell(ctx: AudioContext, gain: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const now = ctx.currentTime;
      // Bell with harmonic overtones
      this.playTone(ctx, gain, 880, now, 0.5, 'sine', 0.3);       // A5
      this.playTone(ctx, gain, 1760, now, 0.3, 'sine', 0.15);     // A6 (overtone)
      this.playTone(ctx, gain, 2640, now, 0.15, 'sine', 0.08);    // Overtone  
      setTimeout(resolve, 550);
    });
  }

  private playPing(ctx: AudioContext, gain: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const now = ctx.currentTime;
      // Short crisp ping
      this.playTone(ctx, gain, 1200, now, 0.08, 'sine');
      setTimeout(resolve, 120);
    });
  }

  private playUrgent(ctx: AudioContext, gain: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const now = ctx.currentTime;
      // Three ascending urgent tones
      this.playTone(ctx, gain, 587.33, now, 0.12, 'triangle');        // D5
      this.playTone(ctx, gain, 783.99, now + 0.15, 0.12, 'triangle'); // G5
      this.playTone(ctx, gain, 987.77, now + 0.30, 0.18, 'triangle'); // B5
      // Repeat once for emphasis
      this.playTone(ctx, gain, 587.33, now + 0.55, 0.12, 'triangle');
      this.playTone(ctx, gain, 783.99, now + 0.70, 0.12, 'triangle');
      this.playTone(ctx, gain, 987.77, now + 0.85, 0.18, 'triangle');
      setTimeout(resolve, 1100);
    });
  }

  private playAlarm(ctx: AudioContext, gain: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const now = ctx.currentTime;
      // Alternating two-tone alarm pattern
      for (let i = 0; i < 4; i++) {
        const offset = i * 0.4;
        this.playTone(ctx, gain, 880, now + offset, 0.15, 'square', 0.15);
        this.playTone(ctx, gain, 660, now + offset + 0.2, 0.15, 'square', 0.15);
      }
      setTimeout(resolve, 1700);
    });
  }

  private playTone(
    ctx: AudioContext,
    gain: GainNode,
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volumeMultiplier: number = 1,
  ): void {
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    // Smooth envelope to avoid clicks
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(volumeMultiplier, startTime + 0.01);
    envGain.gain.setValueAtTime(volumeMultiplier, startTime + duration - 0.03);
    envGain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(envGain);
    envGain.connect(gain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const alertSoundService = AlertSoundService.getInstance();
