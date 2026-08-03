// ============================================================================
//  GameplayScene9 — «Спасательная операция»
//
//  Новая механика сцены построена вокруг ЗОЛОТОГО КОЛЬЦА (GoldRing):
//    - GoldRing существует в единственном экземпляре и появляется как обычное
//      кольцо (см. RedRing), но игрок может поймать его курсором.
//    - Пойманное GoldRing нужно донести до свободного Редлета — при контакте
//      они образуют золотое комбо (Редлет подсвечивается золотом, получает
//      хвост как у старлета) и следуют за курсором 10 секунд.
//    - Пока активно золотое комбо, игрок может собирать вокруг курсора рой
//      свободных Старлетов (та же механика роя/лага, что в GameplayScene5).
//    - Комбо нужно успеть довести до ХоумСтар (см. GameplayScene7) — тогда
//      будет засчитана "спасательная" доставка (goldRescuedCount+1), все
//      старлеты из роя тоже засчитываются.
//    - Если не успеть — комбо превращается в обычное Препятствие, а все
//      старлеты роя уничтожаются со штрафом.
//
//  Одновременно на сцене продолжает работать конкурентная механика вражеских
//  Редлетов и Красных Колец (RedRing), унаследованная из GameplayScene8:
//  до трёх красных колец одновременно, редлеты гоняются за ними, воруют друг
//  у друга, поедают свободных старлетов.
//
//  Победа на уровне требует ОБОИХ условий: score >= levelTargetScore
//  И goldRescuedCount >= 4.
// ============================================================================

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
//  drawStarPath — базовая утилита рисования звёздного контура (без изменений).
// ============================================================================
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

// ============================================================================
//  Obstacle — обычное препятствие (звезда в кольце), логика из GameplayScene8.
//  Также используется как результат "провала" золотого комбо (см. GoldRing).
// ============================================================================
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

  // Фабрика: превращает координаты проваленного золотого комбо в препятствие.
  // Такое препятствие не подхватывается заново — обычная физика Obstacle.
  static fromFailedGoldCombo(x, y, sceneMetrics) {
    const obstacle = new Obstacle(sceneMetrics);
    obstacle.x = x;
    obstacle.y = y;
    // Небольшой случайный импульс, чтобы не "залипал" на месте появления.
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 0.4;
    obstacle.vx = Math.cos(angle) * speed;
    obstacle.vy = Math.sin(angle) * speed;
    return obstacle;
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

// ============================================================================
//  Particle — универсальная частица для вспышек/взрывов (без изменений).
// ============================================================================
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

// ============================================================================
//  MotherStar — источник спавна свободных Старлетов (без изменений, как в
//  GameplayScene8). Цикл стадий: growing -> open -> shrinking -> zero_wait.
//  В открытой фазе (open) можно забрать "импульс спавна" через
//  consumeSpawnPulse(), который сцена использует, чтобы создать FreeStarlet.
// ============================================================================
class MotherStar {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;

    this.sizeMultiplier = 1.3;

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

    // Новый цикл стадий, но без нового маршрута "входа".
    this.state = "growing";
    this.scaleProgress = 0;
    this.openTimer = 0;
    this.zeroWaitTimer = 0;
    this.spawnPulseReady = false;

    // Первый запуск — сразу внутри рабочей зоны.
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

    // Живой шум поверх наведения — чтобы не было ощущения рельсы.
    this.phase += delta * 1.65;
    const noiseX = Math.sin(this.phase) * 0.18;
    const noiseY = Math.cos(this.phase * 0.87) * 0.14;

    this.x += this.vx + noiseX;
    this.y += this.vy + noiseY;

    // Мягкий разворот от границ.
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

    // Движение всегда идёт независимо от стадии.
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

// ============================================================================
//  FreeStarlet — свободно летающий старлет (источник движения — MotherStar).
//
//  База (дрейф к случайным точкам внутри рабочей зоны + волновое дрожание)
//  взята из GameplayScene8 без изменений.
//
//  Добавлена механика роя/следования из GameplayScene5 (following/dragRadius/
//  lagFactor/releaseCooldown/swarmCenter), НО с важным отличием по ТЗ:
//  захват курсором доступен ТОЛЬКО когда активно золотое комбо
//  (GoldRing + Redlet). Целью движения при следовании служит позиция
//  золотого комбо, а не сырые координаты курсора — старлеты роятся позади
//  комбо, а не позади самого курсора.
// ============================================================================
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

    // --- Состояние захвата (аналог Starlet из GameplayScene5) ---
    // free -> following -> (consumed | scored)
    this.state = "free";
    this.following = false;
    this.releaseCooldown = 0;
    this.lagFactor = 0.22;
    this.dragRadius = 30;
    this.trailTimer = 0;

    this.homeTarget = null;
    this.homeHomingStrength = 0.38;
    this.homeArrivalBoost = 6.2;

    this.pickNewTarget();
  }

  pickNewTarget() {
    this.targetX =
      this.driftMinX + Math.random() * (this.driftMaxX - this.driftMinX);
    this.targetY =
      this.driftMinY + Math.random() * (this.driftMaxY - this.driftMinY);
  }

  sendToHomeStar(homeStar) {
if (!homeStar) return;

this.following = false;
this.state = "homingToHomeStar";
this.homeTarget = homeStar;
}

  // followPos — текущая позиция цели захвата (позиция золотого комбо),
  // canCapture — true только когда активно золотое комбо (activeGoldCombo).
  // swarmCenter — центр масс всех свободных старлетов (для лёгкого сплочения).
  update(delta = 0.016, followPos = null, canCapture = false, swarmCenter = null) {
    let justCaught = false;

    if (this.releaseCooldown > 0) this.releaseCooldown -= 1;

    if (
      canCapture &&
      followPos &&
      !this.following &&
      this.releaseCooldown <= 0
    ) {
      const dx = this.x - followPos.x;
      const dy = this.y - followPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.dragRadius) {
        this.following = true;
        this.state = "followingGoldCombo";
        justCaught = true;
      }
    }

    if (this.state === "homingToHomeStar" && this.homeTarget) {
    const dx = this.homeTarget.x - this.x;
    const dy = this.homeTarget.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    const desiredSpeed = this.driftSpeed * this.homeArrivalBoost;
    const desiredVx = (dx / dist) * desiredSpeed;
    const desiredVy = (dy / dist) * desiredSpeed;

    this.vx += (desiredVx - this.vx) * this.homeHomingStrength;
    this.vy += (desiredVy - this.vy) * this.homeHomingStrength;

    this.x += this.vx;
    this.y += this.vy;
    this.rotation += 0.03;

    return justCaught;
}

    if (this.following) {
      // Если золотое комбо исчезло (доставлено/провалено) снаружи нас уже
      // удалят из списка — но на случай гонки кадров подстрахуемся.
      if (followPos) {
        this.targetX = followPos.x;
        this.targetY = followPos.y;
        this.x += (this.targetX - this.x) * this.lagFactor;
        this.y += (this.targetY - this.y) * this.lagFactor;
      }
    } else {
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

      const t = performance.now();
      this.x += Math.sin(t * 0.0012 + this.phase) * this.wander;
      this.y += Math.cos(t * 0.0011 + this.phase) * this.wanderY;

      // Слабое притяжение к центру роя свободных старлетов — держит их
      // единым облаком, как в GameplayScene5.
      if (swarmCenter) {
        this.x += (swarmCenter.x - this.x) * 0.0012;
        this.y += (swarmCenter.y - this.y) * 0.0008;
      }

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
    }

    this.rotation += 0.015;
    return justCaught;
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

// ============================================================================
//  RedRing — вражеское красное кольцо. Логика взаимодействия (притяжение,
//  распад, отталкивание препятствий) взята из GameplayScene8 практически без
//  изменений (там кольцо цеплялось за Blacklet, здесь — за свободного
//  Redlet, поэтому anchorBlacklet -> anchorRedlet, attachToBlacklet ->
//  attachToRedlet и т.п., семантика не поменялась).
//
//  ГЕНЕРАЛИЗАЦИЯ ПО ТЗ: до трёх RedRing одновременно (см. GameplayScene9.
//  redRings[]). В базовой сцене кольцо всегда влетало со стороны top/bottom
//  в правой трети экрана. Здесь заход идёт с одной из ЧЕТЫРЁХ сторон экрана
//  (top/bottom/left/right), чтобы несколько одновременных колец не толклись
//  в одном углу — сторона выбирается явно через activateIntro(side).
// ============================================================================
class RedRing {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;
    this.onGone = null;

    this.x = 0;
    this.y = 0;

    this.anchorRedlet = null;
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
    // Кольцо стартует полностью скрытым — сцена сама вызывает
    // activateIntro(side), когда нужно ввести его в игру (спавн-директор).
    this.hidden = true;
    this.state = "idle";
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

    // Общая рабочая зона дрейфа — почти весь экран, чтобы кольца могли
    // разлетаться по разным сторонам независимо от того, откуда влетели.
    this.driftMinX = width * 0.08;
    this.driftMaxX = width * 0.92;
    this.driftMinY = height * 0.14;
    this.driftMaxY = height * 0.86;

    this.offscreenOffset = offscreenOffset * (1.2 + 0.35 * playScale);
  }

  // side: "top" | "bottom" | "left" | "right" — сторона входа в кадр.
  activateIntro(side) {
    this.state = "idle";
    this.isAttached = false;
    this.anchorRedlet = null;
    this.alpha = 1;
    this.decayProgress = 0;
    this.spawnDelay = 0;
    this.hidden = false;
    this.entering = true;

    const { width = 1366, height = 768 } = this.sceneMetrics ?? {};
    this.entrySide = side || ["top", "bottom", "left", "right"][
      Math.floor(Math.random() * 4)
    ];

    const speed = 5.4 + Math.random() * 1.4;

    if (this.entrySide === "left") {
      this.x = -this.outerGlowRadius;
      this.y = height * (0.16 + Math.random() * 0.68);
      this.vx = speed;
      this.vy = (Math.random() - 0.5) * 0.6;
    } else if (this.entrySide === "right") {
      this.x = width + this.outerGlowRadius;
      this.y = height * (0.16 + Math.random() * 0.68);
      this.vx = -speed;
      this.vy = (Math.random() - 0.5) * 0.6;
    } else if (this.entrySide === "top") {
      this.x = width * (0.16 + Math.random() * 0.68);
      this.y = -this.outerGlowRadius;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = speed;
    } else {
      // bottom
      this.x = width * (0.16 + Math.random() * 0.68);
      this.y = height + this.outerGlowRadius;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = -speed;
    }
  }

  respawn(side) {
    this.activateIntro(side);
  }

  canAttach() {
    return this.state === "idle" && !this.isAttached && !this.hidden;
  }

  isActiveCombo() {
    return this.state === "attached" || this.state === "decaying";
  }

  attachToRedlet(redlet) {
    if (!redlet) return;
    if (!this.canAttach()) return;
    if (!redlet.canCarryRedRing()) return;

    this.anchorRedlet = redlet;
    this.isAttached = true;
    this.state = "attached";

    this.decayProgress = 0;
    this.alpha = 1;

    redlet.setCarryingRedRing(this);

    this.x = redlet.x;
    this.y = redlet.y;
  }

  detach() {
    if (this.anchorRedlet) {
      this.anchorRedlet.clearCarriedRedRing();
    }
    this.anchorRedlet = null;
    this.isAttached = false;
    this.state = "decaying";
  }

  // Вызывается при краже кольца другим редлетом — прежний носитель теряет
  // кольцо мгновенно (без распада), новый сразу подхватывает его.
  stealTo(newRedlet) {
    if (this.anchorRedlet) {
      this.anchorRedlet.clearCarriedRedRing();
    }
    this.anchorRedlet = newRedlet;
    this.isAttached = true;
    this.state = "attached";
    this.decayProgress = 0;
    this.alpha = 1;
    newRedlet.setCarryingRedRing(this);
    this.x = newRedlet.x;
    this.y = newRedlet.y;
  }

  absorbToRedletCenter(redlet, pull = this.attachPull) {
    if (!redlet) return;
    this.x += (redlet.x - this.x) * pull;
    this.y += (redlet.y - this.y) * pull;
  }

  collidesWithRedlet(redlet) {
    if (!redlet || !this.canAttach()) return false;
    if (!redlet.canCarryRedRing()) return false;

    const dx = redlet.x - this.x;
    const dy = redlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const linkDist = redlet.radius * 0.72 + this.collisionRadius;
    return dist < linkDist;
  }

  isReadyToRespawn() {
    return this.state === "gone";
  }

  update(delta = 0.016, redlet = null) {
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

      if (redlet && redlet.canCarryRedRing() && this.collidesWithRedlet(redlet)) {
        this.attachToRedlet(redlet);
      }

      this.alpha = 1;
      return;
    }

    if (this.state === "attached") {
      if (!redlet) {
        this.detach();
        return;
      }

      this.anchorRedlet = redlet;
      this.x = redlet.x;
      this.y = redlet.y;

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
      if (redlet && redlet.carryingRedRing === this) {
        this.anchorRedlet = redlet;
        this.x = redlet.x;
        this.y = redlet.y;
      } else if (this.anchorRedlet) {
        this.x = this.anchorRedlet.x;
        this.y = this.anchorRedlet.y;
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
      // Спавн нового кольца полностью управляется извне (spawn-директор
      // сцены), сюда мы не должны попадать сами по себе.
    }
  }

  destroy({ clearRedlet = true } = {}) {
    if (this.state === "gone") return;

    this.alpha = 0;
    this.hidden = true;
    this.isAttached = false;
    this.decayProgress = 1;

    if (clearRedlet && this.anchorRedlet) {
      this.anchorRedlet.clearCarriedRedRing?.();
    }

    this.anchorRedlet = null;
    this.state = "gone";
    this.spawnDelay = this.respawnDelay ?? 0.15;

    this.onGone?.();
  }

  finishDecay() {
    this.destroy({ clearRedlet: true });
  }

  canRepel() {
    return (
      (this.state === "idle" || this.isActiveCombo()) &&
      !this.hidden &&
      this.alpha > 0.05
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

// ============================================================================
//  Redlet — вражеская сущность. База (формирование из жёлтого в чёрно-красную
//  звезду, движение, отрисовка) взята из GameplayScene8 практически без
//  изменений.
//
//  РАСШИРЕНО ПО ТЗ (п.11-13): вместо одиночной цели "кольцо -> старлеты"
//  теперь трёхуровневый приоритет:
//    1) если существует свободное RedRing (idle, не занятое) — гонится за
//       ближайшим свободным кольцом;
//    2) если свободных колец нет — гонится за ближайшим активным комбо
//       (Redlet+RedRing) другого редлета, чтобы УКРАСТЬ кольцо при касании;
//    3) если сам несёт RedRing — охотится на свободных старлетов;
//       если несёт кольцо, но старлетов нет — блуждает, уклоняясь от
//       свободных (безкольцевых) редлетов, защищая своё кольцо.
//
//  Состояния (по ТЗ п.18): forming, free, seekingRedRing, carryingRedRing,
//  carryingGoldRing. Последнее используется, когда GoldRing цепляется к
//  этому редлету (см. GoldRing.attachToRedlet) — в этом состоянии редлет
//  визуально золотой и активной охоты на RedRing/старлетов не ведёт, так
//  как его "перехватывает" золотое комбо (см. update() в GoldRing/сцене).
// ============================================================================
class Redlet {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    // forming -> free -> seekingRedRing -> carryingRedRing
    // (в любой момент после forming редлет может перейти в carryingGoldRing,
    //  если его "поймало" золотое кольцо — см. GoldRing.attachToRedlet)
    this.state = "forming";
    this.hasCapturedRing = false;
    this.carryingRedRing = null;
    this.carryingGoldRing = null;
    this.markedForRemoval = false;

    this.followTargetX = 0;
    this.followTargetY = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.jitterPhase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.014;

    this.transformProgress = 0;
    this.formationDuration = 1.45;

    this.redness = 0;
    this.coreDarkness = 0;

    this.baseHomingSpeed = 5.2;
    this.baseCarryingSpeed = 5.0;
    this.homingSpeed = this.baseHomingSpeed;
    this.carryingSpeed = this.baseCarryingSpeed;
    this.steer = 0.075;
    this.wander = 0.16;

    // Небольшой постоянный разброс скорости на одного редлета.
    this.speedVariance = 0.18;
    this.speedFactor = 1;

    // Кратковременное ускорение сразу после кражи чужого кольца (ТЗ п.12).
    this.stealBoostTimer = 0;
    this.stealBoostDuration = 0.9;
    this.stealBoostMultiplier = 1.55;

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

    const width = sceneMetrics?.width ?? 1366;
    const height = sceneMetrics?.height ?? 768;
    const offscreenOffset = sceneMetrics?.offscreenOffset ?? 60;

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

    // Радиус, на котором свободный редлет может украсть чужое кольцо
    // касанием активного комбо (см. п.12 ТЗ).
    this.stealRadius = this.radius * 2.1;
  }

  reset() {
    this.state = "forming";
    this.hasCapturedRing = false;
    this.carryingRedRing = null;
    this.carryingGoldRing = null;
    this.markedForRemoval = false;
    this.stealBoostTimer = 0;

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

  // Свободен ли для сюжета "поймать RedRing/GoldRing" — не несёт ничего.
  isFree() {
    return (
      (this.state === "free" || this.state === "seekingRedRing") &&
      !this.hasCapturedRing &&
      !this.carryingGoldRing
    );
  }

  canCaptureRing() {
    return (
      (this.state === "free" || this.state === "seekingRedRing") &&
      !this.hasCapturedRing &&
      !this.carryingGoldRing
    );
  }

  // Совместимо со старым именем метода RedRing (canCarryRedRing) — редлет,
  // уже несущий золотое кольцо, не может параллельно взять красное.
  canCarryRedRing() {
  return (
    this.state !== "forming" &&
    this.state !== "carryingGoldRing" &&
    !this.markedForRemoval &&
    !this.carryingGoldRing &&
    !this.hasCapturedRing
  );
}
  canEatStarlets() {
    return this.state === "carryingRedRing" && this.hasCapturedRing;
  }

  getSpeed() {
    let speed = this.hasCapturedRing ? this.carryingSpeed : this.homingSpeed;
    if (this.stealBoostTimer > 0) {
      speed *= this.stealBoostMultiplier;
    }
    return speed;
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

  setCarryingRedRing(redRing) {
    this.hasCapturedRing = true;
    this.carryingRedRing = redRing;
    this.state = "carryingRedRing";
  }

  clearCarriedRedRing() {
    this.hasCapturedRing = false;
    this.carryingRedRing = null;
    this.state = "free";
  }

  // Вызывается редлетом-ВОРОМ, когда он касается чужого активного комбо
  // (ТЗ п.12). Прежний носитель освобождается через RedRing.stealTo().
  stealRedRingFrom(victimRedlet, redRing) {
    if (!redRing || !victimRedlet) return;
    redRing.stealTo(this);
    this.stealBoostTimer = this.stealBoostDuration;
  }

  // Может ли этот (свободный) редлет украсть кольцо у victim — оба должны
  // быть в подходящих состояниях, и victim должен реально что-то нести.
  canStealFrom(victimRedlet) {
    if (!victimRedlet || victimRedlet === this) return false;
    if (this.state === "carryingGoldRing") return false;
    if (victimRedlet.state === "carryingGoldRing") return false;

    if (!this.canCaptureRing()) return false;
    if (!victimRedlet.hasCapturedRing || !victimRedlet.carryingRedRing) {
      return false;
    }
    const dx = victimRedlet.x - this.x;
    const dy = victimRedlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.stealRadius + victimRedlet.radius;
  }

  // --- Трёхуровневая цель редлета (ТЗ п.11) ---
  // freeRedRings   — массив RedRing в состоянии idle (canAttach()===true).
  // activeCombos   — массив других Redlet, которые сейчас carryingRedRing.
  // starlets       — массив свободных FreeStarlet (не following).
  // redlets        — весь список редлетов (для разделения/избегания).
  getTargetPoint(freeRedRings, activeCombos, starlets, redlets) {
    // 3) Несём кольцо -> ищем свободных старлетов, иначе блуждаем избегая
    //    свободных редлетов (защищаем своё кольцо).
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
        return { x: closest.x, y: closest.y, mode: "hunt" };
      }

      // Нет старлетов — блуждаем, избегая свободных (безкольцевых) редлетов.
      let fleeX = 0;
      let fleeY = 0;
      let fleeCount = 0;
      const watchRadius = this.radius * 7;

      for (const other of redlets ?? []) {
        if (!other || other === this || other.markedForRemoval) continue;
        if (other.state === "carryingGoldRing") continue;
        if (!other.isFree()) continue;

        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 0.0001 || d2 >= watchRadius * watchRadius) continue;

        const d = Math.sqrt(d2);
        fleeX += dx / d;
        fleeY += dy / d;
        fleeCount++;
      }

      if (fleeCount > 0) {
        return {
          x: this.x + (fleeX / fleeCount) * 140,
          y: this.y + (fleeY / fleeCount) * 140,
          mode: "evade",
        };
      }

      return { x: this.x + Math.sin(this.phase) * 40, y: this.y + Math.cos(this.phase * 0.8) * 40, mode: "wander" };
    }

    // 1) Есть свободное RedRing -> гонимся за ближайшим.
    let closestRing = null;
    let closestRingDist = Infinity;
    for (const ring of freeRedRings ?? []) {
      if (!ring || ring.hidden || ring.alpha <= 0.01) continue;
      const dx = ring.x - this.x;
      const dy = ring.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestRingDist) {
        closestRingDist = distSq;
        closestRing = ring;
      }
    }

    if (closestRing) {
      return { x: closestRing.x, y: closestRing.y, mode: "seekRing" };
    }

    // 2) Нет свободных колец -> гонимся за ближайшим активным комбо, чтобы
    //    украсть кольцо касанием.
    let closestVictim = null;
    let closestVictimDist = Infinity;
    for (const victim of activeCombos ?? []) {
  if (!victim || victim === this || !victim.hasCapturedRing) continue;
  if (victim.state === "carryingGoldRing") continue;
      const dx = victim.x - this.x;
      const dy = victim.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestVictimDist) {
        closestVictimDist = distSq;
        closestVictim = victim;
      }
    }

    if (closestVictim) {
      return { x: closestVictim.x, y: closestVictim.y, mode: "steal" };
    }

    // Совсем ничего нет — ждём в центре рабочей зоны.
    return {
      x: this.sceneMetrics.width * 0.5,
      y: this.sceneMetrics.height * 0.5,
      mode: "wait",
    };
  }

  update(delta = 0.016, freeRedRings, activeCombos, starlets, redlets, mousePos = null) {
    this.phase += delta * 2.0;
    this.jitterPhase += delta * 8.5;
    this.pulsePhase += delta * 3.2;
    this.rotation += this.rotationSpeed;

    if (this.stealBoostTimer > 0) {
      this.stealBoostTimer = Math.max(0, this.stealBoostTimer - delta);
    }

    // Редлет, пойманный золотым кольцом, управляется снаружи (сценой /
    // GoldRing) — здесь просто пропускаем обычную логику охоты.
    if (this.state === 'carryingGoldRing') {
    if (mousePos) {
      this.followTargetX = mousePos.x;
      this.followTargetY = mousePos.y;

      this.x += (this.followTargetX - this.x) * 0.09;
      this.y += (this.followTargetY - this.y) * 0.09;
    }
    return;
  }

    if (this.transformProgress < 1) {
    this.transformProgress = Math.min(
      1,
      this.transformProgress + delta / this.formationDuration
    );

    const redStart = 0.12;
    const blackStart = 0.42;

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
        this.state = "free";
      }
    } else {
      const target = this.getTargetPoint(freeRedRings, activeCombos, starlets, redlets);
      this.followTargetX = target.x;
      this.followTargetY = target.y;
      if (target.mode === "seekRing") this.state = "seekingRedRing";

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
      ? 0.55 + (1 - this.transformProgress) * 0.8
      : 0.14;

  const jitterX = Math.sin(this.jitterPhase) * jitterStrength;
  const jitterY = Math.cos(this.jitterPhase * 0.87) * jitterStrength;

  const readyPulse =
    this.state === "forming"
      ? 1
      : 1 + Math.sin(this.pulsePhase) * (this.hasCapturedRing ? 0.06 : 0.05);

  const isGolden = this.state === "carryingGoldRing";

  const glowBoost = isGolden
    ? 1.38
    : this.hasCapturedRing
    ? 1.25
    : this.state === "free" || this.state === "seekingRedRing"
    ? 1.05
    : 0.72 + this.redness * 0.2;

  const yellow = { r: 245, g: 182, b: 112 };
  const amber = { r: 255, g: 240, b: 184 };
  const red = { r: 224, g: 58, b: 74 };
  const deepRed = { r: 126, g: 60, b: 72 };
  const brightEdge = { r: 255, g: 86, b: 104 };
  const gold = { r: 255, g: 205, b: 90 };
  const goldDeep = { r: 200, g: 150, b: 40 };
  const blackCore = { r: 10, g: 14, b: 28 };

  const mix = (a, b, t) => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });

  const toRgb = (c, alpha = 1) =>
    `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${alpha})`;

  const outerWarm = isGolden
    ? mix(gold, amber, 0.18)
    : mix(yellow, red, this.redness * 0.85);

  const edgeColor = isGolden
    ? mix(amber, gold, 0.62)
    : mix(amber, brightEdge, this.redness);

  const shadowColor = isGolden
    ? mix(gold, goldDeep, 0.42)
    : mix(red, deepRed, this.coreDarkness * 0.35);

  const coreFill = isGolden
    ? mix(outerWarm, goldDeep, 0.35)
    : this.coreDarkness <= 0
    ? outerWarm
    : mix(outerWarm, blackCore, this.coreDarkness);

  const coreHighlight = isGolden
    ? mix(amber, { r: 255, g: 244, b: 200 }, 0.5)
    : mix(amber, { r: 255, g: 210, b: 210 }, this.redness * 0.45);

  const drawRadius = this.radius * readyPulse;
  const drawInner = this.innerRadius * readyPulse;
  const glowRadius = drawRadius * (3.0 + 0.35 * glowBoost);

  ctx.save();
  ctx.translate(this.x + jitterX, this.y + jitterY);
  ctx.rotate(this.rotation);

  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, glowRadius);
  glow.addColorStop(0, toRgb(edgeColor, 0.22 * glowBoost));
  glow.addColorStop(0.45, toRgb(shadowColor, 0.13 * glowBoost));
  glow.addColorStop(1, isGolden ? toRgb(goldDeep, 0) : toRgb(deepRed, 0));

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
  ctx.lineWidth =
    this.state === "forming"
      ? 1.1 + this.redness * 1.4
      : isGolden
      ? 2.5
      : 2.4;
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

  if (this.hasCapturedRing && !isGolden) {
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

  if (isGolden) {
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius * 1.7, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.4, this.radius * 0.24);
    ctx.strokeStyle = "rgba(255, 205, 90, 0.9)";
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(255, 205, 90, 0.5)";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
}

// ============================================================================
//  GoldRing — центральная новая механика сцены. Существует ВСЕГДА только в
//  одном экземпляре (сцена следит за этим сама — новое кольцо создаётся
//  только после того, как предыдущее доставлено/просрочено/уничтожено).
//
//  Появляется и дрейфует как RedRing (влетает с одной из сторон экрана и
//  плавно ходит внутри рабочей зоны), но с ключевым отличием: игрок может
//  поймать его курсором (состояние followingCursor) — используется тот же
//  приём "мягкого лага", что у старлетов в GameplayScene5 (dragRadius/
//  lagFactor), только целью притяжения служит курсор мыши, а не наоборот.
//
//  Состояния: spawning -> idle -> followingCursor -> attachedToRedlet ->
//             delivered | expired
// ============================================================================
class GoldRing {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;
    this.id = Math.random().toString(36).slice(2, 9);

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    this.state = "spawning"; // spawning - idle - followingCursor - magnetizingToRedlet - attachedToRedlet - delivered/expired
    this.hidden = true;
    this.anchorRedlet = null;
    this.targetRedlet = null;
    this.alpha = 0;
    this.spawnProgress = 0;

    this.magnetPull = 0.22;
    this.magnetSnapDistance = 6;
    this.spawnDuration = 0.6;

    this.phase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.glowPhase = Math.random() * Math.PI * 2;

    // Захват курсором — по образцу Starlet из GameplayScene5.
    this.dragRadius = 30;
    this.lagFactor = 0.09;

    // Таймер жизни комбо (Redlet + GoldRing) — жёсткие 10 секунд (ТЗ п.9).
    this.comboLifeDuration = 10.0;
    this.comboLifeTimer = 0;

    this.baseRadius = 0;
    this.dotRadius = 0;
    this.ringRadius = 0;
    this.ringThickness = 0;
    this.innerRingRadius = 0;
    this.outerGlowRadius = 0;
    this.collisionRadius = 0;

    this.setBounds(sceneMetrics);
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

    this.driftMinX = width * 0.1;
    this.driftMaxX = width * 0.9;
    this.driftMinY = height * 0.14;
    this.driftMaxY = height * 0.86;

    this.offscreenOffset = offscreenOffset * (1.2 + 0.35 * playScale);
  }

  // Спавнится, как RedRing, с одной из четырёх сторон экрана.
  spawn(side) {
    this.state = "spawning";
    this.hidden = false;
    this.anchorRedlet = null;
    this.targetRedlet = null;
    this.alpha = 0;
    this.spawnProgress = 0;
    this.comboLifeTimer = 0;

    const { width = 1366, height = 768 } = this.sceneMetrics ?? {};
    const entrySide = side || ["top", "bottom", "left", "right"][
      Math.floor(Math.random() * 4)
    ];

    const speed = 4.6 + Math.random() * 1.2;

    if (entrySide === "left") {
      this.x = -this.outerGlowRadius;
      this.y = height * (0.2 + Math.random() * 0.6);
      this.vx = speed;
      this.vy = (Math.random() - 0.5) * 0.5;
    } else if (entrySide === "right") {
      this.x = width + this.outerGlowRadius;
      this.y = height * (0.2 + Math.random() * 0.6);
      this.vx = -speed;
      this.vy = (Math.random() - 0.5) * 0.5;
    } else if (entrySide === "top") {
      this.x = width * (0.2 + Math.random() * 0.6);
      this.y = -this.outerGlowRadius;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = speed;
    } else {
      this.x = width * (0.2 + Math.random() * 0.6);
      this.y = height + this.outerGlowRadius;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = -speed;
    }

    this.entering = true;
  }

  isCatchableByCursor() {
    return this.state === "idle" && !this.hidden;
  }

  isDeliverable() {
    return this.state === "attachedToRedlet";
  }

  // Попытка захвата курсором — вызывается сценой каждый кадр, пока кольцо
  // в состоянии idle.
  tryCatchByCursor(mousePos, isPointerDown) {
    if (!this.isCatchableByCursor()) return false;
    if (!isPointerDown) return false;

    const dx = this.x - mousePos.x;
    const dy = this.y - mousePos.y;
    if (Math.sqrt(dx * dx + dy * dy) < this.dragRadius + this.collisionRadius * 0.4) {
      this.state = "followingCursor";
      return true;
    }
    return false;
  }

  // Столкновение движущегося за курсором золотого кольца со свободным
  // Редлетом -> образуется золотое комбо (ТЗ п.6).
  collidesWithRedlet(redlet) {
  if (this.state !== "followingCursor") return false;
  if (!redlet || redlet.markedForRemoval) return false;
  if (redlet.carryingGoldRing) return false;
  if (redlet.state === "forming") return false;

  const dx = redlet.x - this.x;
  const dy = redlet.y - this.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist < redlet.radius * 1.0 + this.collisionRadius;
}

  beginMagnetToRedlet(redlet) {
  if (!redlet) return;
  if (this.state !== "followingCursor") return;
  if (redlet.markedForRemoval) return;
  if (redlet.carryingGoldRing) return;
  if (redlet.state === "forming") return;

  this.targetRedlet = redlet;
  this.state = "magnetizingToRedlet";
}

  attachToRedlet(redlet) {
  if (!redlet) return;

  const stolenRedRing = redlet.carryingRedRing || null;

  if (stolenRedRing) {
    const oldRingX = stolenRedRing.x;
    const oldRingY = stolenRedRing.y;

    redlet.clearCarriedRedRing();

    stolenRedRing.anchorRedlet = null;
    stolenRedRing.isAttached = false;
    stolenRedRing.state = "idle";
    stolenRedRing.decayProgress = 0;
    stolenRedRing.alpha = 1;
    stolenRedRing.hidden = false;
    stolenRedRing.entering = false;

    let dx = oldRingX - this.x;
    let dy = oldRingY - this.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    const separation = stolenRedRing.collisionRadius + redlet.radius + 10;
    stolenRedRing.x = redlet.x + nx * separation;
    stolenRedRing.y = redlet.y + ny * separation;

    const push = 4.8;
    stolenRedRing.vx = nx * push + (Math.random() - 0.5) * 0.25;
    stolenRedRing.vy = ny * push + (Math.random() - 0.5) * 0.25;

    const minX = stolenRedRing.driftMinX + stolenRedRing.collisionRadius;
    const maxX = stolenRedRing.driftMaxX - stolenRedRing.collisionRadius;
    const minY = stolenRedRing.driftMinY + stolenRedRing.collisionRadius;
    const maxY = stolenRedRing.driftMaxY - stolenRedRing.collisionRadius;

    stolenRedRing.x = Math.max(minX, Math.min(maxX, stolenRedRing.x));
    stolenRedRing.y = Math.max(minY, Math.min(maxY, stolenRedRing.y));
  }

  this.targetRedlet = null;
  this.anchorRedlet = redlet;
  this.state = "attachedToRedlet";
  this.comboLifeTimer = 0;

  redlet.hasCapturedRing = false;
  redlet.carryingRedRing = null;
  redlet.carryingGoldRing = this;
  redlet.state = "carryingGoldRing";

  this.x = redlet.x;
  this.y = redlet.y;
}

  // Курсор бросает пойманное кольцо (отпустили кнопку/палец) — кольцо
  // возвращается в состояние idle и продолжает свободно дрейфовать.
  releaseFromCursor() {
  if (this.state !== "followingCursor" && this.state !== "magnetizingToRedlet") return;
  this.state = "idle";
  this.targetRedlet = null;
  this.vx = (Math.random() - 0.5) * 0.8;
  this.vy = (Math.random() - 0.5) * 0.8;
}

  deliver() {
    this.state = "delivered";
    if (this.anchorRedlet) {
      this.anchorRedlet.carryingGoldRing = null;
      this.anchorRedlet.markedForRemoval = true; // редлет из спасённого комбо покидает сцену
    }
  }

  expire() {
    this.state = "expired";
    if (this.anchorRedlet) {
      this.anchorRedlet.carryingGoldRing = null;
      this.anchorRedlet.markedForRemoval = true; // редлет становится обычным препятствием вместе с кольцом
    }
  }

  isGone() {
    return this.state === "delivered" || this.state === "expired";
  }

  update(delta = 0.016, mousePos = null, isPointerDown = false) {
    if (this.hidden) return;

    this.pulsePhase += delta * 5.4;
    this.glowPhase += delta * 2.8;
    this.phase += delta * 1.9;

    if (this.state === "spawning") {
      this.spawnProgress = Math.min(1, this.spawnProgress + delta / this.spawnDuration);
      this.alpha = this.spawnProgress;

      this.x += this.vx;
      this.y += this.vy;

      const insideX = this.x > this.driftMinX && this.x < this.driftMaxX;
      const insideY = this.y > this.driftMinY && this.y < this.driftMaxY;
      if (insideX && insideY) {
        this.state = "idle";
        this.vx = (Math.random() - 0.5) * 0.7;
        this.vy = (Math.random() - 0.5) * 0.7;
      }
      return;
    }

    if (this.state === "idle") {
      this.alpha = 1;

      this.x += this.vx;
      this.y += this.vy;
      this.x += Math.sin(this.phase) * 0.06;
      this.y += Math.cos(this.phase * 0.92) * 0.09;

      if (this.x < this.driftMinX) this.vx = Math.abs(this.vx) * 0.92;
      if (this.x > this.driftMaxX) this.vx = -Math.abs(this.vx) * 0.92;
      if (this.y < this.driftMinY) this.vy = Math.abs(this.vy) * 0.92;
      if (this.y > this.driftMaxY) this.vy = -Math.abs(this.vy) * 0.92;

      this.tryCatchByCursor(mousePos ?? { x: this.x, y: this.y }, isPointerDown);
      return;
    }

    if (this.state === "followingCursor") {
      this.alpha = 1;

      if (!isPointerDown) {
        this.releaseFromCursor();
        return;
      }

      if (mousePos) {
        this.x += (mousePos.x - this.x) * this.lagFactor;
        this.y += (mousePos.y - this.y) * this.lagFactor;
      }
      return;
    }

    if (this.state === "magnetizingToRedlet") {
  this.alpha = 1;

  if (
    !this.targetRedlet ||
    this.targetRedlet.markedForRemoval ||
    this.targetRedlet.carryingGoldRing ||
    this.targetRedlet.state === "forming"
  ) {
    this.targetRedlet = null;
    this.state = "idle";
    return;
  }

  const redlet = this.targetRedlet;

  if (mousePos) {
    this.x += (mousePos.x - this.x) * this.lagFactor;
    this.y += (mousePos.y - this.y) * this.lagFactor;
  }

  redlet.x += (this.x - redlet.x) * this.magnetPull;
  redlet.y += (this.y - redlet.y) * this.magnetPull;
  redlet.vx *= 0.82;
  redlet.vy *= 0.82;

  const dx = redlet.x - this.x;
  const dy = redlet.y - this.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < this.magnetSnapDistance) {
    redlet.x = this.x;
    redlet.y = this.y;
    this.attachToRedlet(redlet);
  }

  return;
}

  

    if (this.state === "attachedToRedlet") {
      this.alpha = 1;

      if (this.anchorRedlet && !this.anchorRedlet.markedForRemoval) {
        this.x = this.anchorRedlet.x;
        this.y = this.anchorRedlet.y;
      }

      this.comboLifeTimer += delta;
      // Истечение таймера обрабатывается снаружи сценой (нужно сравнить
      // с 10-секундным лимитом и учесть приоритет доставки — см. ТЗ,
      // "гонка кадров": если в этот же кадр комбо коснулось ХоумСтар,
      // доставка должна произойти раньше просрочки).
      return;
    }
  }

  getComboTimeLeft() {
    return Math.max(0, this.comboLifeDuration - this.comboLifeTimer);
  }

  isComboExpired() {
    return this.state === "attachedToRedlet" && this.comboLifeTimer >= this.comboLifeDuration;
  }

  draw(ctx) {
  if (this.hidden || this.alpha <= 0.001) return;

  const heartBeat = Math.max(0, Math.sin(this.pulsePhase)) * 0.6;
  const ringPulse = 1 + heartBeat * 0.14;
  const dotPulse = 1 + Math.sin(this.pulsePhase) * 0.04;

  const dotRadius = this.dotRadius * dotPulse;
  const ringRadius = this.ringRadius * ringPulse;
  const glowRadius =
    this.outerGlowRadius *
    (0.92 + Math.sin(this.glowPhase) * 0.04 + heartBeat * 0.08);

  const ringAlpha = this.alpha * 0.94;
  const glowAlpha =
    this.alpha * (this.state === "attachedToRedlet" ? 0.34 : 0.22);

  ctx.save();

  const glow = ctx.createRadialGradient(
    this.x,
    this.y,
    dotRadius * 0.8,
    this.x,
    this.y,
    glowRadius
  );
  glow.addColorStop(0, `rgba(145, 92, 1, ${0.12 * glowAlpha})`);
  glow.addColorStop(0.42, `rgba(255, 175, 96, ${0.14 * glowAlpha})`);
  glow.addColorStop(0.74, `rgba(255, 124, 72, ${0.18 * glowAlpha})`);
  glow.addColorStop(1, "rgba(255, 124, 72, 0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
  ctx.lineWidth = this.ringThickness;
  ctx.strokeStyle = `rgba(245, 182, 112, ${Math.min(1, ringAlpha * 0.96)})`;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "rgba(222, 161, 94, 0.34)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.2, this.ringThickness * 0.58);
  ctx.strokeStyle = `rgba(255, 242, 212, ${Math.min(1, 0.42 * ringAlpha + 0.18)})`;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(255, 236, 198, 0.18)";
  ctx.stroke();

  ctx.shadowBlur = 0;

  const highlightAngle = this.phase * 0.75 - Math.PI * 0.5;

  const highlightRadius = Math.max(1.8, this.ringThickness * 0.72);
  const highlightOrbitRadius = ringRadius - this.ringThickness * 0.08;

  const highlightX = this.x + Math.cos(highlightAngle) * highlightOrbitRadius;
  const highlightY = this.y + Math.sin(highlightAngle) * highlightOrbitRadius;

  const highlightGlowRadius =
    highlightRadius * (2.6 + Math.max(0, Math.sin(this.pulsePhase)) * 0.45);

  const ringGlow = ctx.createRadialGradient(
    highlightX,
    highlightY,
    highlightRadius * 0.15,
    highlightX,
    highlightY,
    highlightGlowRadius
  );
  ringGlow.addColorStop(0, `rgba(255, 252, 242, ${0.34 * this.alpha + 0.18})`);
  ringGlow.addColorStop(0.35, `rgba(255, 236, 198, ${0.22 * this.alpha + 0.10})`);
  ringGlow.addColorStop(0.72, `rgba(245, 182, 112, ${0.12 * this.alpha + 0.04})`);
  ringGlow.addColorStop(1, "rgba(245, 182, 112, 0)");

  ctx.beginPath();
  ctx.arc(highlightX, highlightY, highlightGlowRadius, 0, Math.PI * 2);
  ctx.fillStyle = ringGlow;
  ctx.fill();

  const orbCore = ctx.createRadialGradient(
    highlightX - highlightRadius * 0.28,
    highlightY - highlightRadius * 0.34,
    highlightRadius * 0.12,
    highlightX,
    highlightY,
    highlightRadius
  );
  orbCore.addColorStop(0, "rgba(255, 255, 248, 1)");
  orbCore.addColorStop(0.45, "rgba(255, 244, 218, 0.98)");
  orbCore.addColorStop(1, "rgba(255, 214, 150, 0.92)");

  ctx.beginPath();
  ctx.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2);
  ctx.fillStyle = orbCore;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(255, 238, 198, 0.34)";
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(
    highlightX - highlightRadius * 0.18,
    highlightY - highlightRadius * 0.22,
    highlightRadius * 0.34,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = `rgba(255, 255, 250, ${0.42 * this.alpha + 0.18})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(this.x, this.y, this.innerRingRadius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, this.ringThickness * 0.16);
  ctx.strokeStyle = `rgba(222, 161, 94, ${Math.min(1, 0.82 * ringAlpha + 0.12)})`;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(245, 182, 112, 0.22)";
  ctx.stroke();

  ctx.shadowBlur = 0;

  const core = ctx.createRadialGradient(
    this.x - dotRadius * 0.35,
    this.y - dotRadius * 0.45,
    dotRadius * 0.18,
    this.x,
    this.y,
    dotRadius
  );
  core.addColorStop(0, "#FFF2D4");
  core.addColorStop(0.48, "#F5B670");
  core.addColorStop(1, "#DEA15E");

  ctx.beginPath();
  ctx.arc(this.x, this.y, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "rgba(222, 161, 94, 0.30)";
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(this.x, this.y, dotRadius * 0.64, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 248, 226, ${0.34 * this.alpha + 0.12})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(this.x, this.y, dotRadius, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(255, 244, 218, ${0.56 * this.alpha + 0.16})`;
  ctx.stroke();

  ctx.restore();
}
}

// ============================================================================
//  HomeStar — цель доставки золотого комбо. База (заход слева, блуждание в
//  левой трети экрана, отталкивание препятствий, отрисовка) взята из
//  GameplayScene7 практически без изменений.
//
//  ВАЖНОЕ ОТЛИЧИЕ ОТ СЦЕНЫ7: там `isHit(starlet)` означал ШТРАФ за попадание
//  свободного старлета в звезду (звезда была "ловушкой" в инверсном режиме).
//  Здесь семантика намеренно ИНВЕРТИРОВАНА — попадание сюда золотого комбо
//  (Redlet + GoldRing, плюс весь хвост "пришвартованных" старлетов) означает
//  УСПЕШНУЮ ДОСТАВКУ и НАГРАДУ, а не штраф. Свободные (не входящие в комбо)
//  старлеты и препятствия при касании звезды НЕ штрафуются и не блокируются
//  по очкам — только физическое отталкивание препятствий (blocksObstacle/
//  repelObstacle) сохранено как есть, чтобы звезда продолжала вести себя как
//  плотный объект на сцене.
// ============================================================================
class HomeStar {
  constructor(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = 0;
    this.y = 0;

    this.baseRadius = sceneMetrics.homeRadius;
    this.baseRingRadius = sceneMetrics.homeRingRadius;
    this.baseGlowRadius = sceneMetrics.homeGlowRadius;

    this.radius = this.baseRadius;
    this.ringRadius = this.baseRingRadius;
    this.glowRadius = this.baseGlowRadius;

    this.flicker = Math.random() * Math.PI * 2;
    this.rotation = 0;

    this.active = false;

    // Фаза входа слева -> блуждание.
    this.entered = false;

    this.vx = 0;
    this.vy = 0;
    this.phase = Math.random() * Math.PI * 2;

    this.setBounds(sceneMetrics);
    this.resetCyclePosition();
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.baseRadius = sceneMetrics.homeRadius;
    this.baseRingRadius = sceneMetrics.homeRingRadius;
    this.baseGlowRadius = sceneMetrics.homeGlowRadius;

    this.radius = this.baseRadius;
    this.ringRadius = this.baseRingRadius;
    this.glowRadius = this.baseGlowRadius;

    const { width, height } = sceneMetrics;

    this.entryX = -this.baseRingRadius - width * 0.08;

    // Зона блуждания — левая треть экрана: даёт игроку понятную,
    // стабильную точку назначения для доставки золотого комбо.
    this.roamMinX = width * 0.06;
    this.roamMaxX = width * 0.33;
    this.roamMinY = height * 0.22;
    this.roamMaxY = height * 0.78;

    this.targetEntryX = width * 0.18;
    this.baseY = height * 0.5;
  }

  resetCyclePosition() {
    this.entered = false;
    this.x = this.entryX;
    this.y = this.baseY;
    this.vx = 0;
    this.vy = 0;
  }

  activateFromLeft() {
    this.active = true;
    this.entered = false;
    this.x = this.entryX;
    this.y = this.baseY;
    this.vx = 0;
    this.vy = 0;
  }

  deactivate() {
    this.active = false;
  }

  update(delta = 0.016) {
    if (!this.active) return;

    this.flicker += 0.008;
    this.rotation += 0.006;

    const scale = 1 + Math.sin(this.flicker * 0.9) * 0.5;
    this.radius = this.baseRadius * scale;
    this.ringRadius = this.baseRingRadius * scale;
    this.glowRadius = this.baseGlowRadius * scale;

    if (!this.entered) {
      const speed = this.sceneMetrics.width * 0.18;
      this.x += speed * delta;
      this.y = this.baseY + Math.sin(this.flicker * 0.5) * this.sceneMetrics.height * 0.03;

      if (this.x >= this.targetEntryX) {
        this.x = this.targetEntryX;
        this.entered = true;
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;
      }
      return;
    }

    this.phase += delta;

    this.x += this.vx;
    this.y += this.vy;

    this.vx += (Math.random() - 0.5) * 0.05;
    this.vy += (Math.random() - 0.5) * 0.05;

    const centerX = (this.roamMinX + this.roamMaxX) * 0.5;
    const centerY = (this.roamMinY + this.roamMaxY) * 0.5;
    this.vx += (centerX - this.x) * 0.0006;
    this.vy += (centerY - this.y) * 0.0006;

    const maxSpeed = 0.85;
    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (sp > maxSpeed) {
      this.vx = (this.vx / sp) * maxSpeed;
      this.vy = (this.vy / sp) * maxSpeed;
    }

    if (this.x < this.roamMinX) {
      this.x = this.roamMinX;
      this.vx = Math.abs(this.vx);
    }
    if (this.x > this.roamMaxX) {
      this.x = this.roamMaxX;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < this.roamMinY) {
      this.y = this.roamMinY;
      this.vy = Math.abs(this.vy);
    }
    if (this.y > this.roamMaxY) {
      this.y = this.roamMaxY;
      this.vy = -Math.abs(this.vy);
    }
  }

  draw(ctx) {
    if (!this.active) return;

    const glowPulse = 0.92 + Math.sin(this.flicker) * 0.05;

    const outerGlow = ctx.createRadialGradient(
      this.x, this.y, 10,
      this.x, this.y, this.glowRadius
    );
    outerGlow.addColorStop(0, `rgba(245, 182, 112, ${0.28 * glowPulse})`);
    outerGlow.addColorStop(0.5, `rgba(222, 161, 94, ${0.16 * glowPulse})`);
    outerGlow.addColorStop(1, "rgba(222, 161, 94, 0)");

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(245, 182, 112, 0.92)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.ringRadius - 6, 0, Math.PI * 2);
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = "rgba(222, 161, 94, 0.7)";
    ctx.stroke();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.translate(-this.x, -this.y);

    drawStarPath(ctx, this.x, this.y, this.radius, this.radius * 0.48, 5);

    const core = ctx.createRadialGradient(
      this.x - 8, this.y - 10, 4,
      this.x, this.y, this.radius
    );
    core.addColorStop(0, "#FFF2D4");
    core.addColorStop(0.48, "#F5B670");
    core.addColorStop(1, "#DEA15E");

    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(222, 161, 94, 0.72)";
    ctx.fillStyle = core;
    ctx.fill();

    ctx.shadowBlur = 0;

    drawStarPath(ctx, this.x, this.y, this.radius, this.radius * 0.48, 5);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = "#FFF4DA";
    ctx.stroke();

    drawStarPath(
      ctx,
      this.x - 4,
      this.y - 6,
      this.radius * 0.35,
      this.radius * 0.15,
      5
    );
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fill();

    ctx.restore();
  }

  // Золотое комбо (Redlet, несущий GoldRing) касается ХоумСтар — доставка
  // засчитывается (НАГРАДА, инверсия семантики scene7's isHit).
  isGoldComboDelivered(goldRing) {
  if (!this.active || !goldRing) return false;
  if (goldRing.state !== "attachedToRedlet") return false;

  const dx = goldRing.x - this.x;
  const dy = goldRing.y - this.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist < this.radius + goldRing.collisionRadius;
}
  // Отдельно проверяем каждого "пришвартованного" (following) старлета —
  // они доставляются вместе с комбо и тоже засчитываются в очки.
  isHit(starlet) {
  if (!this.active || this.radius <= 0.001) return false;
  const dx = starlet.x - this.x;
  const dy = starlet.y - this.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < this.radius * 0.72;
}

  blocksObstacle(obstacle) {
    if (!this.active) return false;
    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.ringRadius + obstacle.ringRadius;
  }

  repelObstacle(obstacle) {
    if (!this.active) return;

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

// ============================================================================
//  TutorGuide3 — новый обучающий указатель для сцены 9. Структура (фазы,
//  таймеры удержания/затухания, кольца-маркеры, путь-трасса, курсор-призрак)
//  скопирована из TutorGuide2 (GameplayScene8) практически без изменений —
//  изменена только последовательность целей и условия проверки "жив ли ещё
//  объект" под новые сущности сцены.
//
//  Последовательность (по ТЗ): GoldRing -> свободный Redlet -> Starlet ->
//  HomeStar.
//
//  Цепочка фаз: waiting -> markGold -> toRedlet -> markRedlet -> toStarlet ->
//               markStarlet -> toHome -> fading -> restart -> (repeat)
// ============================================================================
class TutorGuide3 {
  constructor() {
    this.enabled = true;
    this.active = false;
    this.completed = false;

    this.x = 0;
    this.y = 0;
    this.speed = 240;

    this.color = "#ffcd5a";
    this.glowColor = "rgba(255, 205, 90, 0.45)";

    this.mode = "none";
    // waiting -> markGold -> toRedlet -> markRedlet -> toStarlet ->
    // markStarlet -> toHome -> fading -> restart
    this.phase = "waiting";

    this.goldTarget = null;
    this.redletTarget = null;
    this.starletTarget = null;
    this.homeTarget = null;

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

    this.goldTarget = null;
    this.redletTarget = null;
    this.starletTarget = null;
    this.homeTarget = null;

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
    this.goldTarget = null;
    this.redletTarget = null;
    this.starletTarget = null;
    this.homeTarget = null;
    this.fadeTimer = 0;
    this.holdTimer = 0;
    this.restartTimer = 0;
    this.startTimer = 0;
  }

  notifySuccess() {
    this.disable();
  }

  // Тутор-зона: правая половина экрана (по аналогии с TutorGuide2) — так
  // подсказка не указывает на объекты, которые игрок пока не видит.
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

    // Как только игрок сам совершил хоть одну спасательную доставку —
    // подсказка больше не нужна.
    if (game.goldRescuedCount > 0) {
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

    // GoldRing и активный Redlet-носитель считаем "живыми", пока сцена не
    // удалила золотое кольцо (доставлено/просрочено) — как только оно ушло
    // из игры, подсказку нет смысла продолжать в этом цикле.
    const goldAlive =
      this.goldTarget &&
      game.activeGoldRing === this.goldTarget &&
      !this.goldTarget.isGone();

    const starletAlive =
      this.starletTarget &&
      game.starlets.includes(this.starletTarget) &&
      this.isInTutorZone(this.starletTarget, game);

    if (!goldAlive || !starletAlive) {
      this.startFadeOut();
    }
  }

  beginFullHint(game) {
    if (!game.activeGoldRing || !game.starlets || game.starlets.length < 1) {
      this.phase = "waiting";
      return false;
    }

    // Свободный Redlet — тот, что ещё ничего не несёт (кандидат на золотое
    // комбо). Если сейчас нет ни одного свободного — ждём следующего цикла.
    const freeRedlet = (game.redlets ?? []).find((r) => r.isFree());
    if (!freeRedlet) {
      this.phase = "waiting";
      return false;
    }

    const pool = game.starlets.filter((starlet) =>
      this.isInTutorZone(starlet, game)
    );
    if (pool.length < 1) {
      this.phase = "waiting";
      return false;
    }

    const starIndex = Math.floor(Math.random() * pool.length);
    this.starletTarget = pool[starIndex];

    this.goldTarget = game.activeGoldRing;
    this.redletTarget = freeRedlet;
    this.homeTarget = game.homeStar;

    this.mode = "full";
    this.phase = "markGold";

    this.x = this.goldTarget.x + 30;
    this.y = this.goldTarget.y - 18;

    this.pathOpacity = 1;
    this.rings = [];
    this.addRing(this.goldTarget);

    this.holdTimer = this.markHoldDuration;
    this.active = true;
    this.startTimer = 0;

    return true;
  }

  updateFullMode(delta, game) {
    this.goldTarget = game.activeGoldRing ?? this.goldTarget;
    this.homeTarget = game.homeStar ?? this.homeTarget;

    if (!this.goldTarget || this.goldTarget.isGone()) {
      this.startFadeOut();
      return;
    }

    if (
      !this.starletTarget ||
      !game.starlets.includes(this.starletTarget) ||
      !this.isInTutorZone(this.starletTarget, game)
    ) {
      this.startFadeOut();
      return;
    }

    // 1) Отметить золотое кольцо.
    if (this.phase === "markGold") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toRedlet";
      return;
    }

    // 2) Путь к свободному редлету.
    if (this.phase === "toRedlet") {
      const target = this.redletTarget ?? this.goldTarget;
      const arrived = this.moveTowards(target.x, target.y, delta);

      if (arrived) {
        if (this.redletTarget) this.addRing(this.redletTarget);
        this.phase = "markRedlet";
        this.holdTimer = this.markHoldDuration;
      }
      return;
    }

    // 3) Отметить редлета.
    if (this.phase === "markRedlet") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toStarlet";
      return;
    }

    // 4) Путь к старлету.
    if (this.phase === "toStarlet") {
      const arrived = this.moveTowards(
        this.starletTarget.x,
        this.starletTarget.y,
        delta
      );

      if (arrived) {
        this.addRing(this.starletTarget);
        this.phase = "markStarlet";
        this.holdTimer = this.markHoldDuration;
      }
      return;
    }

    // 5) Отметить старлет.
    if (this.phase === "markStarlet") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toHome";
      return;
    }

    // 6) Путь к ХоумСтар.
    if (this.phase === "toHome") {
      const target = this.homeTarget;
      if (!target || !target.active) {
        this.startFadeOut();
        return;
      }

      const arrived = this.moveTowards(target.x, target.y, delta);

      if (arrived) {
        this.addRing(target);
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
      this.goldTarget = null;
      this.redletTarget = null;
      this.starletTarget = null;
      this.homeTarget = null;
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

      if (ring.target === this.goldTarget || ring.target === this.redletTarget || ring.target === this.homeTarget) {
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
    ctx.strokeStyle = "rgba(255, 205, 90, 0.82)";

    const gold = this.goldTarget;
    const redlet = this.redletTarget;
    const star = this.starletTarget;
    const home = this.homeTarget;

    if (this.phase === "toRedlet" && gold && redlet) {
      ctx.beginPath();
      ctx.moveTo(gold.x, gold.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (
      gold &&
      redlet &&
      (this.phase === "markRedlet" ||
        this.phase === "toStarlet" ||
        this.phase === "markStarlet" ||
        this.phase === "toHome" ||
        this.phase === "fading")
    ) {
      ctx.beginPath();
      ctx.moveTo(gold.x, gold.y);
      ctx.lineTo(redlet.x, redlet.y);
      ctx.stroke();
    }

    if (this.phase === "toStarlet" && redlet && star) {
      ctx.beginPath();
      ctx.moveTo(redlet.x, redlet.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (
      redlet &&
      star &&
      (this.phase === "markStarlet" ||
        this.phase === "toHome" ||
        this.phase === "fading")
    ) {
      ctx.beginPath();
      ctx.moveTo(redlet.x, redlet.y);
      ctx.lineTo(star.x, star.y);
      ctx.stroke();
    }

    if ((this.phase === "toHome" || this.phase === "fading") && star && home) {
      const endX = this.phase === "fading" ? home.x : this.x;
      const endY = this.phase === "fading" ? home.y : this.y;

      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
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
      ctx.strokeStyle = "rgba(255, 205, 90, 0.85)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(target.x, target.y, radius + 4, 0, Math.PI * 2);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(255, 224, 140, 0.35)";
      ctx.stroke();
    }

    ctx.restore();
  }

  drawCursor(ctx) {
    if (!this.active || this.pathOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.pathOpacity;

    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 24);
    glow.addColorStop(0, "rgba(255, 224, 140, 0.30)");
    glow.addColorStop(1, "rgba(255, 224, 140, 0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "rgba(255, 205, 90, 0.95)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 224, 160, 0.95)";
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

// ============================================================================
//  GameplayScene9 — главный класс сцены.
//
//  Структура (конструктор/DOM-привязки/ресайз/аудио/тутор-обёртка/лупы
//  входа-выхода) скопирована из базового скелета сцены (game8/game9-draft)
//  практически без изменений. Изменена игровая часть: вместо одиночного
//  Blacklet+RedRing здесь — до 3 RedRing одновременно, конкурирующие Redlet,
//  и центральная механика GoldRing (игрок ловит кольцо курсором, цепляет на
//  свободного Redlet, ведёт комбо к HomeStar до истечения 10 секунд, попутно
//  собирая по пути свободных Starlet-ов в свой "хвост").
// ============================================================================
export class GameplayScene9 {
  constructor({
    sceneId = "game9",
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
    this.sceneMusicUrl = "../../assets/audio/game9.mp3";
    this.sceneBackgroundUrl = "../../assets/images/backgrounds/game_bg9.webp";
    this.defaultBackgroundUrl = "../../assets/images/backgrounds/game_bg1.webp";

    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.savedCountElement = document.getElementById("savedCount");
    this.lostCountElement = document.getElementById("lostCount");
    this.scoreElement = document.getElementById("scoreValue");
    this.heartFillRect = document.getElementById("heartFillRect");
    this.heartIconElement = document.querySelector(".heart-icon");
    this.timeFillElement = document.getElementById("timeFill");

    // Новый HUD-элемент для счётчика спасённых золотых колец (goldRescuedCount/4).
    // В текущей вёрстке такого элемента, скорее всего, ещё нет — обращаемся
    // к нему защитно (optional chaining), ничего не ломается, если id не найден.
    this.goldRescuedElement = document.getElementById("goldRescuedCount");

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
      "Спаси черную звезду, поймав ее золотым кольцом-> Собирай маленькие звездочки-> Веди их к дому, избегая хищных звезд!";

    this.levelTargetScore = 400;
    this.levelPassed = false;
    this.displayedHeartProgress = 0;
    this.targetHeartProgress = 0;
    this.heartPulseTimeout = null;
    this.motherStar = null;

    // --- Новые сущности сцены 9 ---
    this.homeStar = null;               // цель доставки золотого комбо (база — HomeStar из сцены7)
    this.redRings = [];                 // до 3 одновременных свободных колец-мишеней для редлетов
    this.activeGoldRing = null;         // ровно одно золотое кольцо в любой момент времени
    this.goldRescuedCount = 0;          // успешные доставки GoldRing+Redlet в HomeStar (нужно 4)
    this.activeGoldCombo = false;       // true, когда есть Redlet, несущий GoldRing
    this.goldComboExpireTimer = 0;      // обратный отсчёт 10с для активного золотого комбо

        // --------------------------------------------------------------------
    // HUD: панель «спасений» — маленькая иконка золотого кольца со звездой.
    // --------------------------------------------------------------------
    this.rescueHudX = 0;
    this.rescueHudY = 0;
    this.rescueHudRadius = 0;
    this.rescueHudPulse = 0;
    this.rescueHudBaseOpacity = 0.85;
    this.rescueHudOpacity = 0.0;

    this.redlets = [];
    this.redletSpawnTimer = 0;
    this.redletSpawnInterval = 6.2;
    this.redletTrailTimer = 0;
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

    this.spawnPhase = "intro_home";
    this.spawnTimer = 0;
    this.starletsSpawned = false;

    this.tutor = new TutorGuide3();
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
          goldRescuedCount: this.goldRescuedCount,
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

  // --------------------------------------------------------------------
  //  Инициализация игровых объектов сцены (используется в конструкторе,
  //  resetGame() и enter()).
  // --------------------------------------------------------------------
  initSceneObjects() {
  this.motherStar = new MotherStar(this.sceneMetrics);
  this.homeStar = new HomeStar(this.sceneMetrics);

  this.redRings = [];
  this.activeGoldRing = null;
  this.goldRescuedCount = 0;
  this.activeGoldCombo = false;
  this.goldComboExpireTimer = 0;

  this.starlets = [];
  this.redlets = [];
  this.redletSpawnTimer = 0;
  this.redletTrailTimer = 0;
  this.redletSpawnInterval = 6.2;
  this.obstacles = [];

  // Последовательный спавн вместо интро-стейт-машины.
  // spawnPhase остаётся строкой "gameplay_live", т.к. на неё завязаны
  // остальные геймплейные гейты (обстаклы, полный AI редлетов и т.п.) —
  // просто устанавливаем её позже, через таймер.
  this.spawnPhase = "warmup";
  this.spawnTimer = 0;

  this.spawnedInitialWave = false; // t=0: GoldRing + Redlet
  this.spawnedMother = false;      // t=1: MotherStar
  this.spawnedHomeAndTutor = false; // t=2: HomeStar + Tutor
  this.spawnedSecondWave = false;   // t=4: доп. RedRing + Redlet -> gameplay_live

  this.setupRescueHud();
}

  setupRescueHud() {
  const { starletBaseRadius = 8, playScale = 1 } = this.sceneMetrics ?? {};

  // Размер калибруется от той же базовой величины, что и остальные игровые
  // иконки сцены (starletBaseRadius * playScale) — при ресайзе/другом
  // разрешении экрана HUD-иконка будет масштабироваться синхронно со всем
  // остальным на сцене, а не жить по своим магическим числам.
  const hudSize = starletBaseRadius * 2.4 * playScale;
  this.rescueHudRadius = hudSize * 0.62 * 1.5;

  const anchorRect = this.getRankHudAnchorRect();

  if (anchorRect) {
    // Ставим сразу после последней медали ранга, с небольшим отступом,
    // пропорциональным размеру самой иконки.
    const gap = hudSize * 0.9;
    this.rescueHudX = anchorRect.right + gap + this.rescueHudRadius;
    this.rescueHudY = anchorRect.top + anchorRect.height / 2;
  } else {
    // Фолбэк на случай, если DOM HUD ещё не отрендерен (например, самый
    // первый кадр до layout) — старое поведение в правом верхнем углу.
    const { width = 1366 } = this.sceneMetrics ?? {};
    this.rescueHudX = width - hudSize * 1.5;
    this.rescueHudY = hudSize * 0.9;
  }

  this.rescueHudPulse = 0;
  this.rescueHudOpacity = this.rescueHudBaseOpacity;
}

getRankHudAnchorRect() {
  const lastMedal = this.rankMedalElements?.[this.rankMedalElements.length - 1];
  const anchor = lastMedal ?? this.scoreElement;
  if (!anchor || !this.canvas) return null;

  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null; // элемент ещё не отрендерен

  const canvasRect = this.canvas.getBoundingClientRect();
  if (canvasRect.width === 0 || canvasRect.height === 0) return null;

  const scaleX = this.canvas.width / canvasRect.width;
  const scaleY = this.canvas.height / canvasRect.height;

  return {
    top: (rect.top - canvasRect.top) * scaleY,
    right: (rect.right - canvasRect.left) * scaleX,
    height: rect.height * scaleY,
  };
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

  if (this.motherStar) this.motherStar.setBounds(this.sceneMetrics);
  if (this.homeStar) this.homeStar.setBounds(this.sceneMetrics);
  if (this.redRings?.length) this.redRings.forEach((ring) => ring.setBounds(this.sceneMetrics));
  if (this.activeGoldRing) this.activeGoldRing.setBounds(this.sceneMetrics);
  if (this.redlets?.length) this.redlets.forEach((r) => r.setBounds(this.sceneMetrics));

  if (this.rotateHint) {
    this.rotateHint.classList.toggle("show", !this.isLandscape() && !this.gameOver && !this.isRunning);
  }

  // ДОБАВЛЕНО: пересчитать размер/позицию rescueHud при каждом ресайзе —
  // иначе иконка "залипает" на позиции первого кадра и её привязка к
  // ранговому блоку перестаёт быть верной после смены размера окна.
  this.setupRescueHud();
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
    if (this.sceneId === "game9") {
      return "Поймай золотое кольцо и надень его на свободного редлета -> Веди сияющую пару к дому за 10 секунд, собирая свободных старлетов по пути!";
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

  // Ранг засчитывается только если пройдены ОБА условия победы: очки и
  // 4/4 доставленных золотых комбо.
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
    const passedByGold = this.goldRescuedCount >= 4;
    const passedByScoreAndGold = passedByScore && passedByGold;

    const { oneMedalScore, twoMedalScore, threeMedalScore } =
      this.getRankThresholds();

    let liveMedalCount = 0;
    if (passedByScoreAndGold && this.score >= oneMedalScore) liveMedalCount = 1;
    if (passedByScoreAndGold && this.score >= twoMedalScore) liveMedalCount = 2;
    if (passedByScoreAndGold && this.score >= threeMedalScore) liveMedalCount = 3;

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
        ? "Дом озарён светом"
        : "Дом ещё не озарён";
    }

    if (this.resultMessageElement) {
      this.resultMessageElement.textContent = this.levelPassed
        ? "Все спасённые звёзды нашли путь домой!"
        : this.goldRescuedCount < 4
        ? `Домой добралось только ${this.goldRescuedCount} из 4 золотых пар.`
        : "Очков пока не хватает для победы.";
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
  this.redletSpawnInterval = 6.2;

  this.score = 0;
  this.savedCount = 0;
  this.lostCount = 0;
  this.eatenCount = 0;
  this.goldRescuedCount = 0;

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

  // Пересоздаём объекты перевёрнутого режима и спавн-директор.
  // initSceneObjects() теперь сам настраивает HUD (setupRescueHud()).
  this.initSceneObjects();

  // Туториал НЕ показываем при «Играть снова» (перезапуск уровня) —
  // он играет только при первом входе в сцену (в start()).
  this.tutorialEnabledForRun = false;
  this.tutor.reset({ enabled: false });

  this.updateUI();
  this.draw();

  if (restartAmbient) {
    this.audio.startAmbient({ restart: false });
  }

  this.startGameLoop();
};

  // --------------------------------------------------------------------
  //  Спавн: Starlet-ы, RedRing-и, GoldRing, Redlet-ы, Obstacle-ы.
  // --------------------------------------------------------------------
  spawnStarletsFromMotherStar() {
    if (!this.motherStar?.isSpawnReady()) return;

    const maxStarlets = 12;
    const missing = Math.max(0, maxStarlets - this.starlets.length);
    if (missing <= 0) return;

    this.audio?.playStarletSpawnSound?.();

    const originX = this.motherStar.x;
    const originY = this.motherStar.y;

    for (let i = 0; i < missing; i++) {
      const starlet = new FreeStarlet(originX, originY, "right", this.sceneMetrics);

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

  // До 3 колец одновременно; следующее свободное кольцо спавнится только
  // когда предыдущее захвачено (пункт ТЗ #10).
  spawnRedRingIfNeeded() {
    const activeCount = this.redRings.filter(
      (r) => r && r.state !== "gone"
    ).length;

    if (activeCount >= 3) return null;

    const sides = ["top", "bottom", "left", "right"];
    const side = sides[Math.floor(Math.random() * sides.length)];

    const ring = new RedRing(this.sceneMetrics);
    ring.onGone = () => {
      this.ringGoneAudio.playRingGoneSound?.();
    };
    ring.activateIntro(side);

    this.redRings.push(ring);
    return ring;
  }

  removeGoneRedRings() {
    this.redRings = this.redRings.filter((r) => r && r.state !== "gone");
  }

  // Ровно одно золотое кольцо в любой момент времени (пункт ТЗ #4).
  spawnGoldRingIfNeeded() {
    if (this.activeGoldRing && !this.activeGoldRing.isGone()) return null;

    const sides = ["top", "bottom", "left", "right"];
    const side = sides[Math.floor(Math.random() * sides.length)];

    const goldRing = new GoldRing(this.sceneMetrics);
    goldRing.spawn(side);

    this.activeGoldRing = goldRing;
    return goldRing;
  }

  spawnRedlet() {
    const activeRedlets = this.redlets.filter(
      (r) => r && !r.markedForRemoval
    ).length;
    if (activeRedlets >= 6) return null;

    const redlet = new Redlet(this.sceneMetrics);
    this.redlets.push(redlet);
    return redlet;
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

  // Хвост частиц за золотым комбо (Redlet, несущий GoldRing).
  emitGoldComboTrail(delta) {
    const ring = this.activeGoldRing;
    if (!ring || ring.state !== "attachedToRedlet") {
      this._goldTrailTimer = 0;
      return;
    }

    this._goldTrailTimer = (this._goldTrailTimer ?? 0) + delta;
    const interval = 0.018;

    while (this._goldTrailTimer >= interval) {
      this._goldTrailTimer -= interval;

      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = ring.collisionRadius * (0.82 + Math.random() * 0.34);

        const px = ring.x + Math.cos(angle) * radius;
        const py = ring.y + Math.sin(angle) * radius;

        this.particles.push(
          new Particle(px, py, "rgba(255, 205, 90, 0.92)", false, {
            vx: (Math.random() - 0.5) * 0.42 - 0.02,
            vy: (Math.random() - 0.5) * 0.42 + 0.02,
            life: 0.82 + Math.random() * 0.24,
            decay: 0.032 + Math.random() * 0.016,
            size: 1.0 + Math.random() * 1.6,
            gravity: -0.0012,
            shrink: 0.008,
            alphaBoost: 0.9,
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

        const angle = Math.random() * Math.PI * 2;
        const hasRing = redlet.carryingRedRing || redlet.carryingGoldRing;

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
          continue;
        }

        const readyPulse = 1 + Math.sin(redlet.pulsePhase) * 0.06;
        const ringRadius = redlet.radius * readyPulse * 1.55;
        const ringBand = Math.max(1.2, redlet.radius * 0.18);
        const r = ringRadius + (Math.random() - 0.5) * ringBand;

        const px = redlet.x + Math.cos(angle) * r;
        const py = redlet.y + Math.sin(angle) * r;

        const color = redlet.carryingGoldRing
          ? "rgba(255, 205, 90, 0.96)"
          : "rgba(18, 24, 36, 0.96)";

        this.particles.push(
          new Particle(px, py, color, false, {
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
      }
    }
  }

  emitEatBurst(x, y) {
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
  }

  // Особый праздничный залп в момент успешной доставки золотого комбо.
  emitDeliveryBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.3;

      this.particles.push(
        new Particle(x, y, "rgba(255, 224, 140, 0.98)", false, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.9 + Math.random() * 0.35,
          decay: 0.024 + Math.random() * 0.014,
          size: 1.6 + Math.random() * 2.2,
          shrink: 0.01,
          alphaBoost: 1.0,
          gravity: -0.002 + Math.random() * 0.003,
        })
      );
    }

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.6;

      this.particles.push(
        new Particle(x, y, "rgba(255, 246, 214, 0.85)", false, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.2,
          decay: 0.036 + Math.random() * 0.016,
          size: 1.0 + Math.random() * 1.4,
          shrink: 0.011,
          alphaBoost: 0.8,
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

  getIntroPrimaryRedlet() {
  if (
    this.introMainRedlet &&
    !this.introMainRedlet.markedForRemoval
  ) {
    return this.introMainRedlet;
  }

  this.introMainRedlet =
    this.redlets.find((redlet) => redlet && !redlet.markedForRemoval) ?? null;

  return this.introMainRedlet;
}

getIntroTutorStarlet() {
  if (
    this.introTutorStarlet &&
    this.starlets.includes(this.introTutorStarlet) &&
    this.introTutorStarlet.state === "free"
  ) {
    return this.introTutorStarlet;
  }

  this.introTutorStarlet =
    this.starlets.find((starlet) => starlet && starlet.state === "free") ?? null;

  return this.introTutorStarlet;
}

isHomeStarReadyForTutor() {
  return !!(
    this.homeStar &&
    this.homeStar.active &&
    this.homeStar.radius > this.homeStar.baseRadius * 0.2
  );
}

  // --------------------------------------------------------------------
  //  Директор входа в игру: HomeStar заходит слева -> первое RedRing и
  //  первое GoldRing появляются -> MotherStar активируется и стартует
  //  обычный игровой цикл.
  // --------------------------------------------------------------------
  updateSpawnDirector(delta) {
  this.spawnTimer += delta;

  // t=0 — сразу при входе: золотое кольцо и первый редлет.
  if (!this.spawnedInitialWave) {
    this.spawnGoldRingIfNeeded();
    this.spawnRedlet();
    this.spawnedInitialWave = true;
  }

  // t=1с — материнская звезда начинает цикл (появятся старлеты).
  if (!this.spawnedMother && this.spawnTimer >= 1) {
    this.motherStar?.activate();
    this.spawnedMother = true;
  }

  // t=2с — хоумстар выходит на сцену, тьютор стартует (если включён).
  // TutorGuide3 сам ждёт свой startDelay и сам находит цели — здесь
  // достаточно его сбросить и включить/выключить по флагу забега.
  if (!this.spawnedHomeAndTutor && this.spawnTimer >= 2) {
    this.homeStar?.activateFromLeft();
    this.tutor.reset({ enabled: this.tutorialEnabledForRun });
    this.spawnedHomeAndTutor = true;
  }

  // t=4с — вторая волна: ещё одно RedRing и ещё один Redlet,
  // и только теперь включаем полноценный "живой" геймплей
  // (обстаклы, воровство колец редлетами и т.п. завязаны на эту строку).
  if (!this.spawnedSecondWave && this.spawnTimer >= 4) {
    this.spawnRedRingIfNeeded();
    this.spawnRedlet();

    this.spawnedSecondWave = true;
    this.spawnPhase = "gameplay_live";
    this.obstacleTimer = 0;
  }
}


  // --------------------------------------------------------------------
  //  Основной игровой цикл. Порядок соответствует пункту ТЗ №19:
  //  MotherStar -> спавн Starlet при необходимости -> RedRing[] ->
  //  GoldRing -> Redlet[] -> Starlets (следование только при активном
  //  золотом комбо) -> Obstacle[] -> столкновения GoldRing-Redlet ->
  //  захват Starlet золотым комбо -> поедание Starlet враждебным комбо ->
  //  столкновения с препятствиями -> прибытие в HomeStar -> проверка
  //  истечения таймера золотого комбо -> HUD -> победа/проигрыш.
  // --------------------------------------------------------------------
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

      // Победа требует ОБА условия: очки >= цели И 4/4 золотых доставки.
      this.levelPassed =
        this.score >= this.levelTargetScore && this.goldRescuedCount >= 4;

      if (!this.isTransitioning) {
        this.showRoundResult();
      }
      return;
    }

    this.updateSpawnDirector(delta);

    const liveGameplay = this.spawnPhase === "gameplay_live";

    if (liveGameplay) {
  this.obstacleTimer += delta;

  if (!this.nextObstacleInterval) {
    this.nextObstacleInterval = 1.9 + Math.random() * 0.9;
  }

  while (this.obstacleTimer >= this.nextObstacleInterval) {
    this.obstacleTimer -= this.nextObstacleInterval;
    this.spawnObstacle();
    this.nextObstacleInterval = 1.9 + Math.random() * 0.9;
  }
}

    

    // 1) MotherStar.
    if (this.motherStar) {
      this.motherStar.update(delta);

      if (this.motherStar.consumeSpawnPulse()) {
        this.spawnStarletsFromMotherStar();
      }
    }

    // 2) HomeStar (блуждание/анимация цели доставки).
    if (this.homeStar) {
      this.homeStar.update(delta);
    }

    // 3) RedRing[] — свободные кольца-мишени для редлетов.
    // ВАЖНО: в состоянии "attached"/"decaying" RedRing.update() требует
    // живую ссылку на несущего redlet-а каждый кадр — если передать null,
    // кольцо в состоянии "attached" немедленно отцепится (см. RedRing.update).
    if (this.redRings.length) {
      this.redRings.forEach((ring) => {
        const carrier = ring.anchorRedlet ?? null;
        ring.update(delta, carrier);
      });
    }
    this.removeGoneRedRings();

    if (liveGameplay) {
      this.spawnRedRingIfNeeded();
    }

    // 4) GoldRing — ловля курсором / переноска редлетом.
    if (this.activeGoldRing) {
      const prevState = this.activeGoldRing.state;
      this.activeGoldRing.update(delta, this.mousePos, this.isDragging);

      if (
        prevState !== "attachedToRedlet" &&
        this.activeGoldRing.state === "attachedToRedlet"
      ) {
        this.activeGoldCombo = true;
        this.goldComboExpireTimer = this.activeGoldRing.comboLifeDuration;
        this.emitDeliveryBurst(this.activeGoldRing.x, this.activeGoldRing.y);
      }
    }

    if (liveGameplay && (!this.activeGoldRing || this.activeGoldRing.isGone())) {
      this.spawnGoldRingIfNeeded();
    }

    this.emitGoldComboTrail(delta);

    // 5) Redlet[] — приоритеты: свободное кольцо -> кража у комбо ->
    //    охота на Starlet при переноске кольца.
    if (liveGameplay) {
      this.redletSpawnTimer += delta;
      if (this.redletSpawnTimer >= this.redletSpawnInterval) {
        this.spawnRedlet();
        this.redletSpawnTimer = 0;

        if (this.redletSpawnInterval > 4.2) {
          this.redletSpawnInterval -= 0.15;
        }
      }
    }

    if (this.redlets?.length) {
      // freeRedRings — только кольца в состоянии idle (можно поймать);
      // activeCombos — только другие редлеты, реально несущие RedRing —
      // без этой фильтрации getTargetPoint() ломает приоритеты из ТЗ п.11.
      const freeRedRingsForTargeting = this.redRings.filter((r) => r && r.canAttach());
      const activeCombosForTargeting = this.redlets.filter(
        (r) =>
          r &&
          !r.markedForRemoval &&
          r.hasCapturedRing &&
          r.carryingRedRing &&
          r.state !== "carryingGoldRing"
      );

      this.redlets.forEach((redlet) =>
        redlet.update(
          delta,
          freeRedRingsForTargeting,
          activeCombosForTargeting,
          this.starlets,
          this.redlets,
          this.mousePos
        )
      );
    }

    // 9б) Кража RedRing между редлетами при касании (ТЗ п.12).
    if (liveGameplay) {
      this.checkRedletStealing();
    }

    this.emitRedletTrails(delta);

    // 6) Starlets — следование разрешено только при активном золотом
    //    комбо (пункт ТЗ №7). Центр роя — сам несущий Redlet.
    const carrierRedlet = this.getGoldCarrierRedlet();
    const canCapture = !!carrierRedlet;
    const followPos = carrierRedlet
      ? { x: carrierRedlet.x, y: carrierRedlet.y }
      : null;

    this.starlets.forEach((s) =>
      s.update(delta, followPos, canCapture, followPos)
    );
    this.removeOffscreenStarlets();

    // 7) Obstacle[].
    if (liveGameplay) {
      this.obstacles.forEach((o) => {
        o.update();

        if (this.motherStar && this.motherStar.blocksObstacle(o)) {
          this.motherStar.repelObstacle(o);
        }

        if (this.homeStar && this.homeStar.blocksObstacle(o)) {
          this.homeStar.repelObstacle(o);
        }

        this.redRings.forEach((ring) => {
          if (ring.blocksObstacle(o)) ring.repelObstacle(o);
        });
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());
    this.redlets = this.redlets.filter((r) => r && !r.markedForRemoval);

    // 8) Столкновения GoldRing <-> свободный Redlet (формирование комбо).
    this.checkGoldRingRedletAttach();

    // 9) Столкновения Redlet <-> свободный RedRing (захват колец).
    if (liveGameplay) {
      this.checkRedletRingCapture();
    }

    // 10) Захват Starlet золотым комбо.
    // (реализовано внутри FreeStarlet.update через canCapture/followPos —
    //  здесь только начисляем очки за уже подтверждённый вход в рой,
    //  сама механика "прилипания" находится в классе FreeStarlet).

    // 11) Поедание свободных Starlet враждебным комбо (Redlet+RedRing или
    //     Redlet, несущий украденное RedRing).
    if (liveGameplay) {
      this.checkRedletStarletEats();
    }

    // 12) Столкновения Starlet <-> Obstacle.
    if (liveGameplay) {
      this.checkObstacleCollisions();
    }

    // 13) Прибытие золотого комбо (и его хвоста) в HomeStar — приоритет
    //     выше истечения таймера комбо в тот же кадр (граничный случай).
    // 13) Прибытие золотого комбо в HomeStar.
    this.checkHomeStarDelivery();

    // 13.5) Старлеты, отцепленные от комбо, долетают до самой звезды
    // HomeStar и только тогда засчитываются.
    this.checkHomingStarletsToHomeStar();

    // 14) Истечение таймера золотого комбо (10с) — только если комбо
    // ещё не было доставлено в этом кадре.
    this.checkGoldComboExpiry(delta);

        // HUD спасений: затухание вспышки и лёгкий пульс.
    if (this.rescueHudPulse > 0 || this.rescueHudOpacity > 0) {
      // Пульс радиуса.
      this.rescueHudPulse = Math.max(0, this.rescueHudPulse - delta * 2.8);

      // Плавное возвращение непрозрачности к базовой.
      const targetOpacity = this.rescueHudBaseOpacity;
      const blend = 1 - Math.exp(-3.2 * delta);
      this.rescueHudOpacity += (targetOpacity - this.rescueHudOpacity) * blend;

      if (this.rescueHudOpacity < 0.02 && this.rescueHudPulse <= 0.001) {
        this.rescueHudOpacity = 0;
        this.rescueHudPulse = 0;
      }
    }


    this.updateHeartProgress(delta);
    this.updateGoldProgressUI();
    this.updateUI();

    // Обновление тутора после всех изменений состояния сцены.
    this.tutor.update(delta, this);
  }

  // --------------------------------------------------------------------
  //  Вспомогательные проверки и обработчики столкновений.
  // --------------------------------------------------------------------

  // Находит Redlet-а, который сейчас несёт активное золотое кольцо
  // (используется как центр роя для FreeStarlet и для проверок доставки).
  getGoldCarrierRedlet() {
    if (!this.activeGoldRing || this.activeGoldRing.state !== "attachedToRedlet") {
      return null;
    }
    return this.redlets.find((r) => r && r.carryingGoldRing) ?? null;
  }

  // GoldRing пойман курсором и столкнулся со свободным Redlet-ом ->
  // формируется золотое комбо (пункт ТЗ №6).
  checkGoldRingRedletAttach() {
  const ring = this.activeGoldRing;
  if (!ring || ring.state !== "followingCursor") return;
  if (!this.redlets?.length) return;

  for (const redlet of this.redlets) {
    if (!redlet || redlet.markedForRemoval) continue;
    if (redlet.carryingGoldRing) continue;
    if (redlet.state === "forming") continue;

    if (ring.collidesWithRedlet(redlet)) {
      ring.beginMagnetToRedlet(redlet);
      this.audio?.playRingGoneSound?.();
      break;
    }
  }
}

  // Redlet захватывает свободное RedRing (обычное конкурентное кольцо,
  // не золотое) — не даём захватывать редлету, уже несущему золотое кольцо.
  // RedRing.attachToRedlet() сам проверяет canAttach()/canCarryRedRing() и
  // вызывает redlet.setCarryingRedRing(this) — единая точка правды, вручную
  // состояние редлета здесь не трогаем во избежание рассинхронизации.
  checkRedletRingCapture() {
    if (!this.redRings?.length || !this.redlets?.length) return;

    for (const ring of this.redRings) {
      if (!ring || !ring.canAttach()) continue;

      for (const redlet of this.redlets) {
        if (!redlet || redlet.markedForRemoval) continue;
        if (!redlet.canCarryRedRing()) continue;

        if (ring.collidesWithRedlet(redlet)) {
          ring.attachToRedlet(redlet);
          break;
        }
      }
    }
  }

  // Кража RedRing между редлетами (тз п.12/13): если все 3 кольца заняты,
  // свободные редлеты летят к существующим комбо и крадут кольцо при
  // касании. Носитель золотого комбо (carryingGoldRing) никогда не может
  // стать жертвой кражи — у него нет hasCapturedRing/RedRing.
  checkRedletStealing() {
    if (!this.redlets?.length) return;

    const freeThieves = this.redlets.filter(
      (r) => r && !r.markedForRemoval && r.canCarryRedRing() && r.hasCapturedRing === false
    );
    if (!freeThieves.length) return;

    const activeCarriers = this.redlets.filter(
      (r) => r && !r.markedForRemoval && r.hasCapturedRing && r.carryingRedRing
    );
    if (!activeCarriers.length) return;

    for (const thief of freeThieves) {
      for (const victim of activeCarriers) {
        if (thief.canStealFrom(victim)) {
          thief.stealRedRingFrom(victim, victim.carryingRedRing);
          break;
        }
      }
    }
  }

  // Враждебные комбо (Redlet, несущий RedRing) поедают свободных Starlet.
  // Golden-carrier Redlet НЕ ест старлетов сам — они присоединяются к его
  // хвосту через механику захвата (FreeStarlet.update), а не через "eat".
  checkRedletStarletEats() {
    if (!this.redlets?.length || !this.starlets?.length) return;

    for (const redlet of this.redlets) {
      if (!redlet || redlet.markedForRemoval) continue;
      if (!redlet.canEatStarlets()) continue;

      for (let i = this.starlets.length - 1; i >= 0; i--) {
        const starlet = this.starlets[i];
        if (!starlet || starlet.state === "followingGoldCombo") continue;

        if (redlet.eatsStarlet(starlet)) {
          this.score = Math.max(0, this.score - 5);
          this.lostCount += 1;

          this.audio.playHitSound?.();
          this.emitEatBurst?.(starlet.x, starlet.y);
          this.spawnScatterEffect(starlet.x, starlet.y, "#7e3c48", true);

          this.starlets.splice(i, 1);
        }
      }
    }
  }

  checkObstacleCollisions() {
    for (let i = this.starlets.length - 1; i >= 0; i--) {
      const starlet = this.starlets[i];
      // Пришвартованные к золотому комбо старлеты защищены переносчиком —
      // штраф за столкновение с препятствием применяется только к
      // полностью свободным старлетам (симметрично поеданию выше).
      if (starlet.state === "followingGoldCombo") continue;

      for (const obstacle of this.obstacles) {
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

  // Доставка золотого комбо (Redlet+GoldRing) и всего его хвоста
  // старлетов в HomeStar. Приоритет выше истечения таймера в тот же
  // кадр (граничный случай из ТЗ).
  checkHomeStarDelivery() {
  const ring = this.activeGoldRing;
  if (!ring || ring.state !== "attachedToRedlet") return;
  if (!this.homeStar || !this.homeStar.active) return;

  if (!this.homeStar.isGoldComboDelivered(ring)) return;

  const carrier = this.getGoldCarrierRedlet();

  // Награда только за саму доставку GoldRing+Redlet.
  const goldReward = 40;
  this.score += goldReward;
  this.goldRescuedCount += 1;
  this.savedCount += 1;

   // Триггерим вспышку HUD-иконки спасений.
  this.rescueHudPulse = 1.0;
  this.rescueHudOpacity = 1.0;

  // Старлеты не засчитываются мгновенно.
  // Они отцепляются от хвоста и летят в HomeStar.
  for (const starlet of this.starlets) {
  if (starlet.state !== "followingGoldCombo") continue;
  starlet.sendToHomeStar(this.homeStar);
  }

  this.audio.playEatSound?.();
  this.emitDeliveryBurst(this.homeStar.x, this.homeStar.y);

  ring.deliver();

  if (carrier) {
  carrier.carryingGoldRing = null;
  carrier.state = carrier.carryingRedRing ? "carryingRedRing" : "free";
  }

  this.activeGoldRing = null;
  this.activeGoldCombo = false;
  this.goldComboExpireTimer = 0;
}

checkHomingStarletsToHomeStar() {
if (!this.homeStar || !this.homeStar.active) return;
if (!this.starlets?.length) return;

for (let i = this.starlets.length - 1; i >= 0; i--) {
const starlet = this.starlets[i];
if (!starlet || starlet.state !== "homingToHomeStar") continue;

if (this.homeStar.isHit(starlet)) {
this.score += 5;
this.savedCount += 1;
starlet.state = "scored";

this.audio.playScoreSound?.();
this.emitDeliveryBurst(starlet.x, starlet.y);

this.starlets.splice(i, 1);
}
}
}

  // Истечение 10-секундного таймера золотого комбо (если не была
  // доставка в этом же кадре — см. checkHomeStarDelivery выше).
  checkGoldComboExpiry(delta) {
    const ring = this.activeGoldRing;
    if (!ring || ring.state !== "attachedToRedlet") return;
    // Если кольцо уже было доставлено/снято в этом кадре — activeGoldRing
    // уже null к этому моменту, так что сюда не попадём повторно.

    if (!ring.isComboExpired()) return;

    const carrier = this.getGoldCarrierRedlet();

    // Все пришвартованные старлеты уничтожаются, штраф 5 очков за каждого.
    let followedCount = 0;
    for (let i = this.starlets.length - 1; i >= 0; i--) {
      const starlet = this.starlets[i];
      if (starlet.state !== "followingGoldCombo") continue;

      followedCount += 1;
      this.spawnScatterEffect(starlet.x, starlet.y, "#7e3c48", true);
      this.starlets.splice(i, 1);
    }

    const penalty = followedCount * 5;
    this.score = Math.max(0, this.score - penalty);
    this.lostCount += followedCount;

    // Комбо становится обычным препятствием (не подхватываемым).
    this.obstacles.push(Obstacle.fromFailedGoldCombo(ring.x, ring.y, this.sceneMetrics));

    this.audio.playHitSound?.();
    this.spawnScatterEffect(ring.x, ring.y, "#7e3c48", true);

    // ring.expire() сам очищает anchorRedlet.carryingGoldRing и помечает
    // редлета на удаление вместе с проваленным комбо.
    ring.expire();
    this.activeGoldRing = null;
    this.activeGoldCombo = false;
    this.goldComboExpireTimer = 0;

    console.log("[StarLine] gold combo expired", { followedCount, penalty });
  }

  updateTargetScoreUI() {
    if (this.targetScoreElement) {
      this.targetScoreElement.textContent = this.levelTargetScore;
    }
  }

  // Новый элемент HUD для счётчика "goldRescuedCount / 4". В текущей
  // вёрстке id="goldRescuedCount" может не существовать — обращение
  // защитное, сцена не ломается при его отсутствии.
  updateGoldProgressUI() {
    if (this.goldRescuedElement) {
      this.goldRescuedElement.textContent = `${this.goldRescuedCount}/4`;
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

    this.updateGoldProgressUI();
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

    // --------------------------------------------------------------------
  // Иконка HUD спасений: золотое кольцо с звездой, разделённой пополам.
  // Левая половина — чёрно-красная, правая — золотая.
  // При спасении комбо (GoldRing+Redlet в HomeStar) звезда на миг становится
  // полностью золотой за счёт rescueHudPulse.
  // --------------------------------------------------------------------
  drawRescueHud(ctx) {
  if (this.rescueHudOpacity <= 0.001) return;

  const playScale = this.sceneMetrics?.playScale ?? 1;
  const cx = this.rescueHudX;
  const cy = this.rescueHudY;
  const pulseScale = 1 + this.rescueHudPulse * 0.18;

  // Иконка (кольцо + звезда) — размер берём от rescueHudRadius, как раньше.
  const iconR = this.rescueHudRadius * pulseScale;
  const starOuter = iconR * 0.62;
  const starInner = starOuter * 0.42;

  // Текст — тот же стиль, что у scoreValue (.hud-value), шрифт наследуется от body (Georgia, serif).
  const fontSize = Math.max(16, Math.min(28, 24 * playScale));
  const rescueTarget = this.goldRescueTarget ?? 4;
  const text = `${this.goldRescuedCount ?? 0}/${rescueTarget}`;

  ctx.save();
  ctx.globalAlpha = this.rescueHudOpacity;
  ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(text).width;

  // --- Геометрия капсулы: икона слева, число справа, как в .rank-strip ---
  const gapIconText = iconR * 0.55;
  const padLeft = iconR * 0.5;
  const padRight = iconR * 0.6;
  const pillHeight = iconR * 2.5;
  const pillWidth = padLeft + iconR * 2 + gapIconText + textWidth + padRight;

  const pillLeft = cx - iconR - padLeft;
  const pillTop = cy - pillHeight / 2;
  const ry = pillHeight / 2;

  // --- Фон панели — как .rank-strip (linear-gradient 135deg + тонкая рамка) ---
  ctx.beginPath();
  ctx.moveTo(pillLeft + ry, pillTop);
  ctx.arc(pillLeft + ry, pillTop + ry, ry, -Math.PI / 2, Math.PI / 2, true);
  ctx.arc(pillLeft + pillWidth - ry, pillTop + ry, ry, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();

  const bgGrad = ctx.createLinearGradient(
    pillLeft, pillTop,
    pillLeft + pillWidth, pillTop + pillHeight
  );
  bgGrad.addColorStop(0, "rgba(149, 93, 112, 0.18)");
  bgGrad.addColorStop(1, "rgba(96, 55, 82, 0.14)");
  ctx.fillStyle = bgGrad;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(245, 182, 112, 0.05)";
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 215, 188, 0.18)";
  ctx.stroke();

  // Внутренний лёгкий блик, как inset-свет из .rank-strip.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = this.rescueHudOpacity * 0.5;
  ctx.beginPath();
  ctx.arc(pillLeft + ry, pillTop + ry * 0.35, pillWidth * 0.6, 0, Math.PI * 2);
  const innerGlow = ctx.createRadialGradient(
    pillLeft + ry, pillTop + ry * 0.35, 0,
    pillLeft + ry, pillTop + ry * 0.35, pillWidth * 0.6
  );
  innerGlow.addColorStop(0, "rgba(255, 239, 220, 0.04)");
  innerGlow.addColorStop(1, "rgba(255, 239, 220, 0)");
  ctx.fillStyle = innerGlow;
  ctx.fill();
  ctx.restore();

  // --- Иконка: кольцо в цветах GoldRing.draw() (внешнее / блик / внутреннее тонкое) ---
  ctx.beginPath();
  ctx.arc(cx, cy, iconR, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.2, iconR * 0.16);
  ctx.strokeStyle = "rgba(255, 230, 171, 0.98)";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "rgba(255, 236, 198, 0.34)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, iconR * 0.62, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.8, iconR * 0.06);
  ctx.strokeStyle = "rgba(255, 230, 171, 0.82)";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "rgba(245, 182, 112, 0.22)";
  ctx.stroke();

  // --- Двуцветная звезда внутри кольца — цвета Redlet.draw() (золото/красный) ---
  ctx.save();
  ctx.translate(cx, cy);

  const starPath = () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? starOuter : starInner;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  starPath();
  ctx.save();
  ctx.clip();

  // Правая половина — золотая (GoldRing / carryingGoldRing).
ctx.fillStyle = "rgba(255, 230, 171, 0.98)";
ctx.shadowBlur = 12;
ctx.shadowColor = "rgba(255, 218, 126, 0.58)";
ctx.beginPath();
ctx.rect(0, -starOuter * 2, starOuter * 2, starOuter * 4);
ctx.fill();
ctx.shadowBlur = 0;

  // Левая половина — красная (Redlet / carryingRedRing).
  ctx.fillStyle = "rgba(82, 0, 0, 0.25)";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255, 86, 104, 0.58)";
  ctx.beginPath();
  ctx.rect(-starOuter * 2, -starOuter * 2, starOuter * 2, starOuter * 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Общий контур звезды.
  starPath();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "rgba(255, 218, 126, 0.9)";
  ctx.stroke();

  ctx.restore(); // конец translate(cx, cy)

  // --- Число спасённых комбо — стиль .hud-value ---
  ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(245, 241, 231, 0.96)";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "rgba(255, 214, 158, 0.18)";
  ctx.fillText(text, cx + iconR + gapIconText, cy);
  ctx.shadowBlur = 0;

  ctx.restore();
}


  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackgroundDust();

    if (this.motherStar) this.motherStar.draw(this.ctx);
    if (this.homeStar) this.homeStar.draw(this.ctx);

    this.obstacles.forEach((o) => o.draw(this.ctx));

    this.starlets.forEach((s) => s.draw(this.ctx));
    this.redlets.forEach((r) => r.draw(this.ctx));

    this.redRings.forEach((ring) => ring.draw(this.ctx));

    if (this.activeGoldRing) {
      this.activeGoldRing.draw(this.ctx);
    }

    this.particles.forEach((p) => p.draw(this.ctx));
    this.drawRescueHud(this.ctx);

    this.tutor.draw(this.ctx);

    // Прицел курсора — только когда игрок ловит свободное золотое кольцо
    // (нет смысла показывать прицел, если кольца сейчас нет или оно уже
    // прицеплено к редлету).
    const showCursorRing =
      this.isDragging &&
      this.isRunning &&
      !this.gameOver &&
      this.activeGoldRing &&
      this.activeGoldRing.state !== "attachedToRedlet";

    if (showCursorRing) {
      this.ctx.strokeStyle = "rgba(255, 205, 90, 0.65)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.mousePos.x, this.mousePos.y, 28, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(this.mousePos.x, this.mousePos.y, 20, 0, Math.PI * 2);
      this.ctx.lineWidth = 0.8;
      this.ctx.strokeStyle = "rgba(222, 161, 94, 0.6)";
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

    this.heartIconElement?.classList.add("heart-icon--scene9");

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

    this.heartIconElement?.classList.remove("heart-icon--scene9");

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
