/**
 * Battle City 1990 - High-Definition Web Audio Synthesizer (Professional Overhaul)
 * Pure procedural synthesis with zero external audio assets.
 * 
 * Features:
 * - Master Dynamics Compressor & Limiter for punchy, distortion-free output
 * - Multi-layer Tank Engine: Diesel rumble + mechanical track clatter + idle hum
 * - Terrain-adaptive audio modulation: Mud groans vs Ice slip vs Road
 * - Concussive Cannon Fire: Sub-bass punch + powder snap + breech clack
 * - Multi-Stage Explosions: Sub-bass shockwave + roaring firestorm + debris tail
 * - Catastrophic Base Eagle Destruction Blast
 * - Granular Brick Crumble & Sharp Metallic Armor Ricochet Ping
 * - Tactical Equipment SFX: High-pressure Smoke Screen, Bouncing Grenade Thud, Plasma Shield Deploy & Deflection
 * - Polished NES Melodies & Fanfares with harmonic warmth
 */

export type TerrainType = 'normal' | 'mud' | 'ice';

declare global {
  interface Window {
    __BATTLE_CITY_MENU_BGM__?: HTMLAudioElement;
  }
}

// Ensure any stale BGM from previous HMR is stopped immediately
if (typeof window !== 'undefined' && window.__BATTLE_CITY_MENU_BGM__) {
  try {
    window.__BATTLE_CITY_MENU_BGM__.pause();
    window.__BATTLE_CITY_MENU_BGM__.currentTime = 0;
  } catch {}
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.85;

  // Menu Background Music (BGM)
  private menuBgmAudio: HTMLAudioElement | null = null;
  private isMenuBgmActive: boolean = false;
  private bgmVolumeRatio: number = 1.0;

  // Engine Audio Nodes (Real Military Diesel Rumble & Steel Track Clatter)
  private engineOsc1: OscillatorNode | null = null; // Diesel sub-bass fundamental
  private engineOsc2: OscillatorNode | null = null; // Rich harmonic rumble
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private treadSource: AudioBufferSourceNode | null = null; // Realistic mechanical track shoe clatter
  private treadFilter: BiquadFilterNode | null = null;
  private treadGain: GainNode | null = null;
  private isEngineRunning: boolean = false;
  private currentIsMoving: boolean = false;
  private currentTerrain: TerrainType = 'normal';

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  // --- Context & Graph Setup with Master Compressor ---
  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }

    if (this.ctx && !this.masterCompressor) {
      const now = this.ctx.currentTime;

      // Master Dynamics Compressor: delivers arcade-grade punch, prevents clipping
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-14, now); // dB
      this.masterCompressor.knee.setValueAtTime(6, now);        // dB
      this.masterCompressor.ratio.setValueAtTime(8, now);        // 8:1 ratio
      this.masterCompressor.attack.setValueAtTime(0.003, now);   // 3ms attack
      this.masterCompressor.release.setValueAtTime(0.20, now);   // 200ms release

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, now);

      // Connect: Nodes -> masterGain -> masterCompressor -> destination
      this.masterGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.ctx.destination);
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private updateMenuBgmVolume() {
    if (this.menuBgmAudio) {
      this.menuBgmAudio.volume = this.isMuted ? 0 : Math.max(0, Math.min(1, this.masterVolume * this.bgmVolumeRatio));
    }
  }

  public unlockAudio() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.02
      );
    }
    this.updateMenuBgmVolume();
    if (this.isMuted) {
      this.stopEngineSound();
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.02
      );
    }
    this.updateMenuBgmVolume();
    if (this.isMuted) {
      this.stopEngineSound();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
    this.updateMenuBgmVolume();
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setBgmVolume(ratio: number) {
    this.bgmVolumeRatio = Math.max(0, Math.min(1, ratio));
    this.updateMenuBgmVolume();
  }

  public getBgmVolume(): number {
    return this.bgmVolumeRatio;
  }

  private getMasterNode(): AudioNode | null {
    this.initContext();
    if (!this.ctx || this.isMuted || !this.masterGain) return null;
    return this.masterGain;
  }

  // --- Utility: Generate Noise Buffer ---
  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- Utility: Generate Track Clatter Buffer (Mechanical Steel Shoe Pin Clicks) ---
  private createTrackClatterBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.0;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    const clickInterval = sampleRate / 13.5; // ~13.5 track pins per second

    for (let i = 0; i < data.length; i++) {
      const clickPhase = i % clickInterval;
      if (clickPhase < 260) {
        const decay = 1 - clickPhase / 260;
        const metalFreq = 680;
        const metal = Math.sin((clickPhase / sampleRate) * Math.PI * 2 * metalFreq);
        const noise = (Math.random() * 2 - 1) * 0.45;
        data[i] = (metal * 0.65 + noise * 0.35) * decay * 0.8;
      } else {
        data[i] = 0;
      }
    }
    return buffer;
  }

  // =========================================================================
  // 1. TANK ENGINE & TREAD SOUNDS (REALISTIC TURBO-DIESEL + STEEL TRACKS)
  // =========================================================================
  private startEngineGraph() {
    if (!this.ctx || this.isEngineRunning) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const master = this.getMasterNode();
    if (!master) return;

    try {
      // 1. Diesel Rumble (Triangle + Harmonic Sawtooth)
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(74, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(74, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);
      filter.Q.setValueAtTime(2.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now); // Starts completely silent

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc1.start(now);
      osc2.start(now);

      // 2. Mechanical Track Clanks
      const trackBuffer = this.createTrackClatterBuffer();
      if (trackBuffer) {
        const treadSrc = ctx.createBufferSource();
        treadSrc.buffer = trackBuffer;
        treadSrc.loop = true;

        const tFilter = ctx.createBiquadFilter();
        tFilter.type = 'bandpass';
        tFilter.frequency.setValueAtTime(650, now);
        tFilter.Q.setValueAtTime(1.8, now);

        const tGain = ctx.createGain();
        tGain.gain.setValueAtTime(0.0, now); // Starts completely silent

        treadSrc.connect(tFilter);
        tFilter.connect(tGain);
        tGain.connect(master);

        treadSrc.start(now);
        this.treadSource = treadSrc;
        this.treadFilter = tFilter;
        this.treadGain = tGain;
      }

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = filter;
      this.engineGain = gain;
      this.isEngineRunning = true;
    } catch {
      return;
    }
  }

  public updateEngineSound(isMoving: boolean, terrain: TerrainType = 'normal') {
    if (this.isMuted || !isMoving) {
      if (this.isEngineRunning) {
        this.stopEngineSound();
      }
      return;
    }
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    if (!this.isEngineRunning) {
      this.startEngineGraph();
    }

    // --- DRIVING: Real Turbo-Diesel Roar + Steel Track Shoe Clatter ---
    if (
      this.engineOsc1 &&
      this.engineOsc2 &&
      this.engineFilter &&
      this.engineGain &&
      this.treadSource &&
      this.treadFilter &&
      this.treadGain
    ) {
      if (terrain === 'mud') {
        // Deep laboring chug through thick mud: heavy resistance, slower tracks
        this.engineOsc1.frequency.setTargetAtTime(62, now, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(62, now, 0.05);
        this.engineFilter.frequency.setTargetAtTime(210, now, 0.05);
        this.engineGain.gain.setTargetAtTime(0.38, now, 0.03);
        this.treadSource.playbackRate.setTargetAtTime(0.70, now, 0.05);
        this.treadFilter.frequency.setTargetAtTime(450, now, 0.05);
        this.treadGain.gain.setTargetAtTime(0.18, now, 0.03);
      } else if (terrain === 'ice') {
        // Slipping engine rev on ice: higher frequency, fast spinning tracks
        this.engineOsc1.frequency.setTargetAtTime(92, now, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(92, now, 0.05);
        this.engineFilter.frequency.setTargetAtTime(450, now, 0.05);
        this.engineGain.gain.setTargetAtTime(0.30, now, 0.03);
        this.treadSource.playbackRate.setTargetAtTime(1.35, now, 0.05);
        this.treadFilter.frequency.setTargetAtTime(850, now, 0.05);
        this.treadGain.gain.setTargetAtTime(0.14, now, 0.03);
      } else {
        // Authentic military road driving: low turbo-diesel rumble + rhythmic steel track clicks
        this.engineOsc1.frequency.setTargetAtTime(74, now, 0.04);
        this.engineOsc2.frequency.setTargetAtTime(74, now, 0.04);
        this.engineFilter.frequency.setTargetAtTime(290, now, 0.04);
        this.engineGain.gain.setTargetAtTime(0.34, now, 0.03);
        this.treadSource.playbackRate.setTargetAtTime(1.0, now, 0.04);
        this.treadFilter.frequency.setTargetAtTime(650, now, 0.04);
        this.treadGain.gain.setTargetAtTime(0.24, now, 0.03);
      }
    }
  }

  public stopEngineSound() {
    if (this.engineGain && this.ctx) {
      try {
        this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {}
    }
    if (this.treadGain && this.ctx) {
      try {
        this.treadGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.treadGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {}
    }

    if (this.engineOsc1) {
      try {
        this.engineOsc1.stop();
        this.engineOsc1.disconnect();
      } catch {}
      this.engineOsc1 = null;
    }
    if (this.engineOsc2) {
      try {
        this.engineOsc2.stop();
        this.engineOsc2.disconnect();
      } catch {}
      this.engineOsc2 = null;
    }
    if (this.engineFilter) {
      try {
        this.engineFilter.disconnect();
      } catch {}
      this.engineFilter = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch {}
      this.engineGain = null;
    }
    if (this.treadSource) {
      try {
        this.treadSource.stop();
        this.treadSource.disconnect();
      } catch {}
      this.treadSource = null;
    }
    if (this.treadFilter) {
      try {
        this.treadFilter.disconnect();
      } catch {}
      this.treadFilter = null;
    }
    if (this.treadGain) {
      try {
        this.treadGain.disconnect();
      } catch {}
      this.treadGain = null;
    }
    this.isEngineRunning = false;
  }

  // =========================================================================
  // 2. HEAVY CANNON FIRE (SUB-BASS PUNCH + CONCUSSIVE CRACK + BREECH SNAP)
  // =========================================================================
  public playShoot() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Component A: Sub-bass transient kick (physical thump)
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(260, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    kickGain.gain.setValueAtTime(0.85, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    kick.connect(kickGain);
    kickGain.connect(master);
    kick.start(now);
    kick.stop(now + 0.09);

    // Component B: Concussive powder crack (bandpass noise)
    const noiseBuffer = this.createNoiseBuffer(0.12);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.11);
      filter.Q.setValueAtTime(2.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.70, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);
    }

    // Component C: Mechanical breech clack (classic arcade snap)
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'square';
    snap.frequency.setValueAtTime(920, now);
    snap.frequency.exponentialRampToValueAtTime(180, now + 0.04);

    snapGain.gain.setValueAtTime(0.40, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    snap.connect(snapGain);
    snapGain.connect(master);
    snap.start(now);
    snap.stop(now + 0.045);
  }

  // =========================================================================
  // 3. IMPACT & DESTRUCTION FX
  // =========================================================================

  // Brick Wall Crumble & Masonry Shatter (Loud, crunchy, unmistakable impact)
  public playHitBrick() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Initial shell kinetic impact punch (340Hz -> 80Hz in 60ms)
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(340, now);
    impact.frequency.exponentialRampToValueAtTime(80, now + 0.06);

    impactGain.gain.setValueAtTime(0.85, now);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    impact.connect(impactGain);
    impactGain.connect(master);
    impact.start(now);
    impact.stop(now + 0.065);

    // 2. Breaking masonry & mortar crunch (0 - 180ms)
    const noiseBuffer = this.createNoiseBuffer(0.18);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(1600, now);
      lowFilter.frequency.exponentialRampToValueAtTime(320, now + 0.17);
      lowFilter.Q.setValueAtTime(2.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.90, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(lowFilter);
      lowFilter.connect(gain);
      gain.connect(master);
      noise.start(now);
    }

    // 3. Crisp clay grit crackle
    const grit = ctx.createOscillator();
    const gritGain = ctx.createGain();
    grit.type = 'square';
    grit.frequency.setValueAtTime(650, now);
    grit.frequency.exponentialRampToValueAtTime(180, now + 0.04);

    gritGain.gain.setValueAtTime(0.50, now);
    gritGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    grit.connect(gritGain);
    gritGain.connect(master);
    grit.start(now);
    grit.stop(now + 0.045);
  }

  // Metallic Armor & Wall Ricochet Ping (Loud, sharp, ringing defiance)
  public playHitSteel() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Heavy Armor Plate Kinetic Slap (0 - 45ms)
    const slap = ctx.createOscillator();
    const slapGain = ctx.createGain();
    slap.type = 'square';
    slap.frequency.setValueAtTime(1450, now);
    slap.frequency.exponentialRampToValueAtTime(380, now + 0.04);

    slapGain.gain.setValueAtTime(0.80, now);
    slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    slap.connect(slapGain);
    slapGain.connect(master);
    slap.start(now);
    slap.stop(now + 0.045);

    // 2. Heavy steel mass thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(380, now);
    thud.frequency.exponentialRampToValueAtTime(110, now + 0.06);

    thudGain.gain.setValueAtTime(0.70, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(now);
    thud.stop(now + 0.06);

    // 3. Singing Ricochet Chime (0 - 240ms) (TCHIIINGGG!)
    const ring1 = ctx.createOscillator();
    const ring2 = ctx.createOscillator();
    const ringGain = ctx.createGain();

    ring1.type = 'sine';
    ring2.type = 'sine';
    ring1.frequency.setValueAtTime(1920, now);
    ring2.frequency.setValueAtTime(2580, now);

    ringGain.gain.setValueAtTime(0.65, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    ring1.connect(ringGain);
    ring2.connect(ringGain);
    ringGain.connect(master);

    ring1.start(now);
    ring2.start(now);
    ring1.stop(now + 0.22);
    ring2.stop(now + 0.22);
  }

  // Mid-air Bullet Clash
  public playBulletClash() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);

    oscGain.gain.setValueAtTime(0.60, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // =========================================================================
  // 4. EXPLOSIONS (MULTI-STAGE BLASTS)
  // =========================================================================

  // Small Explosion (Bullet collision, obstacle hit - punchy and crisp)
  public playExplosion() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Sub-kick thump
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(220, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.16);
    kickGain.gain.setValueAtTime(0.85, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    kick.connect(kickGain);
    kickGain.connect(master);
    kick.start(now);
    kick.stop(now + 0.16);

    // 2. Filtered noise crackle
    const noiseBuffer = this.createNoiseBuffer(0.22);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + 0.20);
      filter.Q.setValueAtTime(2.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      noise.start(now);
    }
  }

  // Big Explosion (Tank Annihilation: Majestic, Cinematic Arcade Blast)
  public playBigExplosion() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Stage 1: Earth-shaking sub-bass shockwave (0 - 400ms)
    const shockwave = ctx.createOscillator();
    const shockGain = ctx.createGain();
    shockwave.type = 'sine';
    shockwave.frequency.setValueAtTime(250, now);
    shockwave.frequency.exponentialRampToValueAtTime(26, now + 0.38);

    shockGain.gain.setValueAtTime(1.0, now);
    shockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

    shockwave.connect(shockGain);
    shockGain.connect(master);
    shockwave.start(now);
    shockwave.stop(now + 0.40);

    // Stage 2: Concussive Detonation Snap (0 - 70ms: violent initial crack)
    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crack.type = 'square';
    crack.frequency.setValueAtTime(840, now);
    crack.frequency.exponentialRampToValueAtTime(95, now + 0.065);

    crackGain.gain.setValueAtTime(0.80, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    crack.connect(crackGain);
    crackGain.connect(master);
    crack.start(now);
    crack.stop(now + 0.07);

    // Stage 3: Hollow Armored Hull Resonance (20 - 360ms: tank interior metal ring)
    const hullOsc = ctx.createOscillator();
    const hullGain = ctx.createGain();
    hullOsc.type = 'triangle';
    hullOsc.frequency.setValueAtTime(135, now);
    hullOsc.frequency.exponentialRampToValueAtTime(50, now + 0.35);

    hullGain.gain.setValueAtTime(0.70, now);
    hullGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    hullOsc.connect(hullGain);
    hullGain.connect(master);
    hullOsc.start(now);
    hullOsc.stop(now + 0.35);

    // Stage 4: Roaring Fireball Expansion (0 - 720ms: resonant sweeping firestorm)
    const noiseBuffer = this.createNoiseBuffer(0.72);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.68);
      filter.Q.setValueAtTime(3.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      noise.start(now);
    }

    // Stage 5: Debris & Shrapnel Flutter (40 - 520ms: flying metal fragments)
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(105, now + 0.04);
    rumble.frequency.exponentialRampToValueAtTime(25, now + 0.52);

    rumbleGain.gain.setValueAtTime(0.45, now + 0.04);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    rumble.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(now + 0.04);
    rumble.stop(now + 0.52);
  }

  // Catastrophic Base Eagle Destruction Blast (Long rolling thunder)
  public playEagleExplosion() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Massive seismic rumble
    const seismic = ctx.createOscillator();
    const seismicGain = ctx.createGain();
    seismic.type = 'sine';
    seismic.frequency.setValueAtTime(180, now);
    seismic.frequency.exponentialRampToValueAtTime(18, now + 1.2);

    seismicGain.gain.setValueAtTime(1.0, now);
    seismicGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    seismic.connect(seismicGain);
    seismicGain.connect(master);
    seismic.start(now);
    seismic.stop(now + 1.2);

    // Staggered secondary explosive detonations (+0.12s, +0.28s)
    [0.0, 0.14, 0.30].forEach((delay, idx) => {
      const buffer = this.createNoiseBuffer(0.9 - delay);
      if (buffer) {
        const n = ctx.createBufferSource();
        n.buffer = buffer;

        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(1800 - idx * 400, now + delay);
        f.frequency.exponentialRampToValueAtTime(35, now + delay + 0.85);
        f.Q.setValueAtTime(3.2, now + delay);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.85 - idx * 0.15, now + delay);
        g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.85);

        n.connect(f);
        f.connect(g);
        g.connect(master);
        n.start(now + delay);
      }
    });
  }

  // =========================================================================
  // 5. TACTICAL EQUIPMENT FX (SMOKE, GRENADE, SHIELD)
  // =========================================================================

  // Smoke Canister Deploy (Realistic pressurized venting hiss + cloud whoosh)
  public playSmokeDeploy() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Canister pin pop
    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'square';
    pop.frequency.setValueAtTime(680, now);
    pop.frequency.exponentialRampToValueAtTime(160, now + 0.04);

    popGain.gain.setValueAtTime(0.45, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    pop.connect(popGain);
    popGain.connect(master);
    pop.start(now);
    pop.stop(now + 0.045);

    // 2. Continuous pressurized gas venting (1.6 seconds of surging hissing)
    const noiseBuffer = this.createNoiseBuffer(1.6);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(650, now + 1.5);
      filter.Q.setValueAtTime(1.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.65, now + 0.08); // Fast pressure build-up
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      noise.start(now);
    }
  }

  // Bouncing Grenade (Heavy metallic impact thud in each bounce)
  public playGrenadeBounce() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Solid mass body thump
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(220, now);
    thud.frequency.exponentialRampToValueAtTime(65, now + 0.055);

    thudGain.gain.setValueAtTime(0.65, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(now);
    thud.stop(now + 0.055);

    // Metallic casing click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1150, now);
    click.frequency.exponentialRampToValueAtTime(450, now + 0.02);

    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    click.connect(clickGain);
    clickGain.connect(master);
    click.start(now);
    click.stop(now + 0.025);
  }

  // Deployable Shield Activated (High-tech energy barrier power-up hum)
  public playShieldDeploy() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Harmonic dual sweep
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    osc2.frequency.setValueAtTime(560, now);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18);

    gain.gain.setValueAtTime(0.50, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.20);
    osc2.stop(now + 0.20);
  }

  // Deployable Shield Hit (Plasma deflection pulse)
  public playShieldHit() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Deflection tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1350, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

    gain.gain.setValueAtTime(0.60, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.085);

    // Plasma sizzle
    const noiseBuffer = this.createNoiseBuffer(0.06);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(3.0, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.40, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(master);
      noise.start(now);
    }
  }

  // =========================================================================
  // 6. POWER-UPS & FANFARES
  // =========================================================================

  // Power-Up Spawn Bell Chime
  public playPowerUpSpawn() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const notes = [440, 554.37, 659.25, 880, 1108.7];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.48, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  // Power-Up Collect / Pickup Chime
  public playPowerUpCollect() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.045;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.42, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  // Stage Start Intro Jingle (Iconic NES Battle City melody with warm orchestration)
  public playStageStart() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const startTime = ctx.currentTime + 0.04;

    const melody: [number, number, number][] = [
      [261.63, 0.10, 0.00], // C4
      [329.63, 0.10, 0.11], // E4
      [392.00, 0.10, 0.22], // G4
      [523.25, 0.18, 0.33], // C5
      [392.00, 0.10, 0.53], // G4
      [523.25, 0.12, 0.65], // C5
      [659.25, 0.12, 0.78], // E5
      [783.99, 0.28, 0.91], // G5
      [1046.5, 0.35, 1.20], // C6 triumph
    ];

    melody.forEach(([freq, duration, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime + offset);

      gain.gain.setValueAtTime(0.48, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + duration);

      osc.connect(gain);
      gain.connect(master);

      osc.start(startTime + offset);
      osc.stop(startTime + offset + duration);
    });

    // Bass counterpoint
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

      gain.gain.setValueAtTime(0.44, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + duration);

      osc.connect(gain);
      gain.connect(master);

      osc.start(startTime + offset);
      osc.stop(startTime + offset + duration);
    });
  }

  // Game Over Fanfare
  public playGameOver() {
    this.stopEngineSound();
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
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

      gain.gain.setValueAtTime(0.50, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + duration);
    });
  }

  // Pause Blip
  public playPause() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1000, now + 0.04);

    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // UI Menu Cursor Move
  public playMenuMove() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(270, now + 0.035);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // UI Menu Select Confirmation
  public playMenuSelect() {
    const master = this.getMasterNode();
    if (!master || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.04);

    gain.gain.setValueAtTime(0.40, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // ==========================================
  // Authentic Menu Background Music (menu_bgm.ogg)
  // ==========================================
  public playMenuMusic() {
    this.isMenuBgmActive = true;
    if (typeof window === 'undefined') return;

    if (!window.__BATTLE_CITY_MENU_BGM__) {
      try {
        const audio = new Audio('./audio/menu_bgm.ogg');
        audio.loop = true;
        audio.preload = 'auto';
        window.__BATTLE_CITY_MENU_BGM__ = audio;
      } catch (err) {
        console.warn('Failed to initialize menu BGM Audio:', err);
        return;
      }
    }

    this.menuBgmAudio = window.__BATTLE_CITY_MENU_BGM__;
    this.updateMenuBgmVolume();

    if (this.menuBgmAudio && this.menuBgmAudio.paused) {
      const playPromise = this.menuBgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay policy prevented immediate playback
        });
      }
    }
  }

  public stopMenuMusic() {
    this.isMenuBgmActive = false;
    if (typeof window !== 'undefined' && window.__BATTLE_CITY_MENU_BGM__) {
      try {
        window.__BATTLE_CITY_MENU_BGM__.pause();
        window.__BATTLE_CITY_MENU_BGM__.currentTime = 0;
      } catch {}
    }
    if (this.menuBgmAudio) {
      try {
        this.menuBgmAudio.pause();
        this.menuBgmAudio.currentTime = 0;
      } catch {}
    }
  }

  public pauseMenuMusic() {
    this.isMenuBgmActive = false;
    if (typeof window !== 'undefined' && window.__BATTLE_CITY_MENU_BGM__) {
      try {
        window.__BATTLE_CITY_MENU_BGM__.pause();
      } catch {}
    }
    if (this.menuBgmAudio) {
      try {
        this.menuBgmAudio.pause();
      } catch {}
    }
  }

  public isMenuMusicPlaying(): boolean {
    const audio = this.menuBgmAudio || (typeof window !== 'undefined' ? window.__BATTLE_CITY_MENU_BGM__ : null);
    return this.isMenuBgmActive && !!audio && !audio.paused;
  }
}

export const soundManager = new SoundManager();
