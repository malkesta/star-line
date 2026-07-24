function drawStarPath(ctx, cx, cy, outerRadius, innerRadius, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;

    this.music = null;
    this.musicUrl = "../../assets/audio/game1.mp3";
    this.musicStarted = false;
    this.musicFadeRaf = null;
    this.musicDefaultVolume = 0.18;
    this.musicOverlayVolume = this.musicDefaultVolume * 0.38;

    this.lastCatchTime = 0;
    this.lastScoreTime = 0;
    this.lastHitTime = 0;
    this.lastEatTime = 0; 
    this.lastRingGoneTime = 0;
    this.lastStarletSpawnTime = 0;
  }

  setMusic(url) {
    if (!url || this.musicUrl === url) return;

    this.stopAmbient();
    this.musicUrl = url;

    if (this.music) {
      this.music.pause();
      this.music.removeAttribute("src");
      this.music.load?.();
      this.music = null;
    }

    this.musicStarted = false;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);

      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
    }

    if (!this.music) {
      const musicUrl = new URL(this.musicUrl, import.meta.url);
      this.music = new Audio(musicUrl.href);
      this.music.preload = "auto";
      this.music.loop = true;
      this.music.volume = this.musicDefaultVolume;
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  createReverb(seconds = 2.8, decay = 2.6) {
    const rate = this.ctx.sampleRate;
    const length = rate * seconds;
    const impulse = this.ctx.createBuffer(2, length, rate);

    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const n = Math.random() * 2 - 1;
        data[i] = n * Math.pow(1 - i / length, decay);
      }
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  startAmbient({ restart = true, volume = this.musicDefaultVolume } = {}) {
    if (!this.music) return;

    if (this.musicFadeRaf) {
      cancelAnimationFrame(this.musicFadeRaf);
      this.musicFadeRaf = null;
    }

    const targetVolume = Math.max(0, Math.min(this.musicDefaultVolume, volume));

    if (restart) {
      this.music.pause();
      this.music.currentTime = 0;
    }

    this.music.volume = targetVolume;

    const playPromise = this.music.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.warn("Music playback blocked:", err);
      });
    }

    this.musicStarted = true;
  }

  fadeMusicTo(targetVolume = 0, duration = 4) {
    if (!this.music) return Promise.resolve();

    const clampedTarget = Math.max(0, Math.min(this.musicDefaultVolume, targetVolume));

    if (this.musicFadeRaf) {
      cancelAnimationFrame(this.musicFadeRaf);
      this.musicFadeRaf = null;
    }

    const startVolume = this.music.volume;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        if (!this.music) {
          resolve();
          return;
        }

        const elapsed = (now - startTime) / 1000;
        const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);

        this.music.volume = startVolume + (clampedTarget - startVolume) * eased;

        if (t < 1) {
          this.musicFadeRaf = requestAnimationFrame(step);
        } else {
          this.music.volume = clampedTarget;
          this.musicFadeRaf = null;

          if (clampedTarget <= 0.0001) {
            this.music.pause();
            this.music.currentTime = 0;
            this.musicStarted = false;
          }

          resolve();
        }
      };

      this.musicFadeRaf = requestAnimationFrame(step);
    });
  }

  fadeOutAmbient(duration = 4) {
    return this.fadeMusicTo(0, duration);
  }

  duckAmbientForOverlay(duration = 4) {
    return this.fadeMusicTo(this.musicOverlayVolume, duration);
  }

  resetAmbient() {
    if (!this.music) return;

    if (this.musicFadeRaf) {
      cancelAnimationFrame(this.musicFadeRaf);
      this.musicFadeRaf = null;
    }

    this.music.pause();
    this.music.currentTime = 0;
    this.music.volume = this.musicDefaultVolume;
    this.musicStarted = false;
  }

  stopAmbient() {
    if (!this.music) return;

    if (this.musicFadeRaf) {
      cancelAnimationFrame(this.musicFadeRaf);
      this.musicFadeRaf = null;
    }

    this.music.pause();
    this.music.currentTime = 0;
    this.music.volume = this.musicDefaultVolume;
    this.musicStarted = false;
  }

  playCatchSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastCatchTime < 0.07) return;
    this.lastCatchTime = now;

    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.12);

    mod.type = "sine";
    mod.frequency.value = 18;
    modGain.gain.value = 8;

    filter.type = "highpass";
    filter.frequency.value = 500;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.018, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.18);
    mod.stop(now + 0.18);
  }

  playScoreSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastScoreTime < 0.1) return;
    this.lastScoreTime = now;

    const reverb = this.createReverb(1.8, 2.2);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;
    reverb.connect(wet);
    wet.connect(this.master);

    const notes = [1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.015);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.24 + i * 0.015);

      gain.gain.setValueAtTime(0.0001, now + i * 0.015);
      gain.gain.linearRampToValueAtTime(0.04 - i * 0.01, now + 0.02 + i * 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.015);

      osc.connect(gain);
      gain.connect(this.master);
      gain.connect(reverb);

      osc.start(now + i * 0.015);
      osc.stop(now + 0.38 + i * 0.015);
    });
  }

  playHitSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastHitTime < 0.09) return;
    this.lastHitTime = now;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const band = this.ctx.createBiquadFilter();

    osc.type = "triangle";
    osc2.type = "square";

    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.14);

    osc2.frequency.setValueAtTime(1880, now);
    osc2.frequency.exponentialRampToValueAtTime(720, now + 0.11);

    band.type = "bandpass";
    band.frequency.value = 1800;
    band.Q.value = 2.4;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(band);
    osc2.connect(band);
    band.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.18);
    osc2.stop(now + 0.18);
  }

  // РќРћР’РћР•: Р·РІСѓРє РїРѕРµРґР°РЅРёСЏ СЃС‚Р°СЂР»РµС‚Р° Р°РєС‚РёРІРЅС‹Рј РєРѕРјР±Рѕ (С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР° + РєСЂР°СЃРЅРѕРµ РєРѕР»СЊС†Рѕ).
  // РўС‘РјРЅС‹Р№ "РІСЃР°СЃС‹РІР°СЋС‰РёР№" РіР»РѕС‚РѕРє: РЅРёР·РєР°СЏ РїР°РґР°СЋС‰Р°СЏ СЃРёРЅСѓСЃРѕРёРґР° + РєРѕСЂРѕС‚РєРёР№ РєСЂР°СЃРЅС‹Р№
  // "Р±Р»РёРє" СЃРІРµСЂС…Сѓ, РјСЏРіРєР°СЏ СЂРµРІРµСЂР±РµСЂР°С†РёСЏ. РЎРґРµР»Р°РЅ РІ РѕРґРЅРѕРј СЃРµРјРµР№СЃС‚РІРµ СЃ РѕСЃС‚Р°Р»СЊРЅС‹РјРё.
  playEatSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastEatTime < 0.06) return;
    this.lastEatTime = now;

    const reverb = this.createReverb(1.4, 2.4);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.16;
    reverb.connect(wet);
    wet.connect(this.master);

    // РќРёР¶РЅРёР№ "РіР»РѕС‚РѕРє" вЂ” РІСЃР°СЃС‹РІР°СЋС‰РµРµ РїР°РґРµРЅРёРµ С‚РѕРЅР°.
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    const subFilter = this.ctx.createBiquadFilter();

    sub.type = "sine";
    sub.frequency.setValueAtTime(360, now);
    sub.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    subFilter.type = "lowpass";
    subFilter.frequency.value = 900;

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.05, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.master);
    subGain.connect(reverb);

    sub.start(now);
    sub.stop(now + 0.3);

    // Р’РµСЂС…РЅРёР№ РєРѕСЂРѕС‚РєРёР№ "РєСЂР°СЃРЅС‹Р№" Р±Р»РёРє вЂ” Р»С‘РіРєР°СЏ РёСЃРєСЂР° РїСЂРё Р·Р°С…РІР°С‚Рµ.
    const spark = this.ctx.createOscillator();
    const sparkGain = this.ctx.createGain();
    const sparkBand = this.ctx.createBiquadFilter();

    spark.type = "triangle";
    spark.frequency.setValueAtTime(760, now);
    spark.frequency.exponentialRampToValueAtTime(520, now + 0.1);

    sparkBand.type = "bandpass";
    sparkBand.frequency.value = 640;
    sparkBand.Q.value = 1.6;

    sparkGain.gain.setValueAtTime(0.0001, now);
    sparkGain.gain.linearRampToValueAtTime(0.022, now + 0.008);
    sparkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    spark.connect(sparkBand);
    sparkBand.connect(sparkGain);
    sparkGain.connect(this.master);

    spark.start(now);
    spark.stop(now + 0.16);
  }

  
playRingGoneSound() {
  if (!this.ctx) return;
  const now = this.now();
  if (now - this.lastRingGoneTime < 0.18) return;
  this.lastRingGoneTime = now;

  const masterGain = this.ctx.createGain();
  masterGain.gain.value = 1.08;
  masterGain.connect(this.master);

  const reverb = this.createReverb(6.8, 3.8);
  const wet = this.ctx.createGain();
  wet.gain.value = 0.52;
  reverb.connect(wet);
  wet.connect(this.master);

  const highpass = this.ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 70;

  const lowpass = this.ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2200;

  const presence = this.ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 820;
  presence.Q.value = 1.1;
  presence.gain.value = 2.8;

  highpass.connect(presence);
  presence.connect(lowpass);
  lowpass.connect(masterGain);
  lowpass.connect(reverb);

  const partials = [
    { type: "sine",     freq: 220, gain: 0.24, attack: 0.010, decay: 4.8, drift: 0.989, vibrato: 4.0, vibDepth: 6 },
    { type: "triangle", freq: 330, gain: 0.19, attack: 0.008, decay: 4.3, drift: 0.990, vibrato: 4.6, vibDepth: 7 },
    { type: "sine",     freq: 495, gain: 0.13, attack: 0.007, decay: 3.7, drift: 0.992, vibrato: 5.0, vibDepth: 8 },
    { type: "triangle", freq: 740, gain: 0.080, attack: 0.006, decay: 2.9, drift: 0.994, vibrato: 5.4, vibDepth: 8 },
    { type: "sine",     freq: 1110, gain: 0.040, attack: 0.005, decay: 2.1, drift: 0.996, vibrato: 6.0, vibDepth: 7 },
  ];

  partials.forEach(({ type, freq, gain, attack, decay, drift, vibrato, vibDepth }) => {
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const band = this.ctx.createBiquadFilter();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * drift, now + decay);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(vibrato, now);
    lfoGain.gain.setValueAtTime(vibDepth, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    band.type = "bandpass";
    band.frequency.value = freq;
    band.Q.value = freq < 500 ? 2.1 : 3.0;

    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.linearRampToValueAtTime(gain, now + attack);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(band);
    band.connect(oscGain);
    oscGain.connect(highpass);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + decay + 0.08);
    lfo.stop(now + decay + 0.08);
  });

  const snap = this.ctx.createBufferSource();
  const snapBuffer = this.ctx.createBuffer(
    1,
    Math.floor(this.ctx.sampleRate * 0.05),
    this.ctx.sampleRate
  );
  const snapData = snapBuffer.getChannelData(0);

  for (let i = 0; i < snapData.length; i++) {
    const t = i / snapData.length;
    snapData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 5.6) * 0.28;
  }

  snap.buffer = snapBuffer;

  const snapFilter = this.ctx.createBiquadFilter();
  snapFilter.type = "bandpass";
  snapFilter.frequency.value = 1200;
  snapFilter.Q.value = 1.0;

  const snapGain = this.ctx.createGain();
  snapGain.gain.setValueAtTime(0.0001, now);
  snapGain.gain.linearRampToValueAtTime(0.030, now + 0.003);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

  snap.connect(snapFilter);
  snapFilter.connect(snapGain);
  snapGain.connect(masterGain);
  snapGain.connect(reverb);

  snap.start(now);

  const tail = this.ctx.createOscillator();
  const tailGain = this.ctx.createGain();
  const tailFilter = this.ctx.createBiquadFilter();
  const tailLfo = this.ctx.createOscillator();
  const tailLfoGain = this.ctx.createGain();

  tail.type = "triangle";
  tail.frequency.setValueAtTime(250, now + 0.04);
  tail.frequency.exponentialRampToValueAtTime(205, now + 4.8);

  tailLfo.type = "sine";
  tailLfo.frequency.setValueAtTime(3.4, now);
  tailLfoGain.gain.setValueAtTime(12, now);
  tailLfo.connect(tailLfoGain);
  tailLfoGain.connect(tail.frequency);

  tailFilter.type = "bandpass";
  tailFilter.frequency.value = 300;
  tailFilter.Q.value = 1.2;

  tailGain.gain.setValueAtTime(0.0001, now + 0.04);
  tailGain.gain.linearRampToValueAtTime(0.10, now + 0.09);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);

  tail.connect(tailFilter);
  tailFilter.connect(tailGain);
  tailGain.connect(masterGain);
  tailGain.connect(reverb);

  tail.start(now + 0.04);
  tailLfo.start(now + 0.04);
  tail.stop(now + 5.1);
  tailLfo.stop(now + 5.1);

  const shadow = this.ctx.createOscillator();
  const shadowGain = this.ctx.createGain();
  const shadowFilter = this.ctx.createBiquadFilter();

  shadow.type = "sine";
  shadow.frequency.setValueAtTime(110, now + 0.06);
  shadow.frequency.exponentialRampToValueAtTime(82, now + 3.8);

  shadowFilter.type = "lowpass";
  shadowFilter.frequency.value = 180;

  shadowGain.gain.setValueAtTime(0.0001, now + 0.06);
  shadowGain.gain.linearRampToValueAtTime(0.045, now + 0.12);
  shadowGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.9);

  shadow.connect(shadowFilter);
  shadowFilter.connect(shadowGain);
  shadowGain.connect(masterGain);
  shadowGain.connect(reverb);

  shadow.start(now + 0.06);
  shadow.stop(now + 4.0);
}

playStarletSpawnSound() {
  if (!this.ctx) return;

  const now = this.now();
  if (now - this.lastStarletSpawnTime < 0.12) return;
  this.lastStarletSpawnTime = now;

  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();
  const filter = this.ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(740, now);
  osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);

  filter.type = 'highpass';
  filter.frequency.value = 900;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.02, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(this.master);

  osc.start(now);
  osc.stop(now + 0.16);
}

  playGameOverSound() {
    if (!this.ctx) return;
    const now = this.now();

    const reverb = this.createReverb(3.8, 2.8);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.28;
    reverb.connect(wet);
    wet.connect(this.master);

    const notes = [1174.66, 1567.98, 2093.0];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      mod.type = "sine";
      mod.frequency.value = 9 + i * 2;
      modGain.gain.value = 10 - i * 2;

      gain.gain.setValueAtTime(0.0001, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.035 - i * 0.007, now + 0.04 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1 + i * 0.08);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.master);
      gain.connect(reverb);

      osc.start(now + i * 0.05);
      mod.start(now + i * 0.05);
      osc.stop(now + 1.2 + i * 0.08);
      mod.stop(now + 1.2 + i * 0.08);
    });
  }
}

// ============================================================================
//  Blacklet вЂ” РµРґРёРЅСЃС‚РІРµРЅРЅР°СЏ "С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР°" РЅР° СЃС†РµРЅРµ. РџРѕСЃС‚РѕСЏРЅРЅР° (РЅРµ РёСЃС‡РµР·Р°РµС‚).
//
//  РЎРѕСЃС‚РѕСЏРЅРёСЏ: forming в†’ ready в†’ linked
//    forming  вЂ” РїСЂРµРІСЂР°С‰Р°РµС‚СЃСЏ РёР· Р¶С‘Р»С‚РѕР№ (РєР°Рє СЃС‚Р°СЂР»РµС‚) РІ РєСЂР°СЃРЅСѓСЋ, Р·Р°С‚РµРј С‡РµСЂРЅРµРµС‚
//               СЃРµСЂРґС†РµРІРёРЅСѓ в†’ "С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР° СЃ РєСЂР°СЃРЅРѕР№ РѕР±РІРѕРґРєРѕР№". РџРѕРµРґР°С‚СЊ РќР• РјРѕР¶РµС‚.
//    ready    вЂ” С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёСЏ Р·Р°РІРµСЂС€РµРЅР°, Р¶РґС‘С‚ СЃС‚С‹РєРѕРІРєРё СЃ РєРѕР»СЊС†РѕРј.
//    linked   вЂ” СЃРѕСЃС‚С‹РєРѕРІР°РЅР° СЃ РєСЂР°СЃРЅС‹Рј РєРѕР»СЊС†РѕРј в†’ РјРѕР¶РµС‚ РїРѕРµРґР°С‚СЊ СЃС‚Р°СЂР»РµС‚С‹ (РєРѕРјР±Рѕ).
//
//  РџРµСЂРµС‚Р°СЃРєРёРІР°РµС‚СЃСЏ РєСѓСЂСЃРѕСЂРѕРј (РєР°Рє СЃС‚Р°СЂС‹Р№ СЃС‚Р°СЂР»РµС‚). РЎРєРІРѕР·СЊ РїСЂРµРїСЏС‚СЃС‚РІРёСЏ РїСЂРѕС…РѕРґРёС‚
//  Р±РµР· РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ. Р’ РѕРґРёРЅРѕС‡РєСѓ (Р±РµР· РєРѕР»СЊС†Р°) РЅРµ РµСЃС‚ РЅРёС‡РµРіРѕ. Р”РѕР»Р¶РЅР° РІРёР·СѓР°Р»СЊРЅРѕ
//  РІС‹РґРµР»СЏС‚СЊСЃСЏ: СЏСЂРєР°СЏ РєСЂР°СЃРЅР°СЏ СѓС‚РѕР»С‰С‘РЅРЅР°СЏ РѕР±РІРѕРґРєР° + РјСЏРіРєРёР№ РїСѓР»СЊСЃ.
// ============================================================================
class Blacklet {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;

    this.vx = 0;
    this.vy = 0;

    this.following = false;
    this.state = "forming"; // forming -> ready -> linked
    this.isLinked = false;

    // Р§РµРј Р±РѕР»СЊС€Рµ вЂ” С‚РµРј Р±С‹СЃС‚СЂРµРµ С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР° РґРѕРіРѕРЅСЏРµС‚ РєСѓСЂСЃРѕСЂ (РјРµРЅСЊС€Рµ РѕС‚СЃС‚Р°С‘С‚).
    // Р’ РєРѕРјР±Рѕ РґРµСЂР¶РёРј РўРђРљРћР™ Р–Р• РѕС‚РєР»РёРє, С‡С‚РѕР±С‹ СЃРІСЏР·РєР° РЅРµ С‚РѕСЂРјРѕР·РёР»Р°.
    this.lagFactor = 0.2;
    this.linkedLagFactor = 0.2;

    this.phase = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.0115;
    this.wander = 0.26;
    this.wanderY = 0.34;
    this.jitterPhase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;

    // РџСЂРѕРіСЂРµСЃСЃ С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёРё Р¶С‘Р»С‚С‹Р№ в†’ РєСЂР°СЃРЅС‹Р№ в†’ С‡С‘СЂРЅР°СЏ СЃРµСЂРґС†РµРІРёРЅР°.
    this.transformProgress = 0;
    this.formationDuration = 1.8;
    this.coreDarkness = 0;
    this.redness = 0;

    this.linkedRing = null;

    this.setBounds(sceneMetrics);
    this.reset();
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    const baseStarletRadius = sceneMetrics?.starletBaseRadius ?? 8;
    // Р—Р°РјРµС‚РЅРѕ РєСЂСѓРїРЅРµРµ РѕР±С‹С‡РЅРѕРіРѕ СЃС‚Р°СЂР»РµС‚Р°, С‡С‚РѕР±С‹ РІС‹РґРµР»СЏС‚СЊСЃСЏ.
    this.radius = baseStarletRadius * 1.33 * 1.5;
    this.innerRadius = this.radius * 0.48;

    // Р Р°РґРёСѓСЃ "Р·Р°С…РІР°С‚Р°" РїРѕРґ РєСѓСЂСЃРѕСЂ вЂ” С‰РµРґСЂС‹Р№, С‚.Рє. СЌС‚Рѕ РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РѕР±СЉРµРєС‚ РёРіСЂРѕРєР°.
    this.dragRadius = (sceneMetrics?.starletDragRadius ?? 28) * 1.3;
    this.linkRadius = (sceneMetrics?.starletDragRadius ?? 28) * 1.6;

    // Р—РѕРЅР° "РїРѕРµРґР°РЅРёСЏ" СЃС‚Р°СЂР»РµС‚Р° Р°РєС‚РёРІРЅС‹Рј РєРѕРјР±Рѕ. РћРїРёСЂР°РµС‚СЃСЏ РЅР° СЂР°РґРёСѓСЃ РєРѕР»СЊС†Р°, РµСЃР»Рё
    // РѕРЅРѕ РїСЂРёС†РµРїР»РµРЅРѕ, РёРЅР°С‡Рµ РЅР° СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ (Р·Р°РїР°СЃРЅРѕР№ РІР°СЂРёР°РЅС‚).
    this.eatRadius = this.radius * 2.2;

    // РЎРІРѕР±РѕРґРЅС‹Р№ РґСЂРµР№С„ РґРѕ С‚РѕРіРѕ, РєР°Рє РёРіСЂРѕРє РІР·СЏР» РµС‘ РїРѕРґ РєСѓСЂСЃРѕСЂ (РїСЂР°РІР°СЏ С‡Р°СЃС‚СЊ СЌРєСЂР°РЅР°).
    this.spawnX = sceneMetrics.width * 0.78;
    this.minX = sceneMetrics.width * 0.42;
    this.maxX = sceneMetrics.width * 0.92;
    this.minY = sceneMetrics.height * 0.18;
    this.maxY = sceneMetrics.height * 0.82;
  }

  reset() {
    this.state = "forming";
    this.isLinked = false;
    this.linkedRing = null;
    this.following = false;

    this.transformProgress = 0;
    this.coreDarkness = 0;
    this.redness = 0;

    this.x = this.spawnX;
    this.y = this.minY + Math.random() * Math.max(24, this.maxY - this.minY);
    this.targetX = this.x;
    this.targetY = this.y;

    this.vx = -0.24 - Math.random() * 0.1;
    this.vy = (Math.random() - 0.5) * 0.14;
  }

  // РњРѕР¶РµС‚ Р»Рё РєРѕРјР±Рѕ РїРѕРµРґР°С‚СЊ СЃС‚Р°СЂР»РµС‚С‹ вЂ” С‚РѕР»СЊРєРѕ РєРѕРіРґР° СЃРѕСЃС‚С‹РєРѕРІР°РЅРѕ СЃ РєРѕР»СЊС†РѕРј.
  canAbsorb() {
    return this.state === "linked";
  }

  // РњРѕР¶РµС‚ Р»Рё РїСЂРёСЃС‚С‹РєРѕРІР°С‚СЊ РєРѕР»СЊС†Рѕ вЂ” РїРѕРєР° РµС‰С‘ РЅРµ СЃРѕСЃС‚С‹РєРѕРІР°РЅР°.
  canLink() {
    return this.state === "forming" || this.state === "ready";
  }

  isReady() {
    return this.state === "ready" || this.state === "linked";
  }

  isTransformed() {
    return this.transformProgress >= 1;
  }

  setLinked(redRing = null) {
    this.state = "linked";
    this.isLinked = true;
    this.linkedRing = redRing;
  }

  clearLinked() {
    if (this.state === "linked") {
      this.state = "ready";
    }
    this.isLinked = false;
    this.linkedRing = null;
  }

  update(mousePos, isDragging, delta = 0.016) {
    const catchRadius = this.isLinked ? this.linkRadius : this.dragRadius;

    if (!this.following && isDragging) {
      const dx = this.x - mousePos.x;
      const dy = this.y - mousePos.y;
      if (Math.sqrt(dx * dx + dy * dy) < catchRadius) {
        this.following = true;
      }
    }

    if (this.following) {
      this.targetX = mousePos.x;
      this.targetY = mousePos.y;

      const lag = this.isLinked ? this.linkedLagFactor : this.lagFactor;
      this.x += (this.targetX - this.x) * lag;
      this.y += (this.targetY - this.y) * lag;
    } else {
      // РЎРІРѕР±РѕРґРЅС‹Р№ РґСЂРµР№С„ РїРѕРєР° РёРіСЂРѕРє РµС‰С‘ РЅРµ РїРѕРґС…РІР°С‚РёР» С‡С‘СЂРЅСѓСЋ Р·РІРµР·РґСѓ.
      this.x += this.vx;
      this.y += this.vy;

      const t = performance.now();
      this.x += Math.sin(t * 0.0017 + this.phase) * this.wander;
      this.y += Math.cos(t * 0.0013 + this.phase) * this.wanderY;

      if (this.x < this.minX) this.vx = Math.abs(this.vx) * 0.92;
      if (this.x > this.maxX) this.vx = -Math.abs(this.vx) * 0.92;
      if (this.y < this.minY) this.vy = Math.abs(this.vy) * 0.92;
      if (this.y > this.maxY) this.vy = -Math.abs(this.vy) * 0.92;
    }

    // РўСЂР°РЅСЃС„РѕСЂРјР°С†РёСЏ: РєСЂР°СЃРЅС‹Р№ РїСЂРѕСЏРІР»СЏРµС‚СЃСЏ СЂР°РЅСЊС€Рµ, С‡РµСЂРЅРѕС‚Р° СЃРµСЂРґС†РµРІРёРЅС‹ вЂ” РїРѕР·Р¶Рµ.
    // Р”РѕРєСЂСѓС‡РёРІР°РµРј РїСЂРѕРіСЂРµСЃСЃ РЅРµ С‚РѕР»СЊРєРѕ РІ "forming", РЅРѕ Рё РІ "linked"/"ready", РµСЃР»Рё
    // РєРѕР»СЊС†Рѕ РїСЂРёСЃС‚С‹РєРѕРІР°Р»РѕСЃСЊ РµС‰С‘ РЅР° СЃРµСЂРµРґРёРЅРµ С„РѕСЂРјРёСЂРѕРІР°РЅРёСЏ вЂ” РёРЅР°С‡Рµ С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР°
    // РЅР°РІСЃРµРіРґР° РѕСЃС‚Р°РЅРµС‚СЃСЏ РЅРµРґРѕС‡РµСЂРЅС‘РЅРЅРѕР№.
    if (this.transformProgress < 1) {
      this.transformProgress = Math.min(
        1,
        this.transformProgress + delta / this.formationDuration
      );

      const redStart = 0.40;
      const blackStart = 0.80;

      this.redness =
        this.transformProgress <= redStart
          ? 0
          : Math.min(1, (this.transformProgress - redStart) / (1 - redStart));

      this.coreDarkness =
        this.transformProgress <= blackStart
          ? 0
          : Math.min(1, (this.transformProgress - blackStart) / (1 - blackStart));

      // Р’ "ready" РїРµСЂРµРІРѕРґРёРј С‚РѕР»СЊРєРѕ РёР· "forming"; РµСЃР»Рё Р·РІРµР·РґР° СѓР¶Рµ "linked"
      // (РєРѕР»СЊС†Рѕ РїСЂРёСЃС‚С‹РєРѕРІР°Р»РѕСЃСЊ СЂР°РЅРѕ) вЂ” РЅРµ СЃР±СЂР°СЃС‹РІР°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ.
      if (this.transformProgress >= 1 && this.state === "forming") {
        this.state = "ready";
      }
    }

    this.rotation += this.rotationSpeed;
    this.jitterPhase += delta * 8.5;
    this.pulsePhase += delta * 3.0;
  }

  // РўРѕС‡РєР° РѕС‚СЃС‡С‘С‚Р° Р·РѕРЅС‹ РїРѕРµРґР°РЅРёСЏ (С†РµРЅС‚СЂ РєРѕРјР±Рѕ).
  getEatRadius() {
    if (this.isLinked && this.linkedRing) {
      return this.linkedRing.collisionRadius + this.radius * 0.4;
    }
    return this.eatRadius;
  }

  // РџРѕРµРґР°РµС‚ Р»Рё РєРѕРјР±Рѕ РґР°РЅРЅС‹Р№ СЃС‚Р°СЂР»РµС‚ (С‚РѕР»СЊРєРѕ РІ СЃРѕСЃС‚РѕСЏРЅРёРё linked).
  eats(starlet) {
    if (!this.canAbsorb() || !starlet) return false;
    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.getEatRadius() + starlet.radius;
  }

  draw(ctx) {
    // Р”СЂРѕР¶Р°РЅРёРµ СЃРёР»СЊРЅРµРµ РІ РЅР°С‡Р°Р»Рµ С„РѕСЂРјРёСЂРѕРІР°РЅРёСЏ, Рє РєРѕРЅС†Сѓ вЂ” РїРѕС‡С‚Рё РёСЃС‡РµР·Р°РµС‚.
    const jitterStrength =
      this.state === "forming"
        ? 0.55 + (1 - this.transformProgress) * 0.8
        : 0.14;

    const jitterX = Math.sin(this.jitterPhase) * jitterStrength;
    const jitterY = Math.cos(this.jitterPhase * 0.87) * jitterStrength;

    // Р›С‘РіРєРёР№ РїСѓР»СЊСЃ РіРѕС‚РѕРІРѕР№/СЃРѕСЃС‚С‹РєРѕРІР°РЅРЅРѕР№ Р·РІРµР·РґС‹, С‡С‚РѕР±С‹ РІС‹РґРµР»СЏР»Р°СЃСЊ.
    const readyPulse =
      this.state === "forming" ? 1 : 1 + Math.sin(this.pulsePhase) * 0.05;

    const glowBoost =
      this.state === "linked"
        ? 1.25
        : this.state === "ready"
        ? 1.05
        : 0.72 + this.redness * 0.2;

    const yellow = { r: 245, g: 182, b: 112 };
    const amber = { r: 255, g: 240, b: 184 };
    const red = { r: 224, g: 58, b: 74 };       // СЏСЂС‡Рµ РґР»СЏ РІС‹РґРµР»РµРЅРёСЏ
    const deepRed = { r: 126, g: 60, b: 72 };
    const brightEdge = { r: 255, g: 86, b: 104 }; // СЏСЂРєР°СЏ РєСЂР°СЃРЅР°СЏ РѕР±РІРѕРґРєР°

    const mix = (a, b, t) => ({
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    });

    const toRgb = (c, alpha = 1) =>
      `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${alpha})`;

    const outerWarm = mix(yellow, red, this.redness * 0.85);
    const edgeColor = mix(amber, brightEdge, this.redness);
    const shadowColor = mix(red, deepRed, this.coreDarkness * 0.35);

    const coreFill =
      this.coreDarkness <= 0
        ? outerWarm
        : mix(outerWarm, { r: 10, g: 14, b: 28 }, this.coreDarkness);

    const coreHighlight = mix(
      amber,
      { r: 255, g: 210, b: 210 },
      this.redness * 0.45
    );

    const drawRadius = this.radius * readyPulse;
    const drawInner = this.innerRadius * readyPulse;
    const glowRadius = drawRadius * (3.0 + 0.35 * glowBoost);

    ctx.save();
    ctx.translate(this.x + jitterX, this.y + jitterY);
    ctx.rotate(this.rotation);

    // Р’РЅРµС€РЅРµРµ СЃРІРµС‡РµРЅРёРµ.
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, glowRadius);
    glow.addColorStop(0, toRgb(edgeColor, 0.22 * glowBoost));
    glow.addColorStop(0.45, toRgb(shadowColor, 0.13 * glowBoost));
    glow.addColorStop(1, toRgb(deepRed, 0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // РўРµР»Рѕ Р·РІРµР·РґС‹.
    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.shadowBlur = 20 * glowBoost;
    ctx.shadowColor = toRgb(edgeColor, 0.58);
    ctx.fillStyle = toRgb(coreFill, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // РЇСЂРєР°СЏ СѓС‚РѕР»С‰С‘РЅРЅР°СЏ РєСЂР°СЃРЅР°СЏ РѕР±РІРѕРґРєР° (СЃС‚Р°РЅРѕРІРёС‚СЃСЏ С‚РѕР»С‰Рµ РїРѕ РјРµСЂРµ РїРѕРєСЂР°СЃРЅРµРЅРёСЏ).
    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.lineWidth =
      this.state === "forming" ? 1.1 + this.redness * 1.4 : 2.4;
    ctx.strokeStyle = toRgb(edgeColor, 0.98);
    ctx.stroke();

    // Р’РЅСѓС‚СЂРµРЅРЅРёР№ Р±Р»РёРє.
    drawStarPath(
      ctx,
      -drawRadius * 0.16,
      -drawRadius * 0.18,
      drawRadius * 0.36,
      drawRadius * 0.15,
      5
    );
    ctx.fillStyle = toRgb(
      coreHighlight,
      Math.max(0.16, 0.4 - this.coreDarkness * 0.24)
    );
    ctx.fill();

    ctx.restore();
  }
}

class Redlet {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    this.state = "forming"; // forming -> huntingRing -> carryingRing
    this.hasCapturedRing = false;
    this.markedForRemoval = false;

    this.followTargetX = 0;
    this.followTargetY = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.jitterPhase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.014;

    this.transformProgress = 0;
    this.formationDuration = 3.1;

    this.redness = 0;
    this.coreDarkness = 0;

    this.baseHomingSpeed = 5.2;
    this.baseCarryingSpeed = 5.0;
    this.homingSpeed = this.baseHomingSpeed;
    this.carryingSpeed = this.baseCarryingSpeed;
    this.steer = 0.075;
    this.wander = 0.16;

    // РќРµР±РѕР»СЊС€РѕР№ РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ СЂР°Р·Р±СЂРѕСЃ СЃРєРѕСЂРѕСЃС‚Рё РЅР° РѕРґРЅРѕРіРѕ СЂРµРґР»РµС‚Р°.
    this.speedVariance = 0.18;
    this.speedFactor = 1;

    this.sizeFactor = 1;
    this.minSizeFactor = 1.33;
    this.maxSizeFactor = 2.92;

    this.radius = 0;
    this.innerRadius = 0;
    this.catchRadius = 0;
    this.eatRadius = 0;

    this.formingDriftX = 0;
    this.formingRiseSpeed = 0;
    this.formingTargetY = 0;
    this.formingEdge = "top";

    this.setBounds(sceneMetrics);
    this.reset();
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    const baseStarletRadius = sceneMetrics?.starletBaseRadius ?? 8;
    const offscreenOffset = sceneMetrics?.offscreenOffset ?? 60;
    const width = sceneMetrics?.width ?? 1366;
    const height = sceneMetrics?.height ?? 768;

    this.applySize();

    this.spawnInsetX = width * 0.06;
    this.spawnInsetY = height * 0.08;

    this.minX = width * 0.04;
    this.maxX = width * 0.96;
    this.minY = height * 0.06;
    this.maxY = height * 0.94;

    this.offscreenOffset = offscreenOffset * 1.3;
  }

  applySize() {
  const baseStarletRadius = this.sceneMetrics?.starletBaseRadius ?? 8;

  this.radius = baseStarletRadius * this.sizeFactor;
  this.innerRadius = this.radius * 0.48;
  this.catchRadius = this.radius * 1.9;
  this.eatRadius = this.radius * 2.4;

  this.separationRadius = this.radius * 3.4;
  this.separationForce = 0.11;
  this.carryingSeparationRadius = this.radius * 4.2;
  this.carryingSeparationForce = 0.15;
}

  reset() {
  this.state = "forming";
  this.hasCapturedRing = false;
  this.markedForRemoval = false;

  this.transformProgress = 0;
  this.redness = 0;
  this.coreDarkness = 0;

  this.phase = Math.random() * Math.PI * 2;
  this.jitterPhase = Math.random() * Math.PI * 2;
  this.pulsePhase = Math.random() * Math.PI * 2;
  this.rotation = Math.random() * Math.PI * 2;

  this.speedFactor = 1 + (Math.random() * 2 - 1) * this.speedVariance;
  this.homingSpeed = this.baseHomingSpeed * this.speedFactor;
  this.carryingSpeed = this.baseCarryingSpeed * this.speedFactor;

  this.sizeFactor =
    this.minSizeFactor +
    Math.random() * (this.maxSizeFactor - this.minSizeFactor);

  this.applySize();

  this.spawnFromEdge();
}

  spawnFromEdge() {
    const width = this.sceneMetrics?.width ?? 1366;
    const height = this.sceneMetrics?.height ?? 768;
    const d = this.offscreenOffset;

    const edgeRoll = Math.random();
    let edge = "top";

    if (edgeRoll < 0.25) edge = "top";
    else if (edgeRoll < 0.5) edge = "bottom";
    else if (edgeRoll < 0.75) edge = "left";
    else edge = "right";

    this.formingEdge = edge;

    if (edge === "top") {
      this.x = Math.random() * width;
      this.y = -d;
    } else if (edge === "bottom") {
      this.x = Math.random() * width;
      this.y = height + d;
    } else if (edge === "left") {
      this.x = -d;
      this.y = Math.random() * height;
    } else {
      this.x = width + d;
      this.y = Math.random() * height;
    }

    this.formingDriftX =
      (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.22);
    this.formingRiseSpeed = 0.45 + Math.random() * 0.28;

    if (edge === "top") {
      this.formingTargetY = height * (0.18 + Math.random() * 0.18);
      this.vx = this.formingDriftX;
      this.vy = this.formingRiseSpeed;
    } else if (edge === "bottom") {
      this.formingTargetY = height * (0.64 + Math.random() * 0.18);
      this.vx = this.formingDriftX;
      this.vy = -this.formingRiseSpeed;
    } else if (edge === "left") {
      this.formingTargetY = this.y;
      this.vx = 0.55 + Math.random() * 0.25;
      this.vy = (Math.random() - 0.5) * 0.18;
    } else {
      this.formingTargetY = this.y;
      this.vx = -(0.55 + Math.random() * 0.25);
      this.vy = (Math.random() - 0.5) * 0.18;
    }

    this.followTargetX = this.x;
    this.followTargetY = this.y;
  }

  isActive() {
    return !this.markedForRemoval;
  }

  canCaptureRing() {
    return this.state === "huntingRing" && !this.hasCapturedRing;
  }

  canEatStarlets() {
    return this.state === "carryingRing" && this.hasCapturedRing;
  }

  getSpeed() {
    return this.hasCapturedRing ? this.carryingSpeed : this.homingSpeed;
  }

  getEatRadius() {
    return this.hasCapturedRing ? this.eatRadius * 1.15 : this.eatRadius;
  }

  collidesWithRing(redRing) {
    if (!redRing || redRing.hidden || redRing.alpha <= 0.05) return false;
    if (!this.canCaptureRing()) return false;

    const dx = redRing.x - this.x;
    const dy = redRing.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.catchRadius + redRing.collisionRadius;
  }

  eatsStarlet(starlet) {
    if (!this.canEatStarlets() || !starlet) return false;

    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.getEatRadius() + starlet.radius;
  }

  captureRing() {
    this.hasCapturedRing = true;
    this.state = "carryingRing";
  }

  getTargetPoint(redRing, starlets) {
    if (this.hasCapturedRing) {
      let closest = null;
      let closestDist = Infinity;

      for (const starlet of starlets ?? []) {
        const dx = starlet.x - this.x;
        const dy = starlet.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < closestDist) {
          closestDist = distSq;
          closest = starlet;
        }
      }

      if (closest) {
        return { x: closest.x, y: closest.y };
      }
    }

    if (redRing && !redRing.hidden && redRing.alpha > 0.01) {
      return { x: redRing.x, y: redRing.y };
    }

    return {
      x: this.sceneMetrics.width * 0.72,
      y: this.sceneMetrics.height * 0.5,
    };
  }

  update(delta = 0.016, redRing = null, starlets = [], redlets = []) {
    this.phase += delta * 2.0;
    this.jitterPhase += delta * 8.5;
    this.pulsePhase += delta * 3.2;
    this.rotation += this.rotationSpeed;

    if (this.transformProgress < 1) {
      this.transformProgress = Math.min(
        1,
        this.transformProgress + delta / this.formationDuration
      );

      const redStart = 0.28;
      const blackStart = 0.68;

      this.redness =
        this.transformProgress < redStart
          ? 0
          : Math.min(1, (this.transformProgress - redStart) / (1 - redStart));

      this.coreDarkness =
        this.transformProgress < blackStart
          ? 0
          : Math.min(1, (this.transformProgress - blackStart) / (1 - blackStart));
    }

    if (this.state === "forming") {
      this.x += this.vx;
      this.y += this.vy;

      this.x += Math.sin(this.phase) * this.wander * 0.45;
      this.y += Math.cos(this.phase * 0.92) * this.wander * 0.18;

      const reachedY =
        this.vy > 0
          ? this.y >= this.formingTargetY
          : this.y <= this.formingTargetY;

      if (reachedY) {
        this.y = this.formingTargetY;
        this.vy *= 0.92;
      }

      this.followTargetX = this.x;
      this.followTargetY = this.y;

      if (this.transformProgress >= 1) {
        this.state = "huntingRing";
      }
    } else {
      const target = this.getTargetPoint(redRing, starlets);
      this.followTargetX = target.x;
      this.followTargetY = target.y;

      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const speed = this.getSpeed();

      let desiredVx = (dx / dist) * speed;
      let desiredVy = (dy / dist) * speed;

      let sepX = 0;
      let sepY = 0;
      let sepCount = 0;

      const sepRadius = this.hasCapturedRing
        ? this.carryingSeparationRadius
        : this.separationRadius;

      const sepForce = this.hasCapturedRing
        ? this.carryingSeparationForce
        : this.separationForce;

      for (const other of redlets) {
        if (!other || other === this || other.markedForRemoval) continue;

        const ox = this.x - other.x;
        const oy = this.y - other.y;
        const d2 = ox * ox + oy * oy;

        if (d2 <= 0.0001) continue;
        if (d2 >= sepRadius * sepRadius) continue;

        const d = Math.sqrt(d2);
        const falloff = 1 - d / sepRadius;

        sepX += (ox / d) * falloff;
        sepY += (oy / d) * falloff;
        sepCount++;
      }

      if (sepCount > 0) {
        sepX /= sepCount;
        sepY /= sepCount;

        desiredVx += sepX * speed * sepForce;
        desiredVy += sepY * speed * sepForce;
      }

      this.vx += (desiredVx - this.vx) * this.steer;
      this.vy += (desiredVy - this.vy) * this.steer;

      this.x += this.vx;
      this.y += this.vy;

      this.x += Math.sin(this.phase) * this.wander;
      this.y += Math.cos(this.phase * 0.92) * this.wander;
    }

    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
  }

  draw(ctx) {
    if (!ctx || this.markedForRemoval) return;

    const jitterStrength =
      this.state === "forming"
        ? 0.4 * (1 - this.transformProgress * 0.75)
        : 0.14;
    const jitterX = Math.sin(this.jitterPhase) * jitterStrength;
    const jitterY = Math.cos(this.jitterPhase * 0.87) * jitterStrength;

    const readyPulse =
      1 + Math.sin(this.pulsePhase) * (this.hasCapturedRing ? 0.06 : 0.04);
    const drawRadius = this.radius * readyPulse;
    const drawInner = this.innerRadius * readyPulse;
    const glowBoost = this.hasCapturedRing ? 1.35 : 1.0 + this.redness * 0.18;

    const yellow = { r: 245, g: 182, b: 112 };
    const amber = { r: 255, g: 240, b: 184 };
    const red = { r: 224, g: 58, b: 74 };
    const deepRed = { r: 126, g: 60, b: 72 };
    const brightEdge = { r: 255, g: 86, b: 104 };

    const mix = (a, b, t) => ({
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    });

    const toRgb = (c, alpha = 1) =>
      `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${alpha})`;

    const outerWarm = mix(yellow, red, this.redness * 0.92);
    const edgeColor = mix(amber, brightEdge, this.redness);
    const shadowColor = mix(red, deepRed, this.coreDarkness * 0.42);
    const coreFill = mix(
      outerWarm,
      { r: 160, g: 32, b: 48 },
      Math.min(1, this.redness * 0.9 + this.coreDarkness * 0.35)
    );
    const coreHighlight = mix(
      amber,
      { r: 255, g: 210, b: 210 },
      this.redness * 0.5
    );

    ctx.save();
    ctx.translate(this.x + jitterX, this.y + jitterY);
    ctx.rotate(this.rotation);

    const glowRadius = drawRadius * (3.0 + 0.3 * glowBoost);
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, glowRadius);
    glow.addColorStop(0, toRgb(edgeColor, 0.24 * glowBoost));
    glow.addColorStop(0.45, toRgb(shadowColor, 0.14 * glowBoost));
    glow.addColorStop(1, toRgb(deepRed, 0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.shadowBlur = 20 * glowBoost;
    ctx.shadowColor = toRgb(edgeColor, 0.58);
    ctx.fillStyle = toRgb(coreFill, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.lineWidth = this.state === "forming" ? 1.1 + this.redness * 1.3 : 2.2;
    ctx.strokeStyle = toRgb(edgeColor, 0.98);
    ctx.stroke();

    drawStarPath(
      ctx,
      -drawRadius * 0.16,
      -drawRadius * 0.18,
      drawRadius * 0.36,
      drawRadius * 0.15,
      5
    );
    ctx.fillStyle = toRgb(
      coreHighlight,
      Math.max(0.16, 0.4 - this.coreDarkness * 0.24)
    );
    ctx.fill();

    if (this.hasCapturedRing) {
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius * 1.55, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.25, this.radius * 0.22);
      ctx.strokeStyle = "rgba(176, 40, 60, 0.84)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, drawRadius * 1.55, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, this.radius * 0.11);
      ctx.strokeStyle = "rgba(230, 90, 90, 0.24)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ============================================================================
//  RedRing вЂ” РјСЏРіРєРѕ РїСѓР»СЊСЃРёСЂСѓСЋС‰РµРµ РєСЂР°СЃРЅРѕРµ РєРѕР»СЊС†Рѕ.
//
//  Р–РёР·РЅРµРЅРЅС‹Р№ С†РёРєР»: idle в†’ attached в†’ decaying в†’ gone в†’ respawned
//    idle      вЂ” СЃРІРѕР±РѕРґРЅРѕ РїР»Р°РІР°РµС‚ Рё РїСѓР»СЊСЃРёСЂСѓРµС‚, Р‘Р•Р— С‚Р°Р№РјРµСЂР°; РѕС‚С‚Р°Р»РєРёРІР°РµС‚
//                РїСЂРµРїСЏС‚СЃС‚РІРёСЏ (РєР°Рє РґРѕРјР°С€РЅСЏСЏ Р·РІРµР·РґР°).
//    attached  вЂ” СЃРѕСЃС‚С‹РєРѕРІР°РЅРѕ СЃ С‡С‘СЂРЅРѕР№ Р·РІРµР·РґРѕР№: С†РµРЅС‚СЂРёСЂСѓРµС‚СЃСЏ РЅР° РЅРµР№.
//    decaying  вЂ” РїРѕСЃР»Рµ СЃС‚С‹РєРѕРІРєРё СЂР°СЃРїР°РґР°РµС‚СЃСЏ СЂРѕРІРЅРѕ 6 СЃРµРєСѓРЅРґ, С‚РµСЂСЏСЏ РјР°С‚РµСЂРёР°Р»СЊРЅРѕСЃС‚СЊ
//                СЃ РєР°Р¶РґС‹Рј РїСѓР»СЊСЃРѕРј (alpha РїР°РґР°РµС‚).
//    gone      вЂ” РїРѕР»РЅРѕСЃС‚СЊСЋ СЂР°СЃС‚РІРѕСЂРёР»РѕСЃСЊ.
//    respawned вЂ” СЃРїСѓСЃС‚СЏ РєРѕСЂРѕС‚РєСѓСЋ Р·Р°РґРµСЂР¶РєСѓ СЂРѕР¶РґР°РµС‚СЃСЏ РЅРѕРІРѕРµ РєРѕР»СЊС†Рѕ (idle).
//
//  РљРѕРјР±Рѕ (С‡С‘СЂРЅР°СЏ Р·РІРµР·РґР° + РєРѕР»СЊС†Рѕ) РѕС‚С‚Р°Р»РєРёРІР°РµС‚ РїСЂРµРїСЏС‚СЃС‚РІРёСЏ РєР°Рє РґРѕРјР°С€РЅСЏСЏ Р·РІРµР·РґР°,
//  Р‘Р•Р— РёР·РјРµРЅРµРЅРёСЏ СЃС‡С‘С‚Р°.
// ============================================================================
class RedRing {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;
    this.onGone = null;

    this.x = 0;
    this.y = 0;

    this.anchorBlacklet = null;
    this.isAttached = false;

    this.entrySide = "top";
    this.entering = false;
    this.hidden = true;
    this.state = "idle";

    this.vx = 0;
    this.vy = 0;

    this.alpha = 1;

    this.decayProgress = 0;
    this.decayDuration = 9.0;

    this.spawnDelay = 0;
    this.respawnDelay = 0.15;

    this.attachPull = 0.2;

    this.phase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.glowPhase = Math.random() * Math.PI * 2;

    this.baseRadius = 0;
    this.dotRadius = 0;
    this.ringRadius = 0;
    this.ringThickness = 0;
    this.innerRingRadius = 0;
    this.outerGlowRadius = 0;
    this.collisionRadius = 0;

    this.setBounds(sceneMetrics);
    this.reset();
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    const baseStarletRadius = sceneMetrics?.starletBaseRadius ?? 8;
    const playScale = sceneMetrics?.playScale ?? 1;
    const offscreenOffset = sceneMetrics?.offscreenOffset ?? 60;
    const { width = 1366, height = 768 } = sceneMetrics ?? {};

    const clamp = (min, value, max) => Math.max(min, Math.min(max, value));

    this.baseRadius = baseStarletRadius * 1.95;
    this.dotRadius = this.baseRadius * (0.34 / 1.5);
    this.ringRadius = this.baseRadius * 2.25;

    this.ringThickness = clamp(
      this.baseRadius * 0.2,
      this.baseRadius * 0.3,
      this.baseRadius * 0.42
    );

    this.innerRingRadius = Math.max(
      this.ringRadius - this.ringThickness,
      this.ringRadius * 0.42
    );

    this.outerGlowRadius = this.ringRadius * 2.5;
    this.collisionRadius = this.ringRadius * 1.02;

    this.spawnMinX = width * 0.66;
    this.spawnMaxX = width * 0.92;

    this.driftMinX = width * 0.5;
    this.driftMaxX = width * 0.94;
    this.driftMinY = height * 0.14;
    this.driftMaxY = height * 0.86;

    this.topSpawnY = -offscreenOffset * (1.2 + 0.35 * playScale);
    this.bottomSpawnY = height + offscreenOffset * (1.2 + 0.35 * playScale);

    if (this.state !== "attached" && this.state !== "decaying") {
      this.x = Math.max(
        this.driftMinX,
        Math.min(this.driftMaxX, this.x || this.spawnMinX)
      );
      this.y = Math.max(
        this.topSpawnY,
        Math.min(this.bottomSpawnY, this.y || height * 0.5)
      );
    }
  }

  reset() {
    this.anchorBlacklet = null;
    this.isAttached = false;
    this.state = "idle";

    this.alpha = 1;
    this.decayProgress = 0;
    this.spawnDelay = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.glowPhase = Math.random() * Math.PI * 2;

    this.entrySide = Math.random() < 0.5 ? "top" : "bottom";

    this.x =
      this.spawnMinX +
      Math.random() * Math.max(24, this.spawnMaxX - this.spawnMinX);

    this.y = this.entrySide === "top" ? this.topSpawnY : this.bottomSpawnY;

    this.vx = -0.5 - Math.random() * 0.4;
    this.vy =
      this.entrySide === "top"
        ? 2.2 + Math.random() * 0.8
        : -2.2 - Math.random() * 0.8;

    this.entering = true;
  }

  activateIntro() {
    this.state = "idle";
    this.isAttached = false;
    this.anchorBlacklet = null;
    this.alpha = 1;
    this.decayProgress = 0;
    this.spawnDelay = 0;
    this.hidden = false;
    this.entering = true;

    const { width = 1366, height = 768 } = this.sceneMetrics ?? {};

    this.x = width + this.outerGlowRadius;
    this.y = height * (0.34 + Math.random() * 0.32);

    this.vx = -6.0 - Math.random() * 1.5;
    this.vy = (Math.random() - 0.5) * 0.6;
  }

  respawn() {
    this.activateIntro();
  }

  canAttach() {
    return this.state === "idle" && !this.isAttached;
  }

  isActiveCombo() {
    return this.state === "attached" || this.state === "decaying";
  }

  attachToBlacklet(blacklet) {
    if (!blacklet) return;
    if (!this.canAttach()) return;
    if (!blacklet.canLink()) return;

    this.anchorBlacklet = blacklet;
    this.isAttached = true;
    this.state = "attached";

    this.decayProgress = 0;
    this.alpha = 1;

    blacklet.setLinked(this);

    this.x = blacklet.x;
    this.y = blacklet.y;
  }

  detach() {
    if (this.anchorBlacklet) {
      this.anchorBlacklet.clearLinked();
    }
    this.anchorBlacklet = null;
    this.isAttached = false;
    this.state = "decaying";
  }

  absorbToBlackletCenter(blacklet, pull = this.attachPull) {
    if (!blacklet) return;
    this.x += (blacklet.x - this.x) * pull;
    this.y += (blacklet.y - this.y) * pull;
  }

  collidesWithBlacklet(blacklet) {
    if (!blacklet || !this.canAttach()) return false;
    if (!blacklet.canLink()) return false;

    const dx = blacklet.x - this.x;
    const dy = blacklet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const linkDist = blacklet.radius * 0.72 + this.collisionRadius;
    return dist < linkDist;
  }

  isReadyToRespawn() {
    return this.state === "gone";
  }

  update(delta = 0.016, blacklet = null) {
    if (this.hidden) return;

    this.pulsePhase += delta * 5.4;
    this.glowPhase += delta * 2.8;
    this.phase += delta * 1.9;

    if (this.spawnDelay > 0) {
      this.spawnDelay = Math.max(0, this.spawnDelay - delta);
      return;
    }

    if (this.state === "idle") {
      this.x += this.vx;
      this.y += this.vy;

      if (this.entering) {
        const insideX = this.x > this.driftMinX && this.x < this.driftMaxX;
        const insideY = this.y > this.driftMinY && this.y < this.driftMaxY;
        if (insideX && insideY) {
          this.entering = false;
          this.vx = (Math.random() - 0.5) * 0.8;
          this.vy = (Math.random() - 0.5) * 0.8;
        }
      } else {
        this.x += Math.sin(this.phase) * 0.06;
        this.y += Math.cos(this.phase * 0.92) * 0.09;

        if (this.x < this.driftMinX) this.vx = Math.abs(this.vx) * 0.92;
        if (this.x > this.driftMaxX) this.vx = -Math.abs(this.vx) * 0.92;
        if (this.y < this.driftMinY) this.vy = Math.abs(this.vy) * 0.92;
        if (this.y > this.driftMaxY) this.vy = -Math.abs(this.vy) * 0.92;
      }

      if (blacklet && blacklet.canLink() && this.collidesWithBlacklet(blacklet)) {
        this.attachToBlacklet(blacklet);
      }

      this.alpha = 1;
      return;
    }

    if (this.state === "attached") {
      if (!blacklet) {
        this.detach();
        return;
      }

      this.anchorBlacklet = blacklet;
      this.x = blacklet.x;
      this.y = blacklet.y;

      this.decayProgress += delta / this.decayDuration;
      if (this.decayProgress >= 1) {
        this.decayProgress = 1;
        this.finishDecay();
        return;
      }

      const base = 1 - this.decayProgress;
      const flicker = 0.85 + 0.15 * Math.max(0, Math.sin(this.pulsePhase));
      this.alpha = Math.max(0, base * flicker);
      this.state = "decaying";
      return;
    }

    if (this.state === "decaying") {
      if (blacklet && blacklet.isLinked) {
        this.anchorBlacklet = blacklet;
        this.x = blacklet.x;
        this.y = blacklet.y;
      } else if (this.anchorBlacklet) {
        this.x = this.anchorBlacklet.x;
        this.y = this.anchorBlacklet.y;
      }

      this.decayProgress += delta / this.decayDuration;

      const base = Math.max(0, 1 - this.decayProgress);
      const flicker = 0.85 + 0.15 * Math.max(0, Math.sin(this.pulsePhase));
      this.alpha = base * flicker;

      if (this.decayProgress >= 1) {
        this.finishDecay();
      }
      return;
    }

    if (this.state === "gone") {
      this.spawnDelay = this.respawnDelay;
      this.respawn();
    }
  }


destroy({ clearBlacklet = true } = {}) {
  if (this.state === "gone") return;

  this.alpha = 0;
  this.hidden = false;
  this.isAttached = false;
  this.decayProgress = 1;

  if (clearBlacklet && this.anchorBlacklet) {
    this.anchorBlacklet.clearLinked?.();
  }

  this.anchorBlacklet = null;
  this.state = "gone";
  this.spawnDelay = this.respawnDelay ?? 0.15;

  this.onGone?.();
}

finishDecay() {
  this.destroy({ clearBlacklet: true });
}

  canRepel() {
    return (
      (this.state === "idle" || this.isActiveCombo()) && this.alpha > 0.05
    );
  }

  blocksObstacle(obstacle) {
    if (!this.canRepel()) return false;
    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.collisionRadius + obstacle.ringRadius;
  }

  repelObstacle(obstacle) {
    if (!this.canRepel()) return;

    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const overlap = this.collisionRadius + obstacle.ringRadius - dist;

    if (overlap > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      obstacle.x += nx * overlap;
      obstacle.y += ny * overlap;

      const dot = obstacle.vx * nx + obstacle.vy * ny;
      if (dot < 0) {
        obstacle.vx -= 2 * dot * nx;
        obstacle.vy -= 2 * dot * ny;
      }

      obstacle.vx += nx * 0.03;
      obstacle.vy += ny * 0.03;
    }
  }

  draw(ctx) {
    if (this.hidden) return;
    if (this.alpha <= 0.001) return;

    const heartBeat = Math.max(0, Math.sin(this.pulsePhase)) ** 6;
    const ringPulse = 1 + heartBeat * 0.2;

    const dotRadius =
      this.dotRadius * (1 + Math.sin(this.pulsePhase) * 0.035);
    const ringRadius = this.ringRadius * ringPulse;
    const glowRadius =
      this.outerGlowRadius *
      (0.92 + Math.sin(this.glowPhase) * 0.04 + heartBeat * 0.08);

    const ringAlpha = this.alpha * 0.92;
    const glowAlpha = this.alpha * (this.isActiveCombo() ? 0.26 : 0.18);
    const dotAlpha = this.isActiveCombo() ? 0 : this.alpha;

    ctx.save();

    const glow = ctx.createRadialGradient(
      this.x,
      this.y,
      dotRadius * 0.8,
      this.x,
      this.y,
      glowRadius
    );
    glow.addColorStop(0, `rgba(206, 69, 69, ${0.0 * glowAlpha})`);
    glow.addColorStop(0.72, `rgba(206, 69, 69, ${0.06 * glowAlpha})`);
    glow.addColorStop(0.9, `rgba(206, 69, 69, ${0.22 * glowAlpha})`);
    glow.addColorStop(1, "rgba(206, 69, 69, 0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = this.ringThickness;
    ctx.strokeStyle = `rgba(176, 40, 60, ${Math.min(1, ringAlpha * 0.9)})`;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.2, this.ringThickness * 0.58);
    ctx.strokeStyle = `rgba(230, 90, 90, ${Math.min(1, 0.26 + ringAlpha * 0.2)})`;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(206, 69, 69, 0.24)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.innerRingRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, this.ringThickness * 0.16);
    ctx.strokeStyle = `rgba(206, 69, 69, ${Math.min(1, 0.72 + ringAlpha * 0.2)})`;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(206, 69, 69, 0.24)";
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (dotAlpha > 0.001) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(206, 69, 69, ${Math.min(1, 0.88 * dotAlpha + 0.12)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, dotRadius * 0.66, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 185, 185, ${0.34 * dotAlpha + 0.18})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, dotRadius, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255, 220, 220, ${0.58 * dotAlpha + 0.18})`;
      ctx.stroke();
    }

    ctx.restore();
  }
}

class MotherStar {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;

    this.sizeMultiplier = 1.5;

    this.baseRadius = sceneMetrics.homeRadius * this.sizeMultiplier;
    this.baseRingRadius = sceneMetrics.homeRingRadius * this.sizeMultiplier;
    this.baseGlowRadius = sceneMetrics.homeGlowRadius * this.sizeMultiplier;

    this.radius = 0;
    this.ringRadius = 0;
    this.glowRadius = 0;

    this.flicker = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.phase = Math.random() * Math.PI * 2;

    this.active = false;

    
    // growing -> open -> shrinking -> zero_wait
    this.state = "growing";
    this.scaleProgress = 0;
    this.openTimer = 0;
    this.zeroWaitTimer = 0;
    this.spawnPulseReady = false;

    this.growDuration = 2.1;
    this.openDuration = 1.2;
    this.shrinkDuration = 2.0;
    this.zeroWaitDuration = 1.5;
    this.minRenderableScale = 0.02;

   
    this.vx = 0;
    this.vy = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.driftSpeed = 2.65;
    this.driftSteer = 0.022;
    this.arriveDistance = 26;

    this.setBounds(sceneMetrics);
    this.reset();
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.baseRadius = sceneMetrics.homeRadius * this.sizeMultiplier;
    this.baseRingRadius = sceneMetrics.homeRingRadius * this.sizeMultiplier;
    this.baseGlowRadius = sceneMetrics.homeGlowRadius * this.sizeMultiplier;

    const { width, height } = sceneMetrics;

    
    this.driftMinX = width * 0.18;
    this.driftMaxX = width * 0.82;
    this.driftMinY = height * 0.22;
    this.driftMaxY = height * 0.78;

    if (this.x === 0 && this.y === 0) {
      this.x = width * 0.32;
      this.y = height * 0.5;
    }

    this.x = Math.max(this.driftMinX, Math.min(this.driftMaxX, this.x));
    this.y = Math.max(this.driftMinY, Math.min(this.driftMaxY, this.y));

    this.targetX = Math.max(
      this.driftMinX,
      Math.min(this.driftMaxX, this.targetX || this.x)
    );
    this.targetY = Math.max(
      this.driftMinY,
      Math.min(this.driftMaxY, this.targetY || this.y)
    );

    this.applyScale(this.scaleProgress);
  }

  reset() {
    this.active = true;

    this.flicker = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.phase = Math.random() * Math.PI * 2;

    // РќРѕРІС‹Р№ С†РёРєР» СЃС‚Р°РґРёР№, РЅРѕ Р±РµР· РЅРѕРІРѕРіРѕ РјР°СЂС€СЂСѓС‚Р° "РІС…РѕРґР°".
    this.state = "growing";
    this.scaleProgress = 0;
    this.openTimer = 0;
    this.zeroWaitTimer = 0;
    this.spawnPulseReady = false;

    // РџРµСЂРІС‹Р№ Р·Р°РїСѓСЃРє вЂ” СЃСЂР°Р·Сѓ РІРЅСѓС‚СЂРё СЂР°Р±РѕС‡РµР№ Р·РѕРЅС‹.
    if (this.x === 0 && this.y === 0) {
      this.x =
        this.driftMinX +
        (this.driftMaxX - this.driftMinX) * (0.18 + Math.random() * 0.2);
      this.y =
        this.driftMinY + Math.random() * (this.driftMaxY - this.driftMinY);
    } else {
      this.x = Math.max(this.driftMinX, Math.min(this.driftMaxX, this.x));
      this.y = Math.max(this.driftMinY, Math.min(this.driftMaxY, this.y));
    }

    this.pickNewDriftTarget(true);

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy) || 0.001;

    const startSpeed = this.driftSpeed * (0.72 + Math.random() * 0.18);
    this.vx = (dx / dist) * startSpeed;
    this.vy = (dy / dist) * startSpeed;

    this.applyScale(0);
  }

  activate() {
    this.reset();
  }

  deactivate() {
    this.active = false;
    this.spawnPulseReady = false;
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  easeInCubic(t) {
    return t * t * t;
  }

  applyScale(scale) {
    const s = Math.max(0, Math.min(1, scale));
    this.radius = this.baseRadius * s;
    this.ringRadius = this.baseRingRadius * s;
    this.glowRadius = this.baseGlowRadius * s;
  }

  isSpawnReady() {
    return this.active && this.state === "open" && this.scaleProgress >= 0.999;
  }

  consumeSpawnPulse() {
    if (!this.spawnPulseReady) return false;
    this.spawnPulseReady = false;
    return true;
  }

  pickNewDriftTarget(forceFar = false) {
    let nextX = this.x;
    let nextY = this.y;
    let attempts = 0;
    const minDist = forceFar ? 140 : 90;

    do {
      nextX = this.driftMinX + Math.random() * (this.driftMaxX - this.driftMinX);
      nextY = this.driftMinY + Math.random() * (this.driftMaxY - this.driftMinY);
      attempts++;
    } while (
      attempts < 12 &&
      Math.hypot(nextX - this.x, nextY - this.y) < minDist
    );

    this.targetX = nextX;
    this.targetY = nextY;
  }

  updateDrift(delta = 0.016) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.arriveDistance) {
      this.pickNewDriftTarget();
    }

    const nextDx = this.targetX - this.x;
    const nextDy = this.targetY - this.y;
    const nextDist = Math.hypot(nextDx, nextDy) || 0.001;

    const desiredVx = (nextDx / nextDist) * this.driftSpeed;
    const desiredVy = (nextDy / nextDist) * this.driftSpeed;

    this.vx += (desiredVx - this.vx) * this.driftSteer;
    this.vy += (desiredVy - this.vy) * this.driftSteer;

    // Р–РёРІРѕР№ С€СѓРј РїРѕРІРµСЂС… РЅР°РІРµРґРµРЅРёСЏ вЂ” С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ РѕС‰СѓС‰РµРЅРёСЏ СЂРµР»СЊСЃС‹.
    this.phase += delta * 1.65;
    const noiseX = Math.sin(this.phase) * 0.18;
    const noiseY = Math.cos(this.phase * 0.87) * 0.14;

    this.x += this.vx + noiseX;
    this.y += this.vy + noiseY;

    // РњСЏРіРєРёР№ СЂР°Р·РІРѕСЂРѕС‚ РѕС‚ РіСЂР°РЅРёС†.
    if (this.x < this.driftMinX) {
      this.x = this.driftMinX;
      this.vx = Math.abs(this.vx) * 0.84;
      this.pickNewDriftTarget();
    } else if (this.x > this.driftMaxX) {
      this.x = this.driftMaxX;
      this.vx = -Math.abs(this.vx) * 0.84;
      this.pickNewDriftTarget();
    }

    if (this.y < this.driftMinY) {
      this.y = this.driftMinY;
      this.vy = Math.abs(this.vy) * 0.84;
      this.pickNewDriftTarget();
    } else if (this.y > this.driftMaxY) {
      this.y = this.driftMaxY;
      this.vy = -Math.abs(this.vy) * 0.84;
      this.pickNewDriftTarget();
    }
  }

  update(delta = 0.016) {
    if (!this.active) return;

    this.flicker += delta * 2.2;
    this.rotation += delta * 0.9;

    // Р”РІРёР¶РµРЅРёРµ РІСЃРµРіРґР° РёРґС‘С‚ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ СЃС‚Р°РґРёРё.
    this.updateDrift(delta);

    if (this.state === "growing") {
      this.scaleProgress = Math.min(
        1,
        this.scaleProgress + delta / this.growDuration
      );
      this.applyScale(this.easeOutCubic(this.scaleProgress));

      if (this.scaleProgress >= 1) {
        this.scaleProgress = 1;
        this.applyScale(1);
        this.state = "open";
        this.openTimer = 0;
        this.spawnPulseReady = true;
      }
      return;
    }

    if (this.state === "open") {
      this.openTimer += delta;

      const pulse = 1 + Math.sin(this.flicker) * 0.018;
      this.radius = this.baseRadius * pulse;
      this.ringRadius = this.baseRingRadius * pulse;
      this.glowRadius = this.baseGlowRadius * pulse;

      if (this.openTimer >= this.openDuration) {
        this.state = "shrinking";
        this.scaleProgress = 1;
      }
      return;
    }

    if (this.state === "shrinking") {
      this.scaleProgress = Math.max(
        0,
        this.scaleProgress - delta / this.shrinkDuration
      );

      const scaled = 1 - this.easeInCubic(1 - this.scaleProgress);
      this.applyScale(scaled);

      if (this.scaleProgress <= 0) {
        this.scaleProgress = 0;
        this.applyScale(0);

        this.state = "zero_wait";
        this.zeroWaitTimer = 0;
        this.openTimer = 0;
        this.spawnPulseReady = false;
      }
      return;
    }

    if (this.state === "zero_wait") {
      this.scaleProgress = 0;
      this.applyScale(0);

      this.zeroWaitTimer += delta;

      if (this.zeroWaitTimer >= this.zeroWaitDuration) {
        this.state = "growing";
        this.scaleProgress = 0;
        this.openTimer = 0;
        this.zeroWaitTimer = 0;
        this.spawnPulseReady = false;
      }
    }
  }

  draw(ctx) {
  if (!this.active) return;
  if (this.scaleProgress <= this.minRenderableScale) return;

  const flicker = Math.sin(this.flicker) * 0.5 + 0.5;
  const ringPulse = 1 + Math.sin(this.phase * 1.8) * 0.04;
  const currentRingRadius = this.ringRadius * ringPulse;
  const currentGlowRadius = this.glowRadius * (0.92 + flicker * 0.08);

  const scale =
    this.baseRadius > 0 ? this.radius / this.baseRadius : this.scaleProgress;

  const maxStarletRadius = (this.sceneMetrics?.starletBaseRadius ?? 8) * 1.33;

  // Спиралька примерно вдвое больше прежней.
  const spiralSize = maxStarletRadius * 1.44 * scale;

  const orbitA = currentRingRadius * 0.42;
  const orbitB = currentRingRadius * 0.56;
  const orbitC = currentRingRadius * 0.67;

  ctx.save();
  ctx.translate(this.x, this.y);

  const glow = ctx.createRadialGradient(
    0,
    0,
    Math.max(2, spiralSize * 0.3),
    0,
    0,
    currentGlowRadius
  );
  glow.addColorStop(0, "rgba(145, 92, 1, 0.16)");
  glow.addColorStop(0.42, "rgba(255, 175, 96, 0.10)");
  glow.addColorStop(0.74, "rgba(255, 124, 72, 0.06)");
  glow.addColorStop(1, "rgba(255, 124, 72, 0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, currentGlowRadius, 0, Math.PI * 2);
  ctx.fill();

  if (currentRingRadius > 0.01) {
    ctx.beginPath();
    ctx.arc(0, 0, currentRingRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.8, this.radius * 0.06);
    ctx.strokeStyle = "rgba(255, 170, 92, 0.92)";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(255, 166, 82, 0.30)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, currentRingRadius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.6, this.radius * 0.025);
    ctx.strokeStyle = "rgba(255, 236, 198, 0.9)";
    ctx.shadowBlur = 7;
    ctx.shadowColor = "rgba(255, 236, 198, 0.18)";
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const drawOrbit = (radius, angle, squash, width, color, alpha) => {
    if (radius <= 0.01) return;

    ctx.save();
    ctx.rotate(angle);
    ctx.scale(1, squash);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.globalAlpha *= alpha;
    ctx.stroke();
    ctx.restore();
  };

  const orbitWidthA = Math.max(1.1, currentRingRadius * 0.05);
  const orbitWidthB = Math.max(1.0, currentRingRadius * 0.043);
  const orbitWidthC = Math.max(0.9, currentRingRadius * 0.036);

  drawOrbit(
    orbitA,
    this.rotation * 0.72,
    0.72,
    orbitWidthA,
    "rgba(255, 220, 170, 0.95)",
    0.48
  );

  drawOrbit(
    orbitB,
    -this.rotation * 0.93 + 1.1,
    0.58,
    orbitWidthB,
    "rgba(255, 196, 128, 0.92)",
    0.34
  );

  drawOrbit(
    orbitC,
    this.rotation * 1.75 + 1.15,
    0.82,
    orbitWidthC,
    "rgba(255, 209, 130, 0.9)",
    0.24
  );

  // Центральная двойная спираль.
  if (spiralSize > 0.01) {
    const turns = 1.9;
    const steps = 60;

    const drawSpiralArm = (phaseShift) => {
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;

        const a0 = t0 * Math.PI * 2 * turns + phaseShift;
        const a1 = t1 * Math.PI * 2 * turns + phaseShift;

        const r0 = spiralSize * (0.08 + t0 * 0.92);
        const r1 = spiralSize * (0.08 + t1 * 0.92);

        const x0 = Math.cos(a0) * r0;
        const y0 = Math.sin(a0) * r0 * 0.82;
        const x1 = Math.cos(a1) * r1;
        const y1 = Math.sin(a1) * r1 * 0.82;

        const centerWeight = 1 - t0;
        const taperedWidth =
          Math.max(0.8, spiralSize * (0.28 * Math.pow(centerWeight, 1.12) + 0.04));

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineWidth = taperedWidth;
        ctx.strokeStyle = "rgba(255, 224, 170, 0.95)";
        ctx.stroke();
      }
    };

    ctx.save();
    ctx.rotate(this.rotation * 0.92 - 0.35);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(255, 214, 150, 0.22)";

    drawSpiralArm(0);
    drawSpiralArm(Math.PI);

    ctx.beginPath();
    ctx.arc(0, 0, spiralSize * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(248, 198, 118, 0.98)";
    ctx.fill();

    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, spiralSize * 0.4);
    coreGlow.addColorStop(0, "rgba(255, 232, 190, 0.32)");
    coreGlow.addColorStop(1, "rgba(255, 232, 190, 0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, 0, spiralSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

  isHit(starlet) {
    if (!this.active || this.radius <= 0.001) return false;
    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + starlet.radius;
  }

  blocksObstacle(obstacle) {
    if (!this.active || this.ringRadius <= 0.001) return false;
    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.ringRadius + obstacle.ringRadius;
  }

  repelObstacle(obstacle) {
    if (!this.active || this.ringRadius <= 0.001) return;

    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const overlap = this.ringRadius + obstacle.ringRadius - dist;

    if (overlap > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      obstacle.x += nx * overlap;
      obstacle.y += ny * overlap;

      const dot = obstacle.vx * nx + obstacle.vy * ny;
      if (dot < 0) {
        obstacle.vx -= 2 * dot * nx;
        obstacle.vy -= 2 * dot * ny;
      }

      obstacle.vx += nx * 0.03;
      obstacle.vy += ny * 0.03;
    }
  }
}

class FreeStarlet {
  constructor(x, y, entrySide, sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = x;
    this.y = y;
    this.entrySide = entrySide;

    this.phase = Math.random() * Math.PI * 2;
    this.wander = Math.random() * 0.22 + 0.08;
    this.wanderY = this.wander * 0.5;
    this.rotation = Math.random() * Math.PI * 2;

    
    this.driftSpeed = 0.55 + Math.random() * 0.35;
    this.steer = 0.035;

    
    this.driftMinX = sceneMetrics.width * 0.10;
    this.driftMaxX = sceneMetrics.width * 0.92;
    this.driftMinY = sceneMetrics.height * 0.12;
    this.driftMaxY = sceneMetrics.height * 0.88;

    this.targetX = x;
    this.targetY = y;

    const sizes = [0.66, 1, 1.33];
    this.sizeFactor = sizes[Math.floor(Math.random() * sizes.length)];
    this.radius = (sceneMetrics?.starletBaseRadius ?? 8) * this.sizeFactor;

    const colors = ["#f5b670", "#DEA15E", "#FFF0B8"];
    this.outerColor = colors[Math.floor(Math.random() * colors.length)];
    this.highlightColor =
      this.outerColor === "#FFF0B8" ? "#FFF7D6" : "#FFF0D0";

    
    if (entrySide === "right") {
      this.vx = -0.42 - Math.random() * 0.18;
      this.vy = (Math.random() - 0.5) * 0.2;
    } else if (entrySide === "top") {
      this.vx = -0.18 - Math.random() * 0.16;
      this.vy = 0.22 + Math.random() * 0.12;
    } else {
      // bottom
      this.vx = -0.18 - Math.random() * 0.16;
      this.vy = -0.22 - Math.random() * 0.12;
    }

    this.pickNewTarget();
  }

  pickNewTarget() {
    this.targetX =
      this.driftMinX + Math.random() * (this.driftMaxX - this.driftMinX);
    this.targetY =
      this.driftMinY + Math.random() * (this.driftMaxY - this.driftMinY);
  }

  update(delta = 0.016) {
    const t = performance.now();

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    if (dist < 18) {
      this.pickNewTarget();
    }

    const desiredVx = (dx / dist) * this.driftSpeed;
    const desiredVy = (dy / dist) * this.driftSpeed;

    this.vx += (desiredVx - this.vx) * this.steer;
    this.vy += (desiredVy - this.vy) * this.steer;

    this.x += this.vx;
    this.y += this.vy;

    
    this.x += Math.sin(t * 0.0012 + this.phase) * this.wander;
    this.y += Math.cos(t * 0.0011 + this.phase) * this.wanderY;

    if (this.x < this.driftMinX || this.x > this.driftMaxX) {
      this.x = Math.max(this.driftMinX, Math.min(this.driftMaxX, this.x));
      this.vx *= 0.85;
      this.pickNewTarget();
    }

    if (this.y < this.driftMinY || this.y > this.driftMaxY) {
      this.y = Math.max(this.driftMinY, Math.min(this.driftMaxY, this.y));
      this.vy *= 0.85;
      this.pickNewTarget();
    }

    this.rotation += 0.015;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    drawStarPath(ctx, 0, 0, this.radius + 2.4, this.radius * 0.48, 5);
    ctx.fillStyle = this.outerColor;
    ctx.fill();

    drawStarPath(ctx, 0, 0, this.radius + 2.4, this.radius * 0.48, 5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 244, 220, 0.95)";
    ctx.stroke();

    drawStarPath(ctx, -1, -1, this.radius * 0.56, this.radius * 0.24, 5);
    ctx.fillStyle = this.highlightColor;
    ctx.fill();

    ctx.restore();
  }

  isOffscreen() {
    const { width, height, offscreenOffset } = this.sceneMetrics;
    return (
      this.x < -offscreenOffset ||
      this.x > width + offscreenOffset ||
      this.y < -offscreenOffset ||
      this.y > height + offscreenOffset
    );
  }
}

class Obstacle {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    const {
      width,
      height,
      laneInsetX,
      offscreenOffset,
      obstacleMinWidth,
      obstacleMaxWidth,
      obstacleMinHeight,
      obstacleMaxHeight,
    } = sceneMetrics;

    const edges = ["top", "bottom", "left", "right"];
    this.edge = edges[Math.floor(Math.random() * edges.length)];

    const sizeMix = Math.random();
    this.width =
      obstacleMinWidth + (obstacleMaxWidth - obstacleMinWidth) * sizeMix;
    this.height =
      obstacleMinHeight + (obstacleMaxHeight - obstacleMinHeight) * sizeMix;

    const drift = 0.18 + Math.random() * 0.22;
    const travel = 0.42 + Math.random() * 0.2;
    const spawnDepth = offscreenOffset * (0.7 + Math.random() * 0.7);

    if (this.edge === "top" || this.edge === "bottom") {
      const minX = laneInsetX;
      const maxX = width * (2 / 3) - laneInsetX;
      this.x = minX + Math.random() * Math.max(24, maxX - minX);
      this.y = this.edge === "top" ? -spawnDepth : height + spawnDepth;
      this.vx = (Math.random() - 0.5) * drift;
      this.vy = this.edge === "top" ? travel : -travel;
    } else {
      this.x = this.edge === "left" ? -spawnDepth : width + spawnDepth;
      this.y = Math.random() * height;
      this.vx = this.edge === "left" ? travel * 1.08 : -travel * 1.08;
      this.vy = (Math.random() - 0.5) * drift;
    }

    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.016;

    const maxSide = Math.max(this.width, this.height);
    this.starRadius = maxSide * 0.24;
    this.ringRadius = maxSide * 0.42;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    const cx = this.x;
    const cy = this.y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.translate(-cx, -cy);

    ctx.beginPath();
    ctx.arc(cx, cy, this.ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = "rgba(126, 60, 72, 0.92)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, this.ringRadius - 5, 0, Math.PI * 2);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = "rgba(126, 60, 72, 0.62)";
    ctx.stroke();

    drawStarPath(ctx, cx, cy, this.starRadius, this.starRadius * 0.48, 5);
    ctx.fillStyle = "#0d1427";
    ctx.fill();

    drawStarPath(ctx, cx, cy, this.starRadius, this.starRadius * 0.48, 5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#7e3c48";
    ctx.stroke();

    ctx.restore();
  }

  collidesWith(starlet) {
    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.ringRadius + starlet.radius;
  }

  isOffscreen() {
    const { width, height, obstacleCullOffset } = this.sceneMetrics;
    return (
      this.x < -obstacleCullOffset ||
      this.x > width + obstacleCullOffset ||
      this.y < -obstacleCullOffset ||
      this.y > height + obstacleCullOffset
    );
  }
}

class Particle {
  constructor(x, y, color, cool = false, options = {}) {
    this.x = x;
    this.y = y;

    this.vx = options.vx ?? (Math.random() - 0.5) * 4;
    this.vy = options.vy ?? (Math.random() - 0.5) * 4;

    this.life = options.life ?? 1;
    this.decay = options.decay ?? (0.03 + Math.random() * 0.02);

    this.color = color;
    this.size = options.size ?? (2 + Math.random() * 3);
    this.cool = cool;

    this.gravity = options.gravity ?? 0;
    this.shrink = options.shrink ?? 0;
    this.alphaBoost = options.alphaBoost ?? 1;

   
    this.attractTo = options.attractTo ?? null; // {x, y}
    this.attractPull = options.attractPull ?? 0;
  }

  update() {
    if (this.attractTo && this.attractPull > 0) {
      this.vx += (this.attractTo.x - this.x) * this.attractPull;
      this.vy += (this.attractTo.y - this.y) * this.attractPull;
    }

    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.size = Math.max(0.2, this.size - this.shrink);
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life) * this.alphaBoost;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    if (this.cool) {
      ctx.strokeStyle = "rgba(53, 97, 132, 0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

class TutorGuide2 {
  constructor() {
    this.enabled = true;
    this.active = false;
    this.completed = false;

    this.x = 0;
    this.y = 0;
    this.speed = 240;

    
    this.color = "#ff6e7e";
    this.glowColor = "rgba(255, 110, 126, 0.45)";

    this.mode = "none";
    // waiting в†’ markBlack в†’ toRing в†’ markRing в†’ toStar в†’ markStar в†’ toStar2 в†’ fading в†’ restart
    this.phase = "waiting";

    this.blackTarget = null;
    this.ringTarget = null;
    this.firstStar = null;
    this.secondStar = null;

    this.pathOpacity = 1;
    this.rings = [];

    this.fadeDelay = 0.5;
    this.fadeDuration = 0.8;
    this.fadeTimer = 0;

    this.holdTimer = 0;
    this.markHoldDuration = 0.24;
    this.arrivalThreshold = 8;

    this.restartDelay = 0.45;
    this.restartTimer = 0;

    this.startDelay = 2.0;
    this.startTimer = 0;
  }

  reset({ enabled = true } = {}) {
    this.enabled = enabled;
    this.active = false;
    this.completed = false;

    this.x = 0;
    this.y = 0;

    this.mode = "none";
    this.phase = "waiting";

    this.blackTarget = null;
    this.ringTarget = null;
    this.firstStar = null;
    this.secondStar = null;

    this.pathOpacity = 1;
    this.rings = [];

    this.fadeTimer = 0;
    this.holdTimer = 0;
    this.restartTimer = 0;
    this.startTimer = 0;
  }

  disable() {
    this.completed = true;
    this.active = false;
    this.mode = "none";
    this.phase = "done";
    this.pathOpacity = 0;
    this.rings = [];
    this.blackTarget = null;
    this.ringTarget = null;
    this.firstStar = null;
    this.secondStar = null;
    this.fadeTimer = 0;
    this.holdTimer = 0;
    this.restartTimer = 0;
    this.startTimer = 0;
  }

  
  notifySuccess() {
    this.disable();
  }

 

  isInTutorZone(target, game) {
    if (!target || !game?.sceneMetrics) return false;
    const rightHalfMinX = game.sceneMetrics.width * 0.5;
    return target.x >= rightHalfMinX;
  }

  update(delta, game) {
    if (!this.enabled || this.completed || !game.isRunning || game.gameOver) {
      return;
    }

    this.updateRings(delta, game);

    
    if (game.eatenCount > 0) {
      this.disable();
      return;
    }

    if (!this.active) {
      if (this.phase === "waiting") {
        this.startTimer += delta;
        if (this.startTimer < this.startDelay) return;

        this.beginFullHint(game);
        return;
      }

      if (this.phase === "fading") {
        this.updateFade(delta);
        return;
      }

      if (this.phase === "restart") {
        this.restartTimer -= delta;
        if (this.restartTimer <= 0) {
          this.phase = "waiting";
          this.startTimer = 0;
        }
        return;
      }

      return;
    }

    this.handleTargetLoss(game);

    if (!this.active) {
      if (this.phase === "fading") this.updateFade(delta);
      return;
    }

    if (this.mode === "full") {
      this.updateFullMode(delta, game);
    }
  }

  
  handleTargetLoss(game) {
    if (this.mode !== "full") return;

    const firstAlive =
      this.firstStar &&
      game.starlets.includes(this.firstStar) &&
      this.isInTutorZone(this.firstStar, game);

    const secondAlive =
      this.secondStar &&
      game.starlets.includes(this.secondStar) &&
      this.isInTutorZone(this.secondStar, game);

    if (!firstAlive || !secondAlive) {
      this.startFadeOut();
    }
  }

  beginFullHint(game) {
    
    if (!game.blacklet || !game.starlets || game.starlets.length < 2) {
      this.phase = "waiting";
      return false;
    }

    const pool = game.starlets.filter((starlet) =>
      this.isInTutorZone(starlet, game)
    );

    if (pool.length < 2) {
      this.phase = "waiting";
      return false;
    }

    const firstIndex = Math.floor(Math.random() * pool.length);
    this.firstStar = pool.splice(firstIndex, 1)[0];

    const secondIndex = Math.floor(Math.random() * pool.length);
    this.secondStar = pool[secondIndex];

    this.blackTarget = game.blacklet;
    this.ringTarget = game.redRing;

    this.mode = "full";
    this.phase = "markBlack";

    this.x = this.blackTarget.x + 30;
    this.y = this.blackTarget.y - 18;

    this.pathOpacity = 1;
    this.rings = [];
    this.addRing(this.blackTarget);

    this.holdTimer = this.markHoldDuration;
    this.active = true;
    this.startTimer = 0;

    return true;
  }

  updateFullMode(delta, game) {
    this.blackTarget = game.blacklet;
    this.ringTarget = game.redRing;

    if (
      !this.firstStar ||
      !game.starlets.includes(this.firstStar) ||
      !this.isInTutorZone(this.firstStar, game)
    ) {
      this.startFadeOut();
      return;
    }

    if (
      !this.secondStar ||
      !game.starlets.includes(this.secondStar) ||
      !this.isInTutorZone(this.secondStar, game)
    ) {
      this.startFadeOut();
      return;
    }

    
    if (this.phase === "markBlack") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toRing";
      return;
    }

    
    if (this.phase === "toRing") {
      const target = this.ringTarget ?? this.blackTarget;
      const arrived = this.moveTowards(target.x, target.y, delta);

      if (arrived) {
        if (this.ringTarget) this.addRing(this.ringTarget);
        this.phase = "markRing";
        this.holdTimer = this.markHoldDuration;
      }
      return;
    }

    
    if (this.phase === "markRing") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toStar";
      return;
    }

    
    if (this.phase === "toStar") {
      const arrived = this.moveTowards(
        this.firstStar.x,
        this.firstStar.y,
        delta
      );

      if (arrived) {
        this.addRing(this.firstStar);
        this.phase = "markStar";
        this.holdTimer = this.markHoldDuration;
      }
      return;
    }

    // 5) РћС‚РјРµС‚РёС‚СЊ РїРµСЂРІС‹Р№ СЃС‚Р°СЂР»РµС‚
    if (this.phase === "markStar") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toStar2";
      return;
    }

    
    if (this.phase === "toStar2") {
      const arrived = this.moveTowards(
        this.secondStar.x,
        this.secondStar.y,
        delta
      );

      if (arrived) {
        this.addRing(this.secondStar);
        this.active = false;
        this.phase = "fading";
        this.fadeTimer = 0;
      }
      return;
    }
  }

  startFadeOut() {
    this.active = false;
    this.mode = "none";
    this.phase = "fading";
    this.fadeTimer = 0;
  }

  updateFade(delta) {
    this.fadeTimer += delta;

    if (this.fadeTimer <= this.fadeDelay) {
      this.pathOpacity = 1;
      return;
    }

    const fadeT = Math.min(
      1,
      (this.fadeTimer - this.fadeDelay) / this.fadeDuration
    );
    this.pathOpacity = 1 - fadeT;

    if (fadeT >= 1) {
      this.rings = [];
      this.blackTarget = null;
      this.ringTarget = null;
      this.firstStar = null;
      this.secondStar = null;
      this.pathOpacity = 1;
      this.phase = "restart";
      this.restartTimer = this.restartDelay;
    }
  }

  addRing(target) {
    if (!target) return;

    const exists = this.rings.some((ring) => ring.target === target);
    if (exists) return;

    this.rings.push({
      target,
      radius: 18,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  updateRings(delta, game) {
    this.rings = this.rings.filter((ring) => {
      if (!ring.target) return false;
      if (this.phase === "fading" || this.phase === "done") return true;

      
      if (ring.target === this.blackTarget || ring.target === this.ringTarget) {
        return true;
      }

      return game.starlets.includes(ring.target);
    });

    for (const ring of this.rings) {
      ring.pulse += delta * 3.4;
    }
  }

  moveTowards(targetX, targetY, delta) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 0.001) return true;

    const step = this.speed * delta;

    if (dist <= step + this.arrivalThreshold) {
      this.x = targetX;
      this.y = targetY;
      return true;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return false;
  }

  drawPathTrail(ctx) {
    if (this.pathOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.pathOpacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(255, 68, 89, 0.82)";

    const black = this.blackTarget;
    const ring = this.ringTarget;
    const s1 = this.firstStar;
    const s2 = this.secondStar;

    
    if (this.phase === "toRing" && black && ring) {
      ctx.beginPath();
      ctx.moveTo(black.x, black.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (
      black &&
      ring &&
      (this.phase === "markRing" ||
        this.phase === "toStar" ||
        this.phase === "markStar" ||
        this.phase === "toStar2" ||
        this.phase === "fading")
    ) {
      ctx.beginPath();
      ctx.moveTo(black.x, black.y);
      ctx.lineTo(ring.x, ring.y);
      ctx.stroke();
    }

    
    if (this.phase === "toStar" && ring && s1) {
      ctx.beginPath();
      ctx.moveTo(ring.x, ring.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (
      ring &&
      s1 &&
      (this.phase === "markStar" ||
        this.phase === "toStar2" ||
        this.phase === "fading")
    ) {
      ctx.beginPath();
      ctx.moveTo(ring.x, ring.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }

    
    if ((this.phase === "toStar2" || this.phase === "fading") && s1 && s2) {
      const endX = this.phase === "fading" ? s2.x : this.x;
      const endY = this.phase === "fading" ? s2.y : this.y;

      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRings(ctx) {
    if (!this.rings.length || this.pathOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.pathOpacity;

    for (const ring of this.rings) {
      const target = ring.target;
      if (!target) continue;

      const pulse = 1 + Math.sin(ring.pulse) * 0.08;
      const radius = ring.radius * pulse;

      ctx.beginPath();
      ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 80, 100, 0.85)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(target.x, target.y, radius + 4, 0, Math.PI * 2);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(255, 128, 142, 0.35)";
      ctx.stroke();
    }

    ctx.restore();
  }

  drawCursor(ctx) {
    if (!this.active || this.pathOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.pathOpacity;

    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 24);
    glow.addColorStop(0, "rgba(255, 128, 142, 0.30)");
    glow.addColorStop(1, "rgba(255, 128, 142, 0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "rgba(255, 74, 95, 0.95)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 139, 153, 0.95)";
    ctx.fill();

    ctx.restore();
  }

  draw(ctx) {
    if (
      (!this.enabled && this.pathOpacity <= 0) ||
      this.phase === "done"
    ) {
      return;
    }

    this.drawPathTrail(ctx);
    this.drawRings(ctx);
    this.drawCursor(ctx);
  }
}

export class GameplayScene8 {
  constructor({
    sceneId = "game8",
    sceneManager = null,
    audio = null,
    onNext = null,
    onRoundFinished = null,
  } = {}) {
    this.sceneId = sceneId;
    this.sceneManager = sceneManager;
    this.audio = audio ?? new GameAudio();


this.eatAudio =
  this.audio && typeof this.audio.playEatSound === "function"
    ? this.audio
    : new GameAudio();

this.ringGoneAudio =
  this.audio && typeof this.audio.playRingGoneSound === "function"
    ? this.audio
    : this.eatAudio;        
    this.onNext = onNext;
    this.onRoundFinished = onRoundFinished;
    this.sceneMusicUrl = "../../assets/audio/game7.mp3";
    this.sceneBackgroundUrl = "../../assets/images/backgrounds/game_bg7.jpg";
    this.defaultBackgroundUrl = "../../assets/images/backgrounds/game_bg1.webp";

    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.savedCountElement = document.getElementById("savedCount");
    this.lostCountElement = document.getElementById("lostCount");
    this.scoreElement = document.getElementById("scoreValue");
    this.heartFillRect = document.getElementById("heartFillRect");
    this.heartIconElement = document.querySelector(".heart-icon");
    this.timeFillElement = document.getElementById("timeFill");

    this.overlay = document.getElementById("overlay");
    this.finalScoreElement = document.getElementById("finalScore");
    this.resultMessageElement = document.getElementById("resultMessage");
    this.resultTitleElement = document.getElementById("resultTitle");
    this.targetScoreElement = document.getElementById("targetScore");

    this.rankMedalElements = Array.from(
      document.querySelectorAll("[data-rank-medal]")
    );
    this.finalRankMedalElements = Array.from(
      document.querySelectorAll("[data-final-rank-medal]")
    );
    this.finalRankLabelElement = document.getElementById("finalRankLabel");

    this.restartBtn = document.getElementById("restartBtn");
    this.nextBtn = document.getElementById("nextBtn");

    this.rotateHint = document.getElementById("rotateHint");

    
    this.startScreen = document.getElementById("startScreen");
    this.tutorialEnabledInput = document.getElementById("tutorialEnabled");
    this.instructionsElement = document.querySelector(".instructions");
    this.defaultInstructionsText =
    this.instructionsElement?.textContent?.trim() ||
    "Соедини черную звезду и красное кольцо -> Берегись красных звезд - они охотятся за кольцом!";


    this.levelTargetScore = 400;
    this.levelPassed = false;
    this.displayedHeartProgress = 0;
    this.targetHeartProgress = 0;
    this.heartPulseTimeout = null;
    this.motherStar = null


    this.blacklet = null;       
    this.redlets = [];
    this.redletSpawnTimer = 0;
    this.redletSpawnInterval = 7.5;
    this.redletTrailTimer = 0;
    this.redRing = null;
    this.prevRedRingState = null;        
    this.starlets = [];        
    this.obstacles = [];
    this.particles = [];

    this.score = 0;
    this.savedCount = 0;        
    this.lostCount = 0;       
    this.eatenCount = 0;       

    this.timeLeft = 50;
    this.totalTime = 50;

    this.gameOver = false;
    this.isRunning = false;
    this.isTransitioning = false;
    this.lastTime = performance.now();
    this.rafId = null;

    this.obstacleTimer = 0;
    this.obstacleInterval = 2200;

    this.isDragging = false;
    this.mousePos = { x: 0, y: 0 };
    this.hasPlayerInteracted = false;

    
    this.spawnPhase = "intro_blacklet";
    this.spawnTimer = 0;
    this.starletsSpawned = false;

   
    this.tutor = new TutorGuide2();
    this.tutorialEnabledForRun = false;

    this.inputBound = false;
    this.handlePointerMoveCore = null;
    this.handlePointerDown = null;
    this.handlePointerMove = null;
    this.handlePointerEnd = null;

    this.handleRestartClick = () => {
      if (this.isTransitioning) return;
      this.isDragging = false;
      this.resetGame({ restartAmbient: true });
    };

    this.handleNextClick = async () => {
      if (this.isTransitioning) return;

      console.log("[StarLine] next click", {
        sceneId: this.sceneId,
        levelPassed: this.levelPassed,
        onNext: !!this.onNext,
        hasSceneManagerNext: !!this.sceneManager?.next,
      });

      if (!this.levelPassed) return;

      this.isTransitioning = true;

      const fadeDuration = 0.28;

      try {
        if (this.nextBtn) {
          this.nextBtn.classList.add("actionBtn-disabled");
          this.nextBtn.disabled = true;
          this.playButtonFadeGlow(this.nextBtn, fadeDuration);
        }

        if (this.restartBtn) {
          this.restartBtn.classList.add("actionBtn-disabled");
          this.restartBtn.disabled = true;
        }

        this.isDragging = false;
        this.isRunning = false;

        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }

        await this.audio.fadeOutAmbient(fadeDuration);

        if (this.overlay) {
          this.overlay.classList.remove("show");
        }

        console.log("[StarLine] next -> transition");

        const sceneRank = this.getSceneRank();
        const sceneRankLabel = this.getSceneRankLabel(sceneRank);
        const sceneRankTitle = this.getSceneRankTitle(sceneRank);

        this.onRoundFinished?.({
          sceneId: this.sceneId,
          score: this.score,
          savedCount: this.savedCount,
          lostCount: this.lostCount,
          levelPassed: this.levelPassed,
          levelTargetScore: this.levelTargetScore,
          sceneRank,
          sceneRankLabel,
          sceneRankTitle,
        });

        if (this.onNext) {
          await this.onNext();
        } else if (this.sceneManager?.next) {
          await this.sceneManager.next();
        }
      } catch (error) {
        console.error("[StarLine] next transition failed", error);

        if (this.overlay) {
          this.overlay.classList.add("show");
        }

        if (this.nextBtn) {
          this.nextBtn.classList.remove("actionBtn-disabled");
          this.nextBtn.disabled = false;
          this.nextBtn.classList.remove("actionBtn-fade-glow");
          this.nextBtn.style.removeProperty("--fade-glow-duration");
        }

        if (this.restartBtn) {
          this.restartBtn.classList.remove("actionBtn-disabled");
          this.restartBtn.disabled = false;
        }
      } finally {
        this.isTransitioning = false;
      }
    };

    this.handleResize = this.resize.bind(this);

    this.restartBtn?.addEventListener("click", this.handleRestartClick);
    this.nextBtn?.addEventListener("click", this.handleNextClick);

    this.resize();
    window.addEventListener("resize", this.handleResize);

    this.setupInput();

    
    this.initSceneObjects();

    this.updateTargetScoreUI();
    this.updateUI();
    this.draw();
  }

  
  initSceneObjects() {
    this.blacklet = new Blacklet(this.sceneMetrics);
    this.motherStar = new MotherStar(this.sceneMetrics)
    this.redRing = new RedRing(this.sceneMetrics);
    this.redRing.onGone = () => {
    console.log("RedRing onGone callback");
    this.eatAudio.playRingGoneSound?.();
  };

    this.prevRedRingState = this.redRing?.state ?? null;

    this.starlets = [];
    this.redlets = [];
    this.redletSpawnTimer = 0;
    this.redletTrailTimer = 0;
    this.redletSpawnInterval = 7.5;
    this.obstacles = [];

    
    this.spawnPhase = "intro_blacklet";
    this.spawnTimer = 0;
    this.starletsSpawned = false;

    
    this.redRing.spawnDelay = 0;
  }

  isLandscape() {
    return window.innerWidth >= window.innerHeight;
  }

  computeSceneMetrics() {
  const width = this.canvas.width;
  const height = this.canvas.height;
  const clamp = (min, value, max) => Math.max(min, Math.min(max, value));
  const playScale = clamp(0.9, width / 1366, 1.18);

  this.sceneMetrics = {
    width,
    height,
    playScale,
    laneInsetX: width * 0.04,
    offscreenOffset: width * 0.06,
    obstacleCullOffset: width * 0.16,
    homeRadius: clamp(30, 34 * playScale, 42),
    homeRingRadius: clamp(52, 60 * playScale, 74),
    homeGlowRadius: clamp(116, 140 * playScale, 170),

    starletBaseRadius: clamp(6.6, 7.0 * playScale, 8.9),
    starletDragRadius: clamp(24, 28 * playScale, 34),

      obstacleMinWidth: clamp(37, 44 * playScale, 56),
      obstacleMaxWidth: clamp(74, 88 * playScale, 104),
      obstacleMinHeight: clamp(60, 70 * playScale, 84),
      obstacleMaxHeight: clamp(104, 123 * playScale, 144),
    };
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.computeSceneMetrics();

    if (this.motherStar) this.motherStar.setBounds(this.sceneMetrics)

    if (this.blacklet) {
      this.blacklet.setBounds(this.sceneMetrics);
    }
    if (this.redRing) {
      this.redRing.setBounds(this.sceneMetrics);
    }

    if (this.redlets?.length) {
      this.redlets.forEach((r) => r.setBounds(this.sceneMetrics));
    }

    if (this.rotateHint) {
      this.rotateHint.classList.toggle(
        "show",
        !this.isLandscape() && !this.gameOver && !this.isRunning
      );
    }
  }

  playButtonFadeGlow(button, duration = 0.32) {
    if (!button) return;

    button.classList.remove("actionBtn-fade-glow");
    void button.offsetWidth;
    button.style.setProperty("--fade-glow-duration", `${duration}s`);
    button.classList.add("actionBtn-fade-glow");

    window.setTimeout(() => {
      button.classList.remove("actionBtn-fade-glow");
      button.style.removeProperty("--fade-glow-duration");
    }, duration * 1000 + 40);
  }

  applySceneBackground() {
    if (!this.sceneBackgroundUrl) return;

    const bgUrl = new URL(this.sceneBackgroundUrl, import.meta.url).href;
    document.documentElement.style.setProperty(
      "--scene-bg-image",
      `url("${bgUrl}")`
    );
  }

  resetSceneBackground() {
    const fallbackUrl = new URL(this.defaultBackgroundUrl, import.meta.url).href;
    document.documentElement.style.setProperty(
      "--scene-bg-image",
      `url("${fallbackUrl}")`
    );
  }

  applySceneAudio() {
    if (typeof this.audio?.setMusic === "function") {
      this.audio.setMusic(this.sceneMusicUrl);
    }
  }

  
  readTutorialEnabled() {
    if (this.tutorialEnabledInput) {
      return !!this.tutorialEnabledInput.checked;
    }
    return true;
  }
  getSceneInstructionsText() {
  if (this.sceneId === "game7" || this.sceneId === "game8") {
    return "Соедини черную звезду и красное кольцо -> Но берегись красных звезд, они охотятся за кольцом!";
  }

  return this.defaultInstructionsText;
}

  async start() {
    console.log("START STATE", {
      isRunning: this.isRunning,
      gameOver: this.gameOver,
      isTransitioning: this.isTransitioning,
      startScreenShown: this.startScreen?.classList.contains("show"),
    });

    if (this.isTransitioning) return;
    if (this.isRunning && !this.gameOver) return;

    this.applySceneAudio();
    this.applySceneBackground();

    if (this.instructionsElement) {
      this.instructionsElement.textContent = this.getSceneInstructionsText();
    }

    try {
      await this.audio.init();
      this.audio.startAmbient();
      console.log("audio init ok");
    } catch (e) {
      console.warn("Audio init skipped", e);
    }

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
      console.log("startScreen hidden");
    }

    if (this.rotateHint) {
      this.rotateHint.classList.toggle("show", !this.isLandscape());
      console.log("rotate hint updated");
    }

    
    this.tutorialEnabledForRun = this.readTutorialEnabled();
    this.tutor.reset({ enabled: this.tutorialEnabledForRun });

    this.isRunning = true;
    this.gameOver = false;
    this.lastTime = performance.now();
    console.log("before game loop");

    this.startGameLoop();
    console.log("game loop started");
  }

  getHeartProgress() {
    return Math.max(0, Math.min(1, this.score / this.levelTargetScore));
  }

  updateHeartProgress(delta) {
    const wasComplete = this.targetHeartProgress >= 1;

    this.targetHeartProgress = this.getHeartProgress();

    const speed = 3.6;
    const blend = 1 - Math.exp(-speed * delta);
    this.displayedHeartProgress +=
      (this.targetHeartProgress - this.displayedHeartProgress) * blend;

    if (
      Math.abs(this.targetHeartProgress - this.displayedHeartProgress) < 0.002
    ) {
      this.displayedHeartProgress = this.targetHeartProgress;
    }

    if (this.heartFillRect) {
      const heartMaskMaxWidth = 43.5;
      this.heartFillRect.setAttribute(
        "width",
        heartMaskMaxWidth * this.displayedHeartProgress
      );
    }

    if (this.heartIconElement) {
      this.heartIconElement.classList.toggle(
        "is-active",
        this.displayedHeartProgress > 0.02
      );

      const isComplete = this.targetHeartProgress >= 1;
      this.heartIconElement.classList.toggle("is-complete", isComplete);

      if (!wasComplete && isComplete) {
        this.heartIconElement.classList.add("is-pulsing");

        if (this.heartPulseTimeout) {
          clearTimeout(this.heartPulseTimeout);
        }

        this.heartPulseTimeout = setTimeout(() => {
          if (this.heartIconElement) {
            this.heartIconElement.classList.remove("is-pulsing");
          }
          this.heartPulseTimeout = null;
        }, 2200);
      }

      if (!isComplete) {
        this.heartIconElement.classList.remove("is-pulsing");
      }
    }
  }

  getRankThresholds() {
    return {
      oneMedalScore: Math.ceil(this.levelTargetScore * 1.25),
      twoMedalScore: Math.ceil(this.levelTargetScore * 1.6),
      threeMedalScore: 1200,
    };
  }

  getSceneRank() {
    if (!this.levelPassed) return 0;

    const { oneMedalScore, twoMedalScore, threeMedalScore } =
      this.getRankThresholds();

    if (this.score >= threeMedalScore) return 3;
    if (this.score >= twoMedalScore) return 2;
    if (this.score >= oneMedalScore) return 1;
    return 0;
  }

  getSceneRankLabel(rank = this.getSceneRank()) {
    switch (rank) {
      case 3:
        return "Космический друг";
      case 2:
        return "Звездочет";
      case 1:
        return "Проводник звезд";
      default:
        return "Юный проводник";
    }
  }

  getSceneRankTitle(rank = this.getSceneRank()) {
    switch (rank) {
      case 3:
        return "Космический друг";
      case 2:
        return "Звездочет";
      case 1:
        return "Проводник звезд";
      default:
        return "Юный проводник";
    }
  }

  updateRankUI() {
    const passedByScore = this.score >= this.levelTargetScore;
    const { oneMedalScore, twoMedalScore, threeMedalScore } =
      this.getRankThresholds();

    let liveMedalCount = 0;
    if (passedByScore && this.score >= oneMedalScore) liveMedalCount = 1;
    if (passedByScore && this.score >= twoMedalScore) liveMedalCount = 2;
    if (passedByScore && this.score >= threeMedalScore) liveMedalCount = 3;

    this.rankMedalElements.forEach((element, index) => {
      const medalIndex = index + 1;
      element.classList.toggle("is-lit", liveMedalCount >= medalIndex);
      element.classList.toggle("is-locked", liveMedalCount < medalIndex);
    });

    const finalRank = this.getSceneRank();

    this.finalRankMedalElements.forEach((element, index) => {
      const medalIndex = index + 1;
      element.classList.toggle("is-lit", finalRank >= medalIndex);
      element.classList.toggle("is-locked", finalRank < medalIndex);
    });

    if (this.finalRankLabelElement) {
      this.finalRankLabelElement.textContent =
        this.getSceneRankLabel(finalRank);
    }
  }

  showRoundResult() {
    if (this.isTransitioning) return;

    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = this.score;
    }

    if (this.targetScoreElement) {
      this.targetScoreElement.textContent = this.levelTargetScore;
    }

    if (this.resultTitleElement) {
      this.resultTitleElement.textContent = this.levelPassed
        ? "Ночь закончилась"
        : "Почти получилось";
    }

    if (this.resultMessageElement) {
      this.resultMessageElement.textContent = this.levelPassed
        ? "Девочка счастлива — она спасла так много звёзд!"
        : "Девочка надеялась спасти больше звёзд.";
    }

    this.updateRankUI();

    if (this.nextBtn) {
      this.nextBtn.classList.remove("actionBtn-fade-glow");
      this.nextBtn.style.removeProperty("--fade-glow-duration");

      if (this.levelPassed) {
        this.nextBtn.classList.remove("actionBtn-disabled");
        this.nextBtn.disabled = false;
      } else {
        this.nextBtn.classList.add("actionBtn-disabled");
        this.nextBtn.disabled = true;
      }
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove("actionBtn-fade-glow");
      this.restartBtn.style.removeProperty("--fade-glow-duration");
      this.restartBtn.classList.remove("actionBtn-disabled");
      this.restartBtn.disabled = false;
    }

    this.audio.playGameOverSound();
    this.overlay?.classList.add("show");
    this.updateUI();
  }

  resetGame = ({ restartAmbient = false } = {}) => {
    console.log("[StarLine] resetGame()", {
      sceneId: this.sceneId,
      overlayShown: this.overlay?.classList.contains("show"),
      isRunning: this.isRunning,
      gameOver: this.gameOver,
      isTransitioning: this.isTransitioning,
    });

    this.starlets = [];
    this.obstacles = [];
    this.particles = [];
    this.redlets = [];
    this.redletSpawnTimer = 0;
    this.redletTrailTimer = 0;
    this.redletSpawnInterval = 7.5;

    this.score = 0;
    this.savedCount = 0;
    this.lostCount = 0;
    this.eatenCount = 0;

    this.displayedHeartProgress = 0;
    this.targetHeartProgress = 0;

    if (this.heartPulseTimeout) {
      clearTimeout(this.heartPulseTimeout);
      this.heartPulseTimeout = null;
    }

    if (this.heartFillRect) {
      this.heartFillRect.setAttribute("width", 0);
    }

    if (this.heartIconElement) {
      this.heartIconElement.classList.remove(
        "is-active",
        "is-complete",
        "is-pulsing"
      );
    }

    this.timeLeft = this.totalTime;
    this.levelPassed = false;

    this.gameOver = false;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.obstacleTimer = 0;
    this.obstacleInterval = 2200;

    this.isDragging = false;
    this.mousePos = { x: 0, y: 0 };
    this.hasPlayerInteracted = false;

    if (this.overlay) {
      this.overlay.classList.remove("show");
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove(
        "actionBtn-disabled",
        "actionBtn-fade-glow"
      );
      this.restartBtn.disabled = false;
      this.restartBtn.style.removeProperty("--fade-glow-duration");
    }

    if (this.nextBtn) {
      this.nextBtn.classList.remove("actionBtn-fade-glow");
      this.nextBtn.classList.add("actionBtn-disabled");
      this.nextBtn.disabled = true;
      this.nextBtn.style.removeProperty("--fade-glow-duration");
    }

    // РџРµСЂРµСЃРѕР·РґР°С‘Рј РѕР±СЉРµРєС‚С‹ РїРµСЂРµРІС‘СЂРЅСѓС‚РѕРіРѕ СЂРµР¶РёРјР° Рё СЃРїР°РІРЅ-РґРёСЂРµРєС‚РѕСЂ.
    this.initSceneObjects();

    // РўСѓС‚РѕСЂРёР°Р» РќР• РїРѕРєР°Р·С‹РІР°РµРј РїСЂРё В«РРіСЂР°С‚СЊ СЃРЅРѕРІР°В» (РїРµСЂРµР·Р°РїСѓСЃРє СѓСЂРѕРІРЅСЏ) вЂ”
    // РѕРЅ РёРіСЂР°РµС‚ С‚РѕР»СЊРєРѕ РїСЂРё РїРµСЂРІРѕРј РІС…РѕРґРµ РІ СЃС†РµРЅСѓ (РІ start()).
    this.tutorialEnabledForRun = false;
    this.tutor.reset({ enabled: false });

    this.updateUI();
    this.draw();

    // РњСѓР·С‹РєСѓ РќР• РїРµСЂРµР·Р°РїСѓСЃРєР°РµРј РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ вЂ” РѕРЅР° РїСЂРѕРґРѕР»Р¶Р°РµС‚ РёРіСЂР°С‚СЊ РЅРµРїСЂРµСЂС‹РІРЅРѕ.
    // РўРѕР»СЊРєРѕ РїРѕРґРЅРёРјР°РµРј РіСЂРѕРјРєРѕСЃС‚СЊ РѕР±СЂР°С‚РЅРѕ (РµСЃР»Рё РѕРЅР° Р±С‹Р»Р° РїСЂРёРіР»СѓС€РµРЅР° РѕРІРµСЂР»РµРµРј).
    if (restartAmbient) {
      this.audio.startAmbient({ restart: false });
    }

    this.startGameLoop();
  };

 
  spawnStarlets(count) {
    const { width, height, offscreenOffset } = this.sceneMetrics;
    const margin = 24;

    for (let i = 0; i < count; i++) {
      const sides = ["top", "bottom", "right"];
      const side = sides[Math.floor(Math.random() * sides.length)];

      const depth = offscreenOffset * (0.18 + Math.random() * 0.5);
      let x, y;

      if (side === "top") {
        x = margin + Math.random() * Math.max(1, width - margin * 2);
        y = -depth;
      } else if (side === "bottom") {
        x = margin + Math.random() * Math.max(1, width - margin * 2);
        y = height + depth;
      } else {
        // right
        x = width + depth;
        y = margin + Math.random() * Math.max(1, height - margin * 2);
      }

      this.starlets.push(new FreeStarlet(x, y, side, this.sceneMetrics));
    }
  }

  spawnStarletsFromMotherStar() {
  if (!this.motherStar?.isSpawnReady()) return;

  const maxStarlets = 12;
  const missing = Math.max(0, maxStarlets - this.starlets.length);
  if (missing <= 0) return;

  this.audio?.playStarletSpawnSound?.();

  const originX = this.motherStar.x;
  const originY = this.motherStar.y;

  for (let i = 0; i < missing; i++) {
    const starlet = new FreeStarlet(originX, originY, 'right', this.sceneMetrics);

    const angle = (Math.PI * 2 * i) / missing + Math.random() * 0.35;
    const speed = 0.9 + Math.random() * 0.45;
    const push = this.motherStar.radius * (0.18 + Math.random() * 0.18);

    starlet.x = originX + Math.cos(angle) * push;
    starlet.y = originY + Math.sin(angle) * push;

    starlet.vx = Math.cos(angle) * speed;
    starlet.vy = Math.sin(angle) * speed;

    starlet.targetX = starlet.x + Math.cos(angle) * (50 + Math.random() * 90);
    starlet.targetY = starlet.y + Math.sin(angle) * (50 + Math.random() * 90);

    this.starlets.push(starlet);
    this.emitStarletSpawnBurst(starlet.x, starlet.y);
  }
}

  removeOffscreenStarlets() {
    for (let i = this.starlets.length - 1; i >= 0; i--) {
      if (this.starlets[i].isOffscreen()) {
        this.starlets.splice(i, 1);
      }
    }
  }

  spawnRedlet() {
  const activeRedlets = this.redlets.filter(r => r && !r.markedForRemoval).length;
  if (activeRedlets >= 4) return null;

  const redlet = new Redlet(this.sceneMetrics);
  this.redlets.push(redlet);
  return redlet;
}

  forceDestroyRedRingForRedlet() {
  if (!this.redRing) return;
  this.redRing.destroy({ clearBlacklet: true });
}

  spawnObstacle() {
  const maxObstacles = 10;
  const activeObstacles = this.obstacles.filter(
    (o) => o && !o.isOffscreen()
  ).length;

  if (activeObstacles >= maxObstacles) return null;

  const obstacle = new Obstacle(this.sceneMetrics);
  this.obstacles.push(obstacle);
  return obstacle;
}

  spawnScatterEffect(x, y, color, cool = false) {
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x, y, color, cool));
    }
  }

  
  emitBlackletTrail(delta) {
    const b = this.blacklet;
    if (!b || !b.following) return;

    this._blackTrailTimer = (this._blackTrailTimer ?? 0) + delta;
    const interval = 0.05;

    while (this._blackTrailTimer >= interval) {
      this._blackTrailTimer -= interval;

      const angle = Math.random() * Math.PI * 2;
      const r = b.radius * (0.2 + Math.random() * 0.5);
      const px = b.x + Math.cos(angle) * r;
      const py = b.y + Math.sin(angle) * r;

      this.particles.push(
        new Particle(px, py, "rgba(224, 70, 86, 0.9)", false, {
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4 + 0.06,
          life: 0.6 + Math.random() * 0.2,
          decay: 0.05 + Math.random() * 0.03,
          size: 0.8 + Math.random() * 1.3,
          gravity: -0.0015,
          shrink: 0.012,
          alphaBoost: 0.6,
        })
      );
    }
  }

  
  emitComboTrail(delta) {
  const ring = this.redRing;
  if (!ring || !ring.isActiveCombo?.()) {
    this._comboTrailTimer = 0;
    return;
  }

  this._comboTrailTimer = (this._comboTrailTimer ?? 0) + delta;

  const intensity = ring.state === "decaying" ? 1.0 : 0.86;
  const interval = 0.018;

  while (this._comboTrailTimer >= interval) {
    this._comboTrailTimer -= interval;

    const burstCount = ring.state === "decaying" ? 3 : 2;

    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = ring.ringRadius * (0.82 + Math.random() * 0.34);

      const px = ring.x + Math.cos(angle) * radius;
      const py = ring.y + Math.sin(angle) * radius;

      this.particles.push(
        new Particle(px, py, "rgba(255, 55, 78, 0.92)", false, {
          vx: (Math.random() - 0.5) * 0.42 - 0.03,
          vy: (Math.random() - 0.5) * 0.42 + 0.02,
          life: 0.82 + Math.random() * 0.24,
          decay: 0.032 + Math.random() * 0.016,
          size: 1.0 + Math.random() * 1.45 * intensity,
          gravity: -0.0012,
          shrink: 0.008,
          alphaBoost: 0.82 + intensity * 0.14,
        })
      );
    }
  }
}

emitRedletTrails(delta) {
  if (!this.redlets?.length) return;

  this.redletTrailTimer = (this.redletTrailTimer ?? 0) + delta;
  const interval = 0.022;

  while (this.redletTrailTimer >= interval) {
    this.redletTrailTimer -= interval;

    for (const redlet of this.redlets) {
      if (!redlet || redlet.markedForRemoval) continue;

      const hasRing = !!redlet.hasCapturedRing;
      const angle = Math.random() * Math.PI * 2;

            if (!hasRing) {
        const r = redlet.radius * (0.08 + Math.random() * 0.42);
        const px = redlet.x + Math.cos(angle) * r;
        const py = redlet.y + Math.sin(angle) * r;

        this.particles.push(
          new Particle(px, py, "rgba(255, 55, 78, 0.92)", false, {
            vx: (Math.random() - 0.5) * 0.42,
            vy: (Math.random() - 0.5) * 0.42,
            life: 0.52 + Math.random() * 0.16,
            decay: 0.028 + Math.random() * 0.014,
            size: 1.02 + Math.random() * 1.08,
            gravity: -0.0012,
            shrink: 0.0085,
            alphaBoost: 0.9,
          })
        );

        this.particles.push(
          new Particle(px, py, "rgba(176, 40, 60, 0.52)", false, {
            vx: (Math.random() - 0.5) * 0.26,
            vy: (Math.random() - 0.5) * 0.26,
            life: 0.3 + Math.random() * 0.11,
            decay: 0.032 + Math.random() * 0.015,
            size: 0.76 + Math.random() * 0.72,
            gravity: -0.0007,
            shrink: 0.0075,
            alphaBoost: 0.64,
          })
        );

        if (Math.random() < 0.55) {
          this.particles.push(
            new Particle(px, py, "rgba(255, 170, 180, 0.24)", false, {
              vx: (Math.random() - 0.5) * 0.18,
              vy: (Math.random() - 0.5) * 0.18,
              life: 0.18 + Math.random() * 0.07,
              decay: 0.042 + Math.random() * 0.015,
              size: 0.44 + Math.random() * 0.38,
              shrink: 0.0065,
              alphaBoost: 0.43,
            })
          );
        }

        continue;
      }
      const readyPulse = 1 + Math.sin(redlet.pulsePhase) * 0.06;
      const ringRadius = redlet.radius * readyPulse * 1.55;
      const ringBand = Math.max(1.2, redlet.radius * 0.18);
      const r = ringRadius + (Math.random() - 0.5) * ringBand;

      const px = redlet.x + Math.cos(angle) * r;
      const py = redlet.y + Math.sin(angle) * r;

      this.particles.push(
        new Particle(px, py, "rgba(18, 24, 36, 0.96)", false, {
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.42,
          life: 0.58 + Math.random() * 0.18,
          decay: 0.026 + Math.random() * 0.014,
          size: 1.15 + Math.random() * 1.25,
          gravity: -0.0012,
          shrink: 0.008,
          alphaBoost: 0.96,
        })
      );

      this.particles.push(
        new Particle(px, py, "rgba(126, 60, 72, 0.52)", false, {
          vx: (Math.random() - 0.5) * 0.26,
          vy: (Math.random() - 0.5) * 0.26,
          life: 0.34 + Math.random() * 0.12,
          decay: 0.03 + Math.random() * 0.015,
          size: 0.85 + Math.random() * 0.85,
          gravity: -0.0007,
          shrink: 0.007,
          alphaBoost: 0.7,
        })
      );

      if (Math.random() < 0.55) {
        this.particles.push(
          new Particle(px, py, "rgba(220, 72, 88, 0.24)", false, {
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.5) * 0.18,
            life: 0.2 + Math.random() * 0.08,
            decay: 0.04 + Math.random() * 0.015,
            size: 0.5 + Math.random() * 0.45,
            shrink: 0.006,
            alphaBoost: 0.48,
          })
        );
      }
    }
  }
}

  
  emitEatBurst(x, y) {
  const center = { x: this.blacklet.x, y: this.blacklet.y };

  
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.35 + Math.random() * 0.9;

    this.particles.push(
      new Particle(x, y, "rgba(255, 236, 176, 0.95)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.28,
        decay: 0.03 + Math.random() * 0.018,
        size: 1.4 + Math.random() * 2.0,
        shrink: 0.012,
        alphaBoost: 0.88,
        gravity: -0.002 + Math.random() * 0.004,
      })
    );
  }

  
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.18 + Math.random() * 0.45;

    this.particles.push(
      new Particle(x, y, "rgba(255, 248, 220, 0.75)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.18,
        decay: 0.04 + Math.random() * 0.02,
        size: 0.8 + Math.random() * 1.2,
        shrink: 0.01,
        alphaBoost: 0.7,
      })
    );
  }

  
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.7 + Math.random() * 1.1;

    this.particles.push(
      new Particle(center.x, center.y, "rgba(255, 110, 126, 0.92)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.34 + Math.random() * 0.16,
        decay: 0.07 + Math.random() * 0.03,
        size: 1.1 + Math.random() * 1.6,
        shrink: 0.024,
        alphaBoost: 0.78,
      })
    );
  }
}

emitStarletSpawnBurst(x, y) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 1.6;

    this.particles.push(
      new Particle(x, y, "rgba(255, 210, 120, 0.98)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.9 + Math.random() * 0.3,
        decay: 0.022 + Math.random() * 0.012,
        size: 1.8 + Math.random() * 2.4,
        shrink: 0.01,
        alphaBoost: 1.0,
        gravity: -0.001 + Math.random() * 0.002,
      })
    );
  }

  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.35 + Math.random() * 0.9;

    this.particles.push(
      new Particle(x, y, "rgba(255, 245, 210, 0.95)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.55 + Math.random() * 0.22,
        decay: 0.03 + Math.random() * 0.015,
        size: 1.1 + Math.random() * 1.5,
        shrink: 0.012,
        alphaBoost: 0.92,
      })
    );
  }

  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.18 + Math.random() * 0.45;

    this.particles.push(
      new Particle(x, y, "rgba(255, 120, 120, 0.55)", false, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.16,
        decay: 0.04 + Math.random() * 0.018,
        size: 0.8 + Math.random() * 1.1,
        shrink: 0.014,
        alphaBoost: 0.72,
      })
    );
  }
}

  setupInput() {
    if (this.inputBound) return;

    this.handlePointerMoveCore = (x, y) => {
      this.mousePos = { x, y };
      this.isDragging = true;
    };

    this.handlePointerEnd = (e) => {
      this.isDragging = false;
      if (e?.pointerId != null && this.canvas?.hasPointerCapture?.(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    };

    this.handlePointerDown = (e) => {
      if (!this.isRunning || this.gameOver) return;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.handlePointerMoveCore(e.clientX, e.clientY);
      this.hasPlayerInteracted = true;
    };

    this.handlePointerMove = (e) => {
      if (!this.isRunning || this.gameOver) return;
      if (e.pointerType === "mouse" && e.buttons === 0 && !this.isDragging)
        return;
      this.handlePointerMoveCore(e.clientX, e.clientY);
    };

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerEnd);
    this.canvas.addEventListener("pointercancel", this.handlePointerEnd);
    this.canvas.addEventListener("pointerleave", this.handlePointerEnd);

    this.inputBound = true;
  }

  
  updateSpawnDirector(delta) {
  this.spawnTimer += delta;

  if (this.spawnPhase === "intro_blacklet") {
    
    if (this.blacklet && this.blacklet.redness > 0.25) {
      this.spawnPhase = "intro_ring";
      this.spawnTimer = 0;

      if (this.redRing) {
        this.redRing.activateIntro();
      }
    }
    return;
  }

  if (this.spawnPhase === "intro_ring") {
    
    if (this.spawnTimer >= 1.6) {
      this.spawnPhase = "intro_starlets_home";
      this.spawnTimer = 0;
    }
    return;
  }

  if (this.spawnPhase === "intro_starlets_home") {
    if (!this.starletsSpawned) {
      this.motherStar?.activate();
      this.spawnRedlet();
      this.redletSpawnTimer = 0;
      this.starletsSpawned = true;
    }

    
    if (this.spawnTimer >= 0.8) {
      this.spawnPhase = "gameplay_live";
      this.spawnTimer = 0;
      this.obstacleTimer = 0;
    }
    return;
  }

  
}

  update(currentTime) {
    if (!this.isRunning || this.gameOver) return;

    if (this.rotateHint) {
      this.rotateHint.classList.toggle("show", !this.isLandscape());
    }

    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.timeLeft -= delta;

    if (this.timeLeft <= 12 && !this.gameOver) {
      this.audio.duckAmbientForOverlay(12);
    }

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.gameOver = true;
      this.isRunning = false;

      this.levelPassed = this.score >= this.levelTargetScore;

      if (!this.isTransitioning) {
        this.showRoundResult();
      }
      return;
    }

   
    this.updateSpawnDirector(delta);

    const liveGameplay = this.spawnPhase === "gameplay_live";

    
    if (this.blacklet) {
      this.blacklet.update(this.mousePos, this.isDragging, delta);
    }

    
    if (this.redRing) {
      this.redRing.update(delta, this.blacklet);
    }
    
    this.emitBlackletTrail(delta);
    this.emitComboTrail(delta);

    if (liveGameplay) {
  this.redletSpawnTimer += delta;
  if (this.redletSpawnTimer >= this.redletSpawnInterval) {
    this.spawnRedlet();
    this.redletSpawnTimer = 0;

    if (this.redletSpawnInterval > 4.8) {
      this.redletSpawnInterval -= 0.18;
    }
  }
}

if (this.redlets?.length) {
  this.redlets.forEach((redlet) => redlet.update(delta, this.redRing, this.starlets, this.redlets))
}
this.emitRedletTrails(delta)

this.starlets.forEach(s => s.update(delta));
this.removeOffscreenStarlets();

if (this.motherStar) {
  this.motherStar.update(delta);

  if (this.motherStar.consumeSpawnPulse()) {
    this.spawnStarletsFromMotherStar();
  }
}

    
  
    if (liveGameplay) {
      this.obstacles.forEach((o) => {
        o.update();

        if (this.motherStar && this.motherStar.blocksObstacle(o)) this.motherStar.repelObstacle(o)

        if (this.redRing && this.redRing.blocksObstacle(o)) {
          this.redRing.repelObstacle(o);
        }
        
      });
    }

    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());
    this.redlets = this.redlets.filter((r) => r && !r.markedForRemoval);

    
    this.checkComboEats();

    if (liveGameplay) {
      this.checkRedletRingCapture();
      this.checkRedletStarletEats();
      this.checkObstacleCollisions();
    }
    
   
    if (liveGameplay) {
      this.obstacleTimer += delta * 1000;
      if (this.obstacleTimer >= this.obstacleInterval) {
        this.spawnObstacle();
        this.obstacleTimer = 0;
      }

      if (this.score >= 60) this.obstacleInterval = 2000;
      if (this.score >= 140) this.obstacleInterval = 1800;
      if (this.score >= 260) this.obstacleInterval = 1600;

      }

    

    this.updateHeartProgress(delta);
    this.updateUI();
  }

  
checkComboEats() {
  const b = this.blacklet;
  if (!b || !b.canAbsorb()) return;

  for (let i = this.starlets.length - 1; i >= 0; i--) {
    const starlet = this.starlets[i];
    if (b.eats(starlet)) {
      this.score += 5;
      this.savedCount += 1;
      this.eatenCount += 1; // С‚СЂРёРіРіРµСЂ РІС‹РєР»СЋС‡РµРЅРёСЏ С‚СѓС‚РѕСЂРёР°Р»Р°
      this.eatAudio.playEatSound();
      this.emitEatBurst(starlet.x, starlet.y);
      this.starlets.splice(i, 1);
    }
  }
}

checkRedletRingCapture() {
  if (!this.redRing || !this.redlets?.length) return;
  if (this.redRing.state === "gone") return;

  for (const redlet of this.redlets) {
    if (!redlet || redlet.markedForRemoval || redlet.hasCapturedRing) continue;

    if (redlet.collidesWithRing(this.redRing)) {
      redlet.captureRing();

      this.forceDestroyRedRingForRedlet();

      break;
    }
  }
}

checkRedletStarletEats() {
  if (!this.redlets?.length || !this.starlets?.length) return;

  for (const redlet of this.redlets) {
    if (!redlet || redlet.markedForRemoval || !redlet.canEatStarlets()) continue;

    for (let i = this.starlets.length - 1; i >= 0; i--) {
      const starlet = this.starlets[i];
      if (!starlet) continue;

      if (redlet.eatsStarlet(starlet)) {
        this.score = Math.max(0, this.score - 5);
        this.lostCount += 1;

        this.audio.playHitSound?.();
        this.emitEatBurst?.(starlet.x, starlet.y);
        this.spawnScatterEffect(starlet.x, starlet.y, "7e3c48", true);

        this.starlets.splice(i, 1);
      }
    }
  }
}



checkRedRingAudioState() {
  if (!this.redRing) {
    this.prevRedRingState = null;
    return;
  }

  const currentState = this.redRing.state;

  if (this.prevRedRingState !== "gone" && currentState === "gone") {
    this.ringGoneAudio.playRingGoneSound?.();
  }

  this.prevRedRingState = currentState;
}


checkObstacleCollisions() {
  for (let i = this.starlets.length - 1; i >= 0; i--) {
    const starlet = this.starlets[i];
    for (let obstacle of this.obstacles) {
      if (obstacle.collidesWith(starlet)) {
        this.score = Math.max(0, this.score - 5);
        this.lostCount += 1;
        this.audio.playHitSound();
        this.spawnScatterEffect(starlet.x, starlet.y, "#7e3c48", true);
        this.starlets.splice(i, 1);
        break;
      }
    }
  }
}

    updateTargetScoreUI() {
    if (this.targetScoreElement) {
      this.targetScoreElement.textContent = this.levelTargetScore;
    }
  }

  updateUI() {
    if (this.savedCountElement) {
      this.savedCountElement.textContent = this.savedCount;
    }

    if (this.lostCountElement) {
      this.lostCountElement.textContent = this.lostCount;
    }

    if (this.scoreElement) {
      this.scoreElement.textContent = this.score;
    }

    if (this.timeFillElement) {
      const progress = Math.max(0, Math.min(1, this.timeLeft / this.totalTime));
      this.timeFillElement.style.width = `${progress * 100}%`;
    }

    this.updateRankUI();
  }

  drawBackgroundDust() {
    const g = this.ctx.createRadialGradient(
      this.canvas.width * 0.32,
      this.canvas.height * 0.5,
      40,
      this.canvas.width * 0.32,
      this.canvas.height * 0.5,
      Math.max(this.canvas.width, this.canvas.height) * 0.85
    );

    g.addColorStop(0, "rgba(53, 97, 132, 0.08)");
    g.addColorStop(0.35, "rgba(12, 43, 74, 0.03)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackgroundDust();

    if (this.motherStar) this.motherStar.draw(this.ctx)

    this.obstacles.forEach((o) => o.draw(this.ctx));

    
    this.starlets.forEach((s) => s.draw(this.ctx));
    this.redlets.forEach((r) => r.draw(this.ctx));

    
    if (this.redRing) {
      this.redRing.draw(this.ctx);
    }

  
    if (this.blacklet) {
      this.blacklet.draw(this.ctx);
    }

    
    this.particles.forEach((p) => p.draw(this.ctx));

    
    if (this.isDragging && this.isRunning && !this.gameOver) {
      this.ctx.strokeStyle = "rgba(53, 97, 132, 0.55)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.mousePos.x, this.mousePos.y, 28, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(this.mousePos.x, this.mousePos.y, 20, 0, Math.PI * 2);
      this.ctx.lineWidth = 0.8;
      this.ctx.strokeStyle = "rgba(12, 43, 74, 0.6)";
      this.ctx.stroke();
    }
  }

  startGameLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const loop = (time) => {
      this.update(time);
      this.draw();

      if (this.isRunning && !this.gameOver) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  async enter() {
    this.isRunning = false;
    this.gameOver = false;
    this.isTransitioning = false;
    this.isDragging = false;

    this.applySceneBackground();
    this.applySceneAudio();

    
    this.heartIconElement?.classList.add("heart-icon--scene7");

    if (this.overlay) {
      this.overlay.classList.remove("show");
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove(
        "actionBtn-disabled",
        "actionBtn-fade-glow"
      );
      this.restartBtn.disabled = false;
      this.restartBtn.style.removeProperty("--fade-glow-duration");
    }

    if (this.nextBtn) {
      this.nextBtn.classList.remove("actionBtn-fade-glow");
      this.nextBtn.classList.add("actionBtn-disabled");
      this.nextBtn.disabled = true;
      this.nextBtn.style.removeProperty("--fade-glow-duration");
    }

    if (this.rotateHint) {
      this.rotateHint.classList.toggle("show", !this.isLandscape());
    }

    
    this.initSceneObjects();

    this.updateTargetScoreUI();
    this.updateUI();
    this.draw();

    await this.start();
  }

  async exit() {
    this.destroy();
  }

  destroy() {
    this.isRunning = false;
    this.gameOver = true;
    this.isTransitioning = false;
    this.isDragging = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.heartPulseTimeout) {
      clearTimeout(this.heartPulseTimeout);
      this.heartPulseTimeout = null;
    }

    if (this.canvas) {
      if (this.handlePointerDown) {
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
      }

      if (this.handlePointerMove) {
        this.canvas.removeEventListener("pointermove", this.handlePointerMove);
      }

      if (this.handlePointerEnd) {
        this.canvas.removeEventListener("pointerup", this.handlePointerEnd);
        this.canvas.removeEventListener("pointercancel", this.handlePointerEnd);
        this.canvas.removeEventListener("pointerleave", this.handlePointerEnd);
      }
    }

    this.inputBound = false;
    this.handlePointerMoveCore = null;
    this.handlePointerDown = null;
    this.handlePointerMove = null;
    this.handlePointerEnd = null;

    window.removeEventListener("resize", this.handleResize);

    
    this.heartIconElement?.classList.remove("heart-icon--scene7");

    if (this.instructionsElement) {
  this.instructionsElement.textContent = this.defaultInstructionsText;
}

    if (this.overlay) {
      this.overlay.classList.remove("show");
    }

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
    }

    if (this.rotateHint) {
      this.rotateHint.classList.remove("show");
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove(
        "actionBtn-disabled",
        "actionBtn-fade-glow"
      );
      this.restartBtn.disabled = false;
      this.restartBtn.style.removeProperty("--fade-glow-duration");
    }

    if (this.nextBtn) {
      this.nextBtn.classList.remove(
        "actionBtn-disabled",
        "actionBtn-fade-glow"
      );
      this.nextBtn.disabled = false;
      this.nextBtn.style.removeProperty("--fade-glow-duration");
    }

    this.resetSceneBackground();
  }
}