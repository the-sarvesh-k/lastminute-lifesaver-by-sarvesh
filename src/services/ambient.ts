let audioCtx: AudioContext | null = null;
let currentNodes: {
  sources: AudioNode[];
  gainNode: GainNode;
} | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export const ambientSoundTypes = [
  { id: "none", name: "🤫 Silent Environment", description: "No ambient audio" },
  { id: "binaural", name: "🎧 Alpha Binaural Beats (10Hz)", description: "Synchronizes brain waves to high-flow state alpha frequencies" },
  { id: "noise", name: "🌊 White Noise (Ocean Breeze)", description: "Continuous water-like mask to completely block surrounding clutter" },
  { id: "space", name: "🚀 Deep Space Cozy Hum", description: "Low-frequency cosmic ship engine hum to isolate thoughts" },
  { id: "rhythm", name: "⏳ Pulsing Focus Metronome", description: "Ultra-subtle rhythmic click every 2 seconds to maintain tempo" }
] as const;

export type AmbientSoundId = typeof ambientSoundTypes[number]["id"];

export const startAmbientSound = (type: AmbientSoundId, volume: number) => {
  stopAmbientSound();

  if (type === "none") return;

  try {
    const ctx = getAudioContext();
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, ctx.currentTime);
    mainGain.connect(ctx.destination);

    const activeNodes: AudioNode[] = [];

    if (type === "binaural") {
      // Channel Merger for stereo binaural separation
      const merger = ctx.createChannelMerger(2);

      // Left Channel: 200Hz Sine Wave
      const oscL = ctx.createOscillator();
      oscL.type = "sine";
      oscL.frequency.setValueAtTime(200, ctx.currentTime);
      const pannerL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerL) {
        pannerL.pan.setValueAtTime(-1, ctx.currentTime);
        oscL.connect(pannerL);
        pannerL.connect(mainGain);
        activeNodes.push(pannerL);
      } else {
        oscL.connect(mainGain);
      }
      oscL.start();
      activeNodes.push(oscL);

      // Right Channel: 210Hz Sine Wave (creating a 10Hz Alpha beat)
      const oscR = ctx.createOscillator();
      oscR.type = "sine";
      oscR.frequency.setValueAtTime(210, ctx.currentTime);
      const pannerR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerR) {
        pannerR.pan.setValueAtTime(1, ctx.currentTime);
        oscR.connect(pannerR);
        pannerR.connect(mainGain);
        activeNodes.push(pannerR);
      } else {
        oscR.connect(mainGain);
      }
      oscR.start();
      activeNodes.push(oscR);

      // Add a third warm lower carrier hum (100Hz) to make it smooth and relaxing
      const baseHum = ctx.createOscillator();
      baseHum.type = "triangle";
      baseHum.frequency.setValueAtTime(100, ctx.currentTime);
      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(0.4, ctx.currentTime);
      baseHum.connect(humGain);
      humGain.connect(mainGain);
      baseHum.start();
      activeNodes.push(baseHum, humGain);

    } else if (type === "noise") {
      // Synthesize noise buffer
      const bufferSize = ctx.sampleRate * 2; // 2 seconds of sound
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Apply low-pass filter formula for warm/pinkish ocean noise
        output[i] = (lastOut * 0.95 + white * 0.05);
        lastOut = output[i];
        // Scale it
        output[i] *= 3.5;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // Add lowpass filter to make it softer
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, ctx.currentTime);

      // LFO modulation to simulate ocean wave swelling
      const oscWave = ctx.createOscillator();
      oscWave.type = "sine";
      oscWave.frequency.setValueAtTime(0.12, ctx.currentTime); // 1 cycle every ~8 seconds

      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.35, ctx.currentTime); // base volume modifier

      // Connect LFO to gain to modulate ocean breath
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.2, ctx.currentTime); // swelling amplitude
      oscWave.connect(lfoGain);
      lfoGain.connect(waveGain.gain);

      noiseSource.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(mainGain);

      noiseSource.start();
      oscWave.start();

      activeNodes.push(noiseSource, oscWave, filter, waveGain, lfoGain);

    } else if (type === "space") {
      // Cosmic ship hum: deep carrier frequencies modulated by slow LFOs
      const carrier1 = ctx.createOscillator();
      carrier1.type = "sawtooth";
      carrier1.frequency.setValueAtTime(65, ctx.currentTime); // Low C

      const filter1 = ctx.createBiquadFilter();
      filter1.type = "lowpass";
      filter1.frequency.setValueAtTime(120, ctx.currentTime);

      const carrier2 = ctx.createOscillator();
      carrier2.type = "triangle";
      carrier2.frequency.setValueAtTime(98, ctx.currentTime); // Low G

      const filter2 = ctx.createBiquadFilter();
      filter2.type = "lowpass";
      filter2.frequency.setValueAtTime(150, ctx.currentTime);

      // Slow volume drift
      const volumeMod = ctx.createOscillator();
      volumeMod.type = "sine";
      volumeMod.frequency.setValueAtTime(0.08, ctx.currentTime); // 12 second cycle
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(0.15, ctx.currentTime);
      volumeMod.connect(modGain);

      const mergerGain = ctx.createGain();
      mergerGain.gain.setValueAtTime(0.6, ctx.currentTime);
      modGain.connect(mergerGain.gain);

      carrier1.connect(filter1);
      carrier2.connect(filter2);
      filter1.connect(mergerGain);
      filter2.connect(mergerGain);
      mergerGain.connect(mainGain);

      carrier1.start();
      carrier2.start();
      volumeMod.start();

      activeNodes.push(carrier1, filter1, carrier2, filter2, volumeMod, modGain, mergerGain);

    } else if (type === "rhythm") {
      // Pulsing click track using short triangle waves triggered by a scheduled interval
      let nextClickTime = ctx.currentTime;
      const scheduleClick = () => {
        const timeToNext = nextClickTime - ctx.currentTime;
        if (timeToNext < 0.1) {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(600, nextClickTime);
          
          const clickGain = ctx.createGain();
          clickGain.gain.setValueAtTime(0.08, nextClickTime);
          clickGain.gain.exponentialRampToValueAtTime(0.001, nextClickTime + 0.08);
          
          osc.connect(clickGain);
          clickGain.connect(mainGain);
          osc.start(nextClickTime);
          osc.stop(nextClickTime + 0.1);

          nextClickTime += 2.0; // every 2 seconds
        }
      };

      // Periodic poller for continuous rhythm schedule
      const rhythmInterval = setInterval(scheduleClick, 200);
      const clearDummyNode = {
        disconnect: () => clearInterval(rhythmInterval)
      } as any;
      activeNodes.push(clearDummyNode);
    }

    currentNodes = {
      sources: activeNodes,
      gainNode: mainGain
    };

  } catch (error) {
    console.error("Failed to start ambient synthesizer:", error);
  }
};

export const setAmbientVolume = (volume: number) => {
  if (currentNodes?.gainNode) {
    currentNodes.gainNode.gain.setValueAtTime(volume, getAudioContext().currentTime);
  }
};

export const stopAmbientSound = () => {
  if (currentNodes) {
    currentNodes.sources.forEach(node => {
      try {
        if ("stop" in node && typeof (node as any).stop === "function") {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {
        // Safe check
      }
    });
    currentNodes.gainNode.disconnect();
    currentNodes = null;
  }
};
