/**
 * Pure Web Audio API Sound Synthesizer Engine
 * No external sound files required — instant, reliable, zero-latency audio.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.motorOsc1 = null;
    this.motorOsc2 = null;
    this.motorGain = null;
    this.motorFilter = null;
    this.motorStarted = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.motorGain && this.ctx) {
      this.motorGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  startMotor() {
    this.ensureContext();
    if (!this.ctx || this.motorStarted) return;

    try {
      // Sub-bass motor oscillator (sine)
      this.motorOsc1 = this.ctx.createOscillator();
      this.motorOsc1.type = 'sawtooth';
      this.motorOsc1.frequency.setValueAtTime(32, this.ctx.currentTime);

      // Higher harmonic motor whine (triangle)
      this.motorOsc2 = this.ctx.createOscillator();
      this.motorOsc2.type = 'triangle';
      this.motorOsc2.frequency.setValueAtTime(64, this.ctx.currentTime);

      // Lowpass filter for electric engine muffled resonance
      this.motorFilter = this.ctx.createBiquadFilter();
      this.motorFilter.type = 'lowpass';
      this.motorFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
      this.motorFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      // Master motor gain
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);

      this.motorOsc1.connect(this.motorFilter);
      this.motorOsc2.connect(this.motorFilter);
      this.motorFilter.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);

      this.motorOsc1.start();
      this.motorOsc2.start();
      this.motorStarted = true;
    } catch (e) {
      console.warn("Audio motor start failed:", e);
    }
  }

  updateMotor(speed, maxSpeed = 3.0) {
    if (!this.motorStarted || !this.ctx || this.isMuted) return;
    const ratio = Math.min(1.0, Math.max(0.0, Math.abs(speed) / maxSpeed));
    const now = this.ctx.currentTime;

    // Shift pitch based on rover speed
    const baseFreq = 30 + ratio * 75;
    this.motorOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.motorOsc2.frequency.setTargetAtTime(baseFreq * 2.2, now, 0.08);
    this.motorFilter.frequency.setTargetAtTime(150 + ratio * 550, now, 0.08);
    this.motorGain.gain.setTargetAtTime(0.025 + ratio * 0.05, now, 0.08);
  }

  // Playful Microduck-style Quack / Horn
  playQuack() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.32);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.Q.setValueAtTime(4.0, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  // Snappy retro mechanical click
  playClick() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Ascending 3-tone chime for mission launch
  playMissionStart() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  // Collision thump when bumping the arena ball
  playBump() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const soundEngine = new SoundEngine();
