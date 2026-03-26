export class AudioManager {
    ctx: AudioContext | null = null;
    humOsc: OscillatorNode | null = null;
    humGain: GainNode | null = null;
    servoOsc: OscillatorNode | null = null;
    servoGain: GainNode | null = null;
    
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Reactor hum
            this.humOsc = this.ctx.createOscillator();
            this.humOsc.type = 'triangle';
            this.humOsc.frequency.value = 40;
            this.humGain = this.ctx.createGain();
            this.humGain.gain.value = 0.1;
            this.humOsc.connect(this.humGain);
            this.humGain.connect(this.ctx.destination);
            this.humOsc.start();
            
            // Servo whine
            this.servoOsc = this.ctx.createOscillator();
            this.servoOsc.type = 'sawtooth';
            this.servoOsc.frequency.value = 200;
            this.servoGain = this.ctx.createGain();
            this.servoGain.gain.value = 0;
            this.servoOsc.connect(this.servoGain);
            this.servoGain.connect(this.ctx.destination);
            this.servoOsc.start();
        }
    }

    update(torsoTurnSpeed: number) {
        if (!this.ctx || !this.servoGain || !this.servoOsc) return;
        
        const targetGain = Math.min(0.1, Math.abs(torsoTurnSpeed) * 0.05);
        this.servoGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        
        const targetFreq = 200 + Math.abs(torsoTurnSpeed) * 100;
        this.servoOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    playFootstep(mass: number) {
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        
        // Low frequency impact
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        const baseFreq = Math.max(20, 100 - mass * 0.5); // Heavier = lower pitch
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + 0.3);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.3);

        // Noise burst for crunch
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noise.start(time);
    }
}
