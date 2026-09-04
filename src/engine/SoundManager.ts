/**
 * Battle City 1990 - Pure Web Audio API 8-Bit Sound Synthesizer
 * Synthesizes classic NES audio: stage fanfare, motor hum, fire blip,
 * bullet impacts, explosions, power-ups, game over.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.4;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public unlockAudio() {
    this.initContext();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopEngineSound();
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted) {
      this.stopEngineSound();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // --- Stage Start Intro Jingle (Iconic NES Battle City melody) ---
  public playStageStart() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const startTime = ctx.currentTime + 0.05;

    // Classic 8-note NES melody:
    // C4, E4, G4, C5, G4, E4, G4, C5 (or accurate Battle City progression)
    // Notes in Hz: C4(261.6), D4(293.7), E4(329.6), G4(392), C5(523.3), E5(659.3), G5(784)
    const melody: [number, number, number][] = [
      [261.63, 0.10, 0.00], // C4
      [329.63, 0.10, 0.11], // E4
      [392.00, 0.10, 0.22], // G4
      [523.25, 0.18, 0.33], // C5
      [392.00, 0.10, 0.53], // G4
      [523.25, 0.12, 0.65], // C5
      [659.25, 0.12, 0.78], // E5
      [783.99, 0.28, 0.91], // G5
      [1046.5, 0.35, 1.20], // C6 triumph note
    ];

    melody.forEach(([freq, duration, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime + offset);

      gain.gain.setValueAtTime(this.masterVolume * 0.45, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + offset);
      osc.stop(startTime + offset + duration);
    });

    // Bassline underneath
    const bassline: [number, number, number][] = [
      [130.81, 0.22, 0.00], // C3
      [164.81, 0.22, 0.33], // E3
      [196.00, 0.22, 0.65], // G3
      [261.63, 0.35, 1.20], // C4
    ];

    bassline.forEach(([freq, duration, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + offset);

      gain.gain.setValueAtTime(this.masterVolume * 0.4, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + offset);
      osc.stop(startTime + offset + duration);
    });
  }

  // --- Tank Shooting Blip ---
  public playShoot() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const now = ctx.currentTime;

    // Fast downward pitch sweep
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // --- Bullet Hit Brick (Crunch/Crumb sound) ---
  public playHitBrick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.05; // 50ms burst
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  // --- Bullet Hit Steel (High metallic ricochet ping) ---
  public playHitSteel() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.setValueAtTime(1550, now + 0.02);
    osc.frequency.setValueAtTime(980, now + 0.04);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // --- Small Explosion (Bullet clash / obstacle destroyed) ---
  public playExplosion() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  // --- Big Explosion (Tank or Eagle base destroyed) ---
  public playBigExplosion() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.75, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    // Add deep rumble
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(110, ctx.currentTime);
    rumble.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.6);
    rumbleGain.gain.setValueAtTime(this.masterVolume * 0.5, ctx.currentTime);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    noise.start();
    rumble.start();
    rumble.stop(ctx.currentTime + 0.6);
  }

  // --- Power-Up Spawn Chime ---
  public playPowerUpSpawn() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(this.masterVolume * 0.45, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  // --- Power-Up Collect / Pickup ---
  public playPowerUpCollect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.05;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(this.masterVolume * 0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  // --- Tank Engine Loop ---
  public updateEngineSound(isMoving: boolean) {
    if (this.isMuted) {
      this.stopEngineSound();
      return;
    }
    this.initContext();
    if (!this.ctx) return;

    if (!this.isEngineRunning) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(45, this.ctx.currentTime);
        gain.gain.setValueAtTime(this.masterVolume * 0.12, this.ctx.currentTime);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        this.engineOsc = osc;
        this.engineGain = gain;
        this.isEngineRunning = true;
      } catch {
        // Audio might still be locked
      }
    }

    if (this.engineOsc && this.engineGain && this.ctx) {
      const now = this.ctx.currentTime;
      if (isMoving) {
        this.engineOsc.frequency.setTargetAtTime(85, now, 0.05);
        this.engineGain.gain.setTargetAtTime(this.masterVolume * 0.22, now, 0.05);
      } else {
        this.engineOsc.frequency.setTargetAtTime(45, now, 0.08);
        this.engineGain.gain.setTargetAtTime(this.masterVolume * 0.1, now, 0.08);
      }
    }
  }

  public stopEngineSound() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch {}
      this.engineGain = null;
    }
    this.isEngineRunning = false;
  }

  // --- Pause Blip ---
  public playPause() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1000, now + 0.04);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // --- Game Over Melody ---
  public playGameOver() {
    if (this.isMuted) return;
    this.stopEngineSound();
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const notes: [number, number, number][] = [
      [392.00, 0.18, 0.00], // G4
      [349.23, 0.18, 0.20], // F4
      [311.13, 0.18, 0.40], // Eb4
      [261.63, 0.40, 0.60], // C4
    ];

    notes.forEach(([freq, duration, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(this.masterVolume * 0.45, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    });
  }

  // --- Tactical Sound Effects ---
  // 1. Grenade Bounce (Thump/bounce clink)
  public playGrenadeBounce() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
    gain.gain.setValueAtTime(this.masterVolume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 2. Smoke Deploy (Pressurized hiss / whoosh)
  public playSmokeDeploy() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  // 3. Shield Deploy (High-tech energy barrier hum/chime)
  public playShieldDeploy() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(this.masterVolume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 4. Shield Hit (Metallic energy deflection ping)
  public playShieldHit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}

export const soundManager = new SoundManager();
