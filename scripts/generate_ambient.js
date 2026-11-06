// Generates a 35-second atmospheric ambient synth drone WAV file
import fs from 'node:fs';

const sampleRate = 44100;
const durationSec = 35;
const numSamples = sampleRate * durationSec;
const numChannels = 2;
const bytesPerSample = 2; // 16-bit
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;

const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt subchunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // audio format (1 = PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // bits per sample

// data subchunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Generate lush ambient cyber drone (Root: D minor / Blueprint tech mood)
// D2 (73.4Hz), A2 (110Hz), D3 (146.8Hz), F3 (174.6Hz), A3 (220Hz), C4 (261.6Hz)
const freqs = [73.41, 110.0, 146.83, 174.61, 220.0, 261.63];

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  
  // Fade in first 2s, fade out last 3s
  let env = 1.0;
  if (t < 2.0) env = t / 2.0;
  else if (t > durationSec - 3.0) env = (durationSec - t) / 3.0;

  // LFO filter sweep (0.15 Hz slow breathing pulse)
  const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.12 * t);
  const lfo2 = 0.5 + 0.5 * Math.cos(2 * Math.PI * 0.08 * t);

  let sampleL = 0;
  let sampleR = 0;

  freqs.forEach((f, idx) => {
    const pan = (idx / (freqs.length - 1)) * 2 - 1; // -1 to 1
    const osc = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t);
    const gain = 0.12 * env * (idx === 0 ? 1.4 : 0.8) * (idx % 2 === 0 ? lfo : lfo2);
    
    sampleL += osc * gain * (1 - pan * 0.4);
    sampleR += osc * gain * (1 + pan * 0.4);
  });

  // Soft subtle tape hiss / cyber texture
  const noise = (Math.random() * 2 - 1) * 0.008 * env;
  sampleL += noise;
  sampleR += noise;

  // Clamp and convert to 16-bit integer
  const valL = Math.max(-1, Math.min(1, sampleL));
  const valR = Math.max(-1, Math.min(1, sampleR));

  const offset = 44 + i * blockAlign;
  buffer.writeInt16LE(Math.floor(valL * 32767), offset);
  buffer.writeInt16LE(Math.floor(valR * 32767), offset + 2);
}

fs.writeFileSync('apps/public/ambient_bg.wav', buffer);
fs.writeFileSync('public/ambient_bg.wav', buffer);
console.log('Generated apps/public/ambient_bg.wav & public/ambient_bg.wav (35s ambient tech pad)');
