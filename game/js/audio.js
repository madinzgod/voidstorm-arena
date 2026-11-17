// All of VOIDSTORM's sound is synthesised with WebAudio — no audio files.
// Short oscillator and noise voices make the effects; a lookahead scheduler
// loops a driving bass-and-arpeggio pattern under the action. The engine
// stays silent until the player's first click or keypress unlocks audio.

const MUSIC_BPM = 112;
const BASS_LINE = [55, 55, 0, 55, 65.41, 0, 55, 55, 49, 49, 0, 49, 73.42, 0, 82.41, 0];
const ARP_NOTES = [220, 261.63, 329.63, 440, 329.63, 261.63, 293.66, 392];

export class SoundEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.stepIndex = 0;
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.context.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone({ frequency, endFrequency, type = 'square', seconds = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain).connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  noiseBurst({ seconds = 0.3, volume = 0.3, filterFrequency = 1200, delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start(t0);
  }

  playShoot() {
    this.tone({ frequency: 880 + Math.random() * 120, endFrequency: 320, type: 'square', seconds: 0.07, volume: 0.07 });
  }

  playEnemyHit() {
    this.tone({ frequency: 300 + Math.random() * 60, endFrequency: 180, type: 'triangle', seconds: 0.05, volume: 0.08 });
  }

  playExplosion(big = false) {
    this.noiseBurst({ seconds: big ? 0.55 : 0.28, volume: big ? 0.42 : 0.24, filterFrequency: big ? 700 : 1100 });
    this.tone({ frequency: big ? 130 : 170, endFrequency: 38, type: 'sine', seconds: big ? 0.5 : 0.3, volume: 0.3 });
  }

  playPlayerHurt() {
    this.tone({ frequency: 210, endFrequency: 60, type: 'sawtooth', seconds: 0.22, volume: 0.26 });
    this.noiseBurst({ seconds: 0.15, volume: 0.16, filterFrequency: 2400 });
  }

  playDash() {
    this.noiseBurst({ seconds: 0.16, volume: 0.1, filterFrequency: 3200 });
    this.tone({ frequency: 240, endFrequency: 720, type: 'sine', seconds: 0.14, volume: 0.08 });
  }

  playPickup() {
    this.tone({ frequency: 660, type: 'triangle', seconds: 0.09, volume: 0.16 });
    this.tone({ frequency: 990, type: 'triangle', seconds: 0.12, volume: 0.16, delay: 0.07 });
  }

  playWaveStart() {
    this.tone({ frequency: 392, type: 'square', seconds: 0.1, volume: 0.12 });
    this.tone({ frequency: 587, type: 'square', seconds: 0.16, volume: 0.12, delay: 0.09 });
  }

  playBossAlarm() {
    for (let i = 0; i < 3; i++) {
      this.tone({ frequency: 146, endFrequency: 110, type: 'sawtooth', seconds: 0.18, volume: 0.2, delay: i * 0.24 });
    }
  }

  playGameOver() {
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((frequency, i) => {
      this.tone({ frequency, type: 'triangle', seconds: 0.3, volume: 0.2, delay: i * 0.22 });
    });
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, i) => {
      this.tone({ frequency, type: 'square', seconds: 0.22, volume: 0.14, delay: i * 0.13 });
    });
  }

  startMusic() {
    if (!this.context || this.musicTimer) return;
    this.stepIndex = 0;
    this.nextNoteTime = this.context.currentTime + 0.06;
    const secondsPerStep = 60 / MUSIC_BPM / 2;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(secondsPerStep), 40);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleMusic(secondsPerStep) {
    if (!this.context) return;
    while (this.nextNoteTime < this.context.currentTime + 0.14) {
      this.playMusicStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += secondsPerStep;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  playMusicStep(step, t0) {
    if (this.muted) return;
    const bass = BASS_LINE[step % BASS_LINE.length];
    if (bass && step % 2 === 0) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = bass;
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.setValueAtTime(0.16, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(filter).connect(gain).connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    }
    if (step % 4 === 2) {
      const note = ARP_NOTES[(step >> 2) % ARP_NOTES.length];
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      osc.connect(gain).connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    }
    if (step % 2 === 1) {
      const length = Math.floor(this.context.sampleRate * 0.03);
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.05, t0);
      source.connect(filter).connect(gain).connect(this.masterGain);
      source.start(t0);
    }
  }
}
