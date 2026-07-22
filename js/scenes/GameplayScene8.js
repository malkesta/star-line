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
    this.lastEatTime = 0; // НОВОЕ: антиспам для звука поедания
    this.lastRingGoneTime = 0; // НОВОЕ: антиспам для звука исчезновения кольца

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

  // НОВОЕ: звук поедания старлета активным комбо (чёрная звезда + красное кольцо).
  // Тёмный "всасывающий" глоток: низкая падающая синусоида + короткий красный
  // "блик" сверху, мягкая реверберация. Сделан в одном семействе с остальными.
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

    // Нижний "глоток" — всасывающее падение тона.
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

    // Верхний короткий "красный" блик — лёгкая искра при захвате.
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

  // НОВОЕ: звук исчезновения красного кольца после полного распада.
// Мягкий нисходящий "выдох": тёплый низкий тон + короткий воздушный слой сверху.
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
//  Blacklet — единственная "чёрная звезда" на сцене. Постоянна (не исчезает).
//
//  Состояния: forming → ready → linked
//    forming  — превращается из жёлтой (как старлет) в красную, затем чернеет
//               сердцевину → "чёрная звезда с красной обводкой". Поедать НЕ может.
//    ready    — трансформация завершена, ждёт стыковки с кольцом.
//    linked   — состыкована с красным кольцом → может поедать старлеты (комбо).
//
//  Перетаскивается курсором (как старый старлет). Сквозь препятствия проходит
//  без взаимодействия. В одиночку (без кольца) не ест ничего. Должна визуально
//  выделяться: яркая красная утолщённая обводка + мягкий пульс.
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

    // Чем больше — тем быстрее чёрная звезда догоняет курсор (меньше отстаёт).
    // В комбо держим ТАКОЙ ЖЕ отклик, чтобы связка не тормозила.
    this.lagFactor = 0.2;
    this.linkedLagFactor = 0.2;

    this.phase = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.0115;
    this.wander = 0.26;
    this.wanderY = 0.34;
    this.jitterPhase = Math.random() * Math.PI * 2;
    this.pulsePhase = Math.random() * Math.PI * 2;

    // Прогресс трансформации жёлтый → красный → чёрная сердцевина.
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
    // Заметно крупнее обычного старлета, чтобы выделяться.
    this.radius = baseStarletRadius * 1.33 * 1.5;
    this.innerRadius = this.radius * 0.48;

    // Радиус "захвата" под курсор — щедрый, т.к. это единственный объект игрока.
    this.dragRadius = (sceneMetrics?.starletDragRadius ?? 28) * 1.3;
    this.linkRadius = (sceneMetrics?.starletDragRadius ?? 28) * 1.6;

    // Зона "поедания" старлета активным комбо. Опирается на радиус кольца, если
    // оно прицеплено, иначе на собственный (запасной вариант).
    this.eatRadius = this.radius * 2.2;

    // Свободный дрейф до того, как игрок взял её под курсор (правая часть экрана).
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

  // Может ли комбо поедать старлеты — только когда состыковано с кольцом.
  canAbsorb() {
    return this.state === "linked";
  }

  // Может ли пристыковать кольцо — пока ещё не состыкована.
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
      // Свободный дрейф пока игрок ещё не подхватил чёрную звезду.
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

    // Трансформация: красный проявляется раньше, чернота сердцевины — позже.
    // Докручиваем прогресс не только в "forming", но и в "linked"/"ready", если
    // кольцо пристыковалось ещё на середине формирования — иначе чёрная звезда
    // навсегда останется недочернённой.
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

      // В "ready" переводим только из "forming"; если звезда уже "linked"
      // (кольцо пристыковалось рано) — не сбрасываем состояние.
      if (this.transformProgress >= 1 && this.state === "forming") {
        this.state = "ready";
      }
    }

    this.rotation += this.rotationSpeed;
    this.jitterPhase += delta * 8.5;
    this.pulsePhase += delta * 3.0;
  }

  // Точка отсчёта зоны поедания (центр комбо).
  getEatRadius() {
    if (this.isLinked && this.linkedRing) {
      return this.linkedRing.collisionRadius + this.radius * 0.4;
    }
    return this.eatRadius;
  }

  // Поедает ли комбо данный старлет (только в состоянии linked).
  eats(starlet) {
    if (!this.canAbsorb() || !starlet) return false;
    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.getEatRadius() + starlet.radius;
  }

  draw(ctx) {
    // Дрожание сильнее в начале формирования, к концу — почти исчезает.
    const jitterStrength =
      this.state === "forming"
        ? 0.55 + (1 - this.transformProgress) * 0.8
        : 0.14;

    const jitterX = Math.sin(this.jitterPhase) * jitterStrength;
    const jitterY = Math.cos(this.jitterPhase * 0.87) * jitterStrength;

    // Лёгкий пульс готовой/состыкованной звезды, чтобы выделялась.
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
    const red = { r: 224, g: 58, b: 74 };       // ярче для выделения
    const deepRed = { r: 126, g: 60, b: 72 };
    const brightEdge = { r: 255, g: 86, b: 104 }; // яркая красная обводка

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

    // Внешнее свечение.
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, glowRadius);
    glow.addColorStop(0, toRgb(edgeColor, 0.22 * glowBoost));
    glow.addColorStop(0.45, toRgb(shadowColor, 0.13 * glowBoost));
    glow.addColorStop(1, toRgb(deepRed, 0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Тело звезды.
    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.shadowBlur = 20 * glowBoost;
    ctx.shadowColor = toRgb(edgeColor, 0.58);
    ctx.fillStyle = toRgb(coreFill, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Яркая утолщённая красная обводка (становится толще по мере покраснения).
    drawStarPath(ctx, 0, 0, drawRadius, drawInner, 5);
    ctx.lineWidth =
      this.state === "forming" ? 1.1 + this.redness * 1.4 : 2.4;
    ctx.strokeStyle = toRgb(edgeColor, 0.98);
    ctx.stroke();

    // Внутренний блик.
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

    this.homingSpeed = 5.2;
    this.carryingSpeed = 5.0;
    this.steer = 0.075;
    this.wander = 0.16;

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

    this.radius = baseStarletRadius * 2.92;
    this.innerRadius = this.radius * 0.48;
    this.catchRadius = this.radius * 1.9;
    this.eatRadius = this.radius * 2.4;

    this.spawnInsetX = width * 0.06;
    this.spawnInsetY = height * 0.08;

    this.minX = width * 0.04;
    this.maxX = width * 0.96;
    this.minY = height * 0.06;
    this.maxY = height * 0.94;

    this.offscreenOffset = offscreenOffset * 1.3;
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

  update(delta = 0.016, redRing = null, starlets = []) {
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

      const desiredVx = (dx / dist) * speed;
      const desiredVy = (dy / dist) * speed;

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
//  RedRing — мягко пульсирующее красное кольцо.
//
//  Жизненный цикл: idle → attached → decaying → gone → respawned
//    idle      — свободно плавает и пульсирует, БЕЗ таймера; отталкивает
//                препятствия (как домашняя звезда).
//    attached  — состыковано с чёрной звездой: центрируется на ней.
//    decaying  — после стыковки распадается ровно 6 секунд, теряя материальность
//                с каждым пульсом (alpha падает).
//    gone      — полностью растворилось.
//    respawned — спустя короткую задержку рождается новое кольцо (idle).
//
//  Комбо (чёрная звезда + кольцо) отталкивает препятствия как домашняя звезда,
//  БЕЗ изменения счёта.
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

  finishDecay() {
  this.alpha = 0;
  this.isAttached = false;
  if (this.anchorBlacklet) {
    this.anchorBlacklet.clearLinked();
  }

  this.anchorBlacklet = null;
  this.state = "gone";
  this.spawnDelay = this.respawnDelay;
  this.onGone?.();
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

this.baseRadius = sceneMetrics.homeRadius;
this.baseRingRadius = sceneMetrics.homeRingRadius;
this.baseGlowRadius = sceneMetrics.homeGlowRadius;

this.radius = 0;
this.ringRadius = 0;
this.glowRadius = 0;

this.flicker = Math.random() * Math.PI * 2;
this.rotation = Math.random() * Math.PI * 2;
this.phase = Math.random() * Math.PI * 2;

this.active = false;

// Стадии полностью отвязаны от движения.
this.state = "growing"; // growing -> open -> shrinking
this.scaleProgress = 0;
this.openTimer = 0;
this.spawnPulseReady = false;

this.growDuration = 1.1;
this.openDuration = 2.4;
this.shrinkDuration = 0.9;
this.minRenderableScale = 0.02;

// Постоянный wandering внутри допустимой зоны.
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

this.baseRadius = sceneMetrics.homeRadius;
this.baseRingRadius = sceneMetrics.homeRingRadius;
this.baseGlowRadius = sceneMetrics.homeGlowRadius;

const { width, height } = sceneMetrics;

// Рабочая зона — внутри экрана, ближе к центру/правой половине.
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
this.spawnPulseReady = false;

// Первый запуск — сразу внутри рабочей зоны.
if (this.x === 0 && this.y === 0) {
this.x =
this.driftMinX + (this.driftMaxX - this.driftMinX) * (0.18 + Math.random() * 0.2);
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

// Начинаем новый цикл стадий, но позицию не сбрасываем.
this.state = "growing";
this.openTimer = 0;
this.spawnPulseReady = false;
}
}
}

draw(ctx) {
if (!this.active) return;
if (this.radius <= this.baseRadius * this.minRenderableScale) return;

const glowPulse = 0.92 + Math.sin(this.flicker) * 0.05;

const outerGlow = ctx.createRadialGradient(
this.x, this.y, 10,
this.x, this.y, this.glowRadius
);
outerGlow.addColorStop(0, `rgba(245, 182, 112, ${0.28 * glowPulse})`);
outerGlow.addColorStop(0.5, `rgba(222, 161, 94, ${0.16 * glowPulse})`);
outerGlow.addColorStop(1, `rgba(222, 161, 94, 0)`);

ctx.fillStyle = outerGlow;
ctx.beginPath();
ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(this.x, this.y, this.ringRadius, 0, Math.PI * 2);
ctx.lineWidth = 1.25;
ctx.strokeStyle = `rgba(245, 182, 112, 0.92)`;
ctx.stroke();

ctx.beginPath();
ctx.arc(this.x, this.y, Math.max(0, this.ringRadius - 6), 0, Math.PI * 2);
ctx.lineWidth = 0.85;
ctx.strokeStyle = `rgba(222, 161, 94, 0.70)`;
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

    // Скорость собственного дрейфа по экрану.
    this.driftSpeed = 0.55 + Math.random() * 0.35;
    this.steer = 0.035;

    // Зона свободного блуждания старлетов.
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

    // Лёгкая стартовая скорость в сторону экрана.
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

    // Мягкое блуждание, чтобы траектория не была идеально прямой.
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

    // НОВОЕ (опционально): притяжение к точке — для анимации всасывания.
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

    // Красная палитра
    this.color = "#ff6e7e";
    this.glowColor = "rgba(255, 110, 126, 0.45)";

    this.mode = "none";
    // waiting → markBlack → toRing → markRing → toStar → markStar → toStar2 → fading → restart
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

  // Игрок реально съел первый старлет комбо — подсказка больше не нужна
  notifySuccess() {
    this.disable();
  }

  // --- Ограничение зоны тутора правой половиной экрана ---

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

    // Отключаемся после первого реального поедания старлета
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

  // Если ключевые цели исчезли или ушли из зоны — плавно гаснем
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
    // Нужны: чёрная звезда, кольцо и минимум 2 старлета в правой половине экрана
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

    // 1) Отметить чёрную звезду
    if (this.phase === "markBlack") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toRing";
      return;
    }

    // 2) Вести от чёрной звезды к красному кольцу
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

    // 3) Отметить кольцо
    if (this.phase === "markRing") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toStar";
      return;
    }

    // 4) Вести комбо к первому старлету (он гарантированно справа)
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

    // 5) Отметить первый старлет
    if (this.phase === "markStar") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) this.phase = "toStar2";
      return;
    }

    // 6) Вести ко второму старлету, затем гаснем
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

      // Маркеры на blacklet и red ring живут всегда,
      // на starlets — пока starlet существует (и тутор ещё не погас)
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

    // Чёрная звезда → кольцо (в фазе toRing курсор ещё не на кольце)
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

    // Кольцо → первый старлет
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

    // Первый → второй старлет
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

// ============================================================================
//  GameplayScene7 — главный класс сцены (перевёрнутый режим).
// ============================================================================
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

// Main.js пока может передавать старый audio без playEatSound.
// Поэтому для еды используем либо общий audio, либо локальный GameAudio fallback.
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

    // Стартовый экран и чекбокс туториала. Имена id — по модели StarLineGame.
    // Если в проекте они называются иначе — поправить здесь одну-две строки.
    this.startScreen = document.getElementById("startScreen");
    this.tutorialEnabledInput = document.getElementById("tutorialEnabled");
    this.instructionsElement = document.querySelector(".instructions");
    this.defaultInstructionsText =
    this.instructionsElement?.textContent?.trim() ||
    "Соедини черную звезду и красное кольцо -> Поглощай мелкие звездочки. Помни: кольцо надо обновлять!";


    this.levelTargetScore = 400;
    this.levelPassed = false;
    this.displayedHeartProgress = 0;
    this.targetHeartProgress = 0;
    this.heartPulseTimeout = null;
    this.motherStar = null


    this.blacklet = null;       // одна чёрная звезда игрока
    this.redlets = [];
    this.redletSpawnTimer = 0;
    this.redletSpawnInterval = 7.5;
    this.redletTrailTimer = 0;
    this.redRing = null;
    this.prevRedRingState = null;        // одно красное кольцо
    this.starlets = [];         // свободные старлеты (FreeStarlet)
    this.obstacles = [];
    this.particles = [];

    this.score = 0;
    this.savedCount = 0;        // сколько старлетов съедено комбо (для HUD "спасено")
    this.lostCount = 0;         // потеряно (препятствие/долетел до дома)
    this.eatenCount = 0;        // реальные поедания комбо — триггер выключения туториала

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

    // --- Спавн-директор: машина состояний появления объектов ---
    // intro_blacklet → intro_ring → intro_starlets_home → gameplay_live
    this.spawnPhase = "intro_blacklet";
    this.spawnTimer = 0;
    this.starletsSpawned = false;

    // Туториал (красная подсказка).
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

    // Инициализация объектов перевёрнутого режима.
    this.initSceneObjects();

    this.updateTargetScoreUI();
    this.updateUI();
    this.draw();
  }

  // Создаёт стартовый набор объектов согласно спавн-директору (начальная фаза).
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

    // Спавн-директор стартует с появления чёрной звезды.
    this.spawnPhase = "intro_blacklet";
    this.spawnTimer = 0;
    this.starletsSpawned = false;

    // Кольцо появится «в середине трансформации» — пока придержим его за кадром.
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

  // Включён ли туториал на этот запуск (читаем чекбокс стартового экрана).
  readTutorialEnabled() {
    if (this.tutorialEnabledInput) {
      return !!this.tutorialEnabledInput.checked;
    }
    return true;
  }
  getSceneInstructionsText() {
  if (this.sceneId === "game7" || this.sceneId === "game8") {
    return "Соедини черную звезду и красное кольцо -> Поглощай мелкие звездочки. Помни: кольцо надо обновлять!";
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

    // Туториал стартует с учётом чекбокса.
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

    // Пересоздаём объекты перевёрнутого режима и спавн-директор.
    this.initSceneObjects();

    // Туториал НЕ показываем при «Играть снова» (перезапуск уровня) —
    // он играет только при первом входе в сцену (в start()).
    this.tutorialEnabledForRun = false;
    this.tutor.reset({ enabled: false });

    this.updateUI();
    this.draw();

    // Музыку НЕ перезапускаем при рестарте — она продолжает играть непрерывно.
    // Только поднимаем громкость обратно (если она была приглушена оверлеем).
    if (restartAmbient) {
      this.audio.startAmbient({ restart: false });
    }

    this.startGameLoop();
  };

  // --- Спавн свободных старлетов с трёх краёв (верх / низ / право) ---
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

    if (this.redRing.anchorBlacklet) {
      this.redRing.anchorBlacklet.clearLinked?.();
    }

    this.redRing.anchorBlacklet = null;
    this.redRing.isAttached = false;
    this.redRing.alpha = 0;
    this.redRing.hidden = false;
    this.redRing.decayProgress = 1;
    this.redRing.state = "gone";
    this.redRing.spawnDelay = this.redRing.respawnDelay ?? 0.15;

    this.redRing.onGone?.();
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

  // Красный «хвост» от чёрной звезды под курсором (мелкий).
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

  // Более крупный красный хвост от кольца, когда комбо активно.
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
  const interval = 0.05;

  while (this.redletTrailTimer >= interval) {
    this.redletTrailTimer -= interval;

    for (const redlet of this.redlets) {
      if (!redlet?.hasCapturedRing || redlet.markedForRemoval) continue;

      const angle = Math.random() * Math.PI * 2;
      const r = redlet.radius * (0.2 + Math.random() * 0.55);
      const px = redlet.x + Math.cos(angle) * r;
      const py = redlet.y + Math.sin(angle) * r;

      this.particles.push(
        new Particle(px, py, "rgba(8, 14, 24, 0.92)", false, {
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          life: 0.44 + Math.random() * 0.16,
          decay: 0.03 + Math.random() * 0.015,
          size: 1.4 + Math.random() * 1.8,
          shrink: 0.018,
          alphaBoost: 0.9,
        })
      );

      if (Math.random() < 0.45) {
        this.particles.push(
          new Particle(px, py, "rgba(126, 60, 72, 0.32)", false, {
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            life: 0.28 + Math.random() * 0.14,
            decay: 0.035 + Math.random() * 0.015,
            size: 0.8 + Math.random() * 1.2,
            shrink: 0.016,
            alphaBoost: 0.75,
          })
        );
      }
    }
  }
}

  // Анимация всасывания/вспышки, когда комбо съедает старлет.
  emitEatBurst(x, y) {
  const center = { x: this.blacklet.x, y: this.blacklet.y };

  // Мягкий золотистый ореол вокруг точки поедания — без направленного выстрела.
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

  // Небольшой внутренний тёплый пшик — тоже вокруг точки поедания.
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

  // Короткая красная вспышка захвата — у самого центра комбо.
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

  // --- Спавн-директор: продвигает фазы появления объектов ---
  updateSpawnDirector(delta) {
  this.spawnTimer += delta;

  if (this.spawnPhase === "intro_blacklet") {
    // Чёрная звезда уже на сцене и формируется. Как только начнётся
    // покраснение — выпускаем кольцо.
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
    // Кольцо уже в игре, даём ему немного подрейфовать.
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

    // После короткой паузы включаем полноценный gameplay.
    if (this.spawnTimer >= 0.8) {
      this.spawnPhase = "gameplay_live";
      this.spawnTimer = 0;
      this.obstacleTimer = 0;
    }
    return;
  }

  // gameplay_live — дальше директор уже ничего не спавнит.
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

    // Продвигаем спавн-директор.
    this.updateSpawnDirector(delta);

    const liveGameplay = this.spawnPhase === "gameplay_live";

    // --- Чёрная звезда (игрок) ---
    if (this.blacklet) {
      this.blacklet.update(this.mousePos, this.isDragging, delta);
    }

    // --- Красное кольцо (стыковка/распад/респавн) ---
    if (this.redRing) {
      this.redRing.update(delta, this.blacklet);
    }

    //this.checkRedRingAudioState();

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
  this.redlets.forEach((redlet) => redlet.update(delta, this.redRing, this.starlets))
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

    
    // --- Препятствия (только в боевой фазе) ---
    if (liveGameplay) {
      this.obstacles.forEach((o) => {
        o.update();

        if (this.motherStar && this.motherStar.blocksObstacle(o)) this.motherStar.repelObstacle(o)

        if (this.redRing && this.redRing.blocksObstacle(o)) {
          this.redRing.repelObstacle(o);
        }
        // Чёрная звезда сквозь препятствия проходит — намеренно НЕ трогаем.
      });
    }

    // --- Частицы ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());
    this.redlets = this.redlets.filter((r) => r && !r.markedForRemoval);

    // --- Коллизии ---
    this.checkComboEats();

    if (liveGameplay) {
      this.checkRedletRingCapture();
      this.checkRedletStarletEats();
      this.checkObstacleCollisions();
    }
    
    // --- Спавн препятствий и нарастание сложности (боевая фаза) ---
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

    // --- Туториал ---
    //this.tutor.update(delta, this);

    this.updateHeartProgress(delta);
    this.updateUI();
  }

  // Активное комбо (чёрная звезда + кольцо) поедает старлеты → +5.
  // Активное комбо (чёрная звезда + кольцо) поедает старлеты → +5.
checkComboEats() {
  const b = this.blacklet;
  if (!b || !b.canAbsorb()) return;

  for (let i = this.starlets.length - 1; i >= 0; i--) {
    const starlet = this.starlets[i];
    if (b.eats(starlet)) {
      this.score += 5;
      this.savedCount += 1;
      this.eatenCount += 1; // триггер выключения туториала
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

// Препятствие уничтожает старлет → −5.
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

    // Свободные старлеты.
    this.starlets.forEach((s) => s.draw(this.ctx));
    this.redlets.forEach((r) => r.draw(this.ctx));

    // Красное кольцо под чёрной звездой (чтобы звезда читалась поверх).
    if (this.redRing) {
      this.redRing.draw(this.ctx);
    }

    // Чёрная звезда игрока.
    if (this.blacklet) {
      this.blacklet.draw(this.ctx);
    }

    // Частицы.
    this.particles.forEach((p) => p.draw(this.ctx));

    // Обучающая подсказка — поверх всего.
    //if (this.tutor) {
    //  this.tutor.draw(this.ctx);
    //}

    // Кольцо-курсор (как в исходной сцене).
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

    // Красное сердце цели — спец-класс сцены (используется только в 7 и 8).
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

    // Свежий набор объектов на вход в сцену.
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

    // Снимаем спец-класс красного сердца.
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
