import type { VisualEvent } from '../core/types';

/** Small synthesized sound palette. AudioContext is created only after a user gesture. */
export class AudioBus {
  private context?: AudioContext;
  private gain?: GainNode;
  private lastHit = 0;
  enabled = true;

  unlock(): void {
    if (!this.context) { this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.gain.value = .15; this.gain.connect(this.context.destination); }
    void this.context.resume();
  }
  toggle(): boolean { this.enabled = !this.enabled; return this.enabled; }
  play(event: VisualEvent): void {
    if (!this.enabled || !this.context || !this.gain) return;
    const time = this.context.currentTime;
    if (event.type === 'hit' && time - this.lastHit < .085) return;
    const preset: Partial<Record<VisualEvent['type'], [number, number, number, OscillatorType]>> = {
      hit: [event.critical ? 230 : 130, 55, .07, 'triangle'], death: [90, 30, .1, 'triangle'],
      lightning: [740, 140, .12, 'sawtooth'], dash: [260, 600, .12, 'sine'],
      burst: [110, 650, .4, 'triangle'], execute:[78,520,.32,'sawtooth'],interrupt:[960,180,.24,'triangle'], loot: event.color===0xefb75c ? [660, 1760, .85, 'sine'] : [520, 1040, .35, 'sine'], heal: [320, 640, .35, 'sine'],
    };
    const p = preset[event.type]; if (!p) return;
    if (event.type === 'hit') this.lastHit = time;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = p[3]; oscillator.frequency.setValueAtTime(p[0], time); oscillator.frequency.exponentialRampToValueAtTime(p[1], time + p[2]);
    envelope.gain.setValueAtTime(event.type === 'lightning' ? .025 : .18, time); envelope.gain.exponentialRampToValueAtTime(.001, time + p[2]);
    oscillator.connect(envelope); envelope.connect(this.gain); oscillator.start(time); oscillator.stop(time + p[2] + .02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
}
