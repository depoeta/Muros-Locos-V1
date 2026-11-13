/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de audio sintetizado (Web Audio API) aislado para Candado.
 */

class CandadoAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // ignorar si el navegador bloquea audio
    }
  }

  public playDigitInput() {
    this.tone(540, 0.055, 'triangle', 0.06);
  }

  public playDialTick() {
    this.tone(420, 0.04, 'sine', 0.045);
  }

  public playDelete() {
    this.tone(310, 0.06, 'sine', 0.05);
  }

  public playError() {
    this.tone(210, 0.12, 'sawtooth', 0.05);
    this.tone(175, 0.14, 'sawtooth', 0.045, 0.07);
  }

  public playAttemptCheck(exactos: number) {
    if (exactos > 0) {
      this.tone(523.25, 0.08, 'triangle', 0.07);
      this.tone(659.25, 0.09, 'triangle', 0.07, 0.07);
    } else {
      this.tone(360, 0.08, 'sine', 0.055);
      this.tone(300, 0.09, 'sine', 0.05, 0.06);
    }
  }

  public playUnlock() {
    this.tone(523.25, 0.11, 'triangle', 0.09, 0);
    this.tone(659.25, 0.11, 'triangle', 0.09, 0.08);
    this.tone(783.99, 0.12, 'triangle', 0.09, 0.16);
    this.tone(1046.5, 0.28, 'triangle', 0.1, 0.24);
  }

  public playLockFail() {
    this.tone(293.66, 0.14, 'triangle', 0.08, 0);
    this.tone(246.94, 0.15, 'triangle', 0.08, 0.12);
    this.tone(196.0, 0.25, 'sawtooth', 0.055, 0.24);
  }
}

export const candadoAudio = new CandadoAudioEngine();
