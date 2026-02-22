export class AudioManager {
  private sfxEnabled = true;
  private ctx: AudioContext | null = null;

  // Background pulse state
  private pulseOsc: OscillatorNode | null = null;
  private pulseGain: GainNode | null = null;
  private pulseActive = false;
  private pulseBpm = 80;

  constructor() {
    // Web Audio API for low-latency synthetic SFX (no audio files needed)
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Short click for piece placement */
  playPlace(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  /** Satisfying burst for line clear */
  playClear(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  /** Escalating combo sound */
  playCombo(streak: number): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const baseFreq = 500 + streak * 80;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.15);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.05);
    osc.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
  }

  /** Sub-bass thump for all combos/clears */
  playSubBass(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** Delay-based reverb tail for streak >= 3 */
  playComboReverb(streak: number): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const baseFreq = 500 + streak * 80;
    // Delayed echo
    for (let i = 1; i <= 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      const delay = i * 0.08;
      const vol = 0.06 / i;
      osc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, ctx.currentTime + delay + 0.15);
      gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    }
  }

  /** Whoosh: bandpass-filtered white noise burst on fast placement */
  playWhoosh(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.05; // 50ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decaying noise
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  }

  /** Countdown tick sound */
  playTick(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  /** GO! chime sound */
  playGoChime(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const freqs = [523, 659, 784]; // C5, E5, G5 chord
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  }

  /** Alert chime for critical time warnings */
  playAlertChime(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc2.type = 'square';
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.2);
  }

  /** Streak break: descending sawtooth 600→200Hz, 200ms */
  playStreakBreak(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  /** Game over sting */
  playGameOver(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // ── Background Pulse ──

  /** Start the background pulse oscillator */
  startPulse(drainRate: number): void {
    if (!this.sfxEnabled || this.pulseActive) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.pulseOsc = ctx.createOscillator();
    this.pulseGain = ctx.createGain();
    this.pulseOsc.type = 'sine';
    this.pulseOsc.frequency.setValueAtTime(50, ctx.currentTime);
    this.pulseOsc.connect(this.pulseGain);
    this.pulseGain.connect(ctx.destination);
    this.pulseGain.gain.setValueAtTime(0.03, ctx.currentTime);
    this.pulseOsc.start(ctx.currentTime);
    this.pulseActive = true;
    this.pulseBpm = 80 + (drainRate - 1) * 40;
  }

  /** Update the background pulse based on current drainRate */
  updatePulse(drainRate: number): void {
    if (!this.pulseActive || !this.pulseGain || !this.ctx) return;
    // Tempo: 80 + (drainRate-1)*40 BPM
    this.pulseBpm = 80 + (drainRate - 1) * 40;
    // Volume scales with drainRate (0.03 to 0.10)
    const volume = Math.min(0.10, 0.03 + (drainRate - 1) * 0.035);
    // Rhythmic modulation
    const beatPeriod = 60 / this.pulseBpm;
    const phase = (this.ctx.currentTime % beatPeriod) / beatPeriod;
    const modulation = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
    this.pulseGain.gain.setValueAtTime(volume * modulation, this.ctx.currentTime);
  }

  /** Stop the background pulse */
  stopPulse(): void {
    if (!this.pulseActive) return;
    try {
      if (this.pulseOsc) {
        this.pulseOsc.stop();
        this.pulseOsc.disconnect();
        this.pulseOsc = null;
      }
      if (this.pulseGain) {
        this.pulseGain.disconnect();
        this.pulseGain = null;
      }
    } catch {
      // Already stopped
    }
    this.pulseActive = false;
  }

  toggleSfx(): boolean {
    this.sfxEnabled = !this.sfxEnabled;
    if (!this.sfxEnabled) {
      this.stopPulse();
    }
    return this.sfxEnabled;
  }
}
