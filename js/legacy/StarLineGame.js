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
  }

  setMusic(url) {
    if (!url) return;
    if (this.musicUrl === url) return;

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
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
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

    const clampedTarget = Math.max(
      0,
      Math.min(this.musicDefaultVolume, targetVolume)
    );

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

        this.music.volume =
          startVolume + (clampedTarget - startVolume) * eased;

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
      osc.frequency.exponentialRampToValueAtTime(
        freq * 0.96,
        now + 0.24 + i * 0.015
      );

      gain.gain.setValueAtTime(0.0001, now + i * 0.015);
      gain.gain.linearRampToValueAtTime(0.04 - i * 0.01, now + 0.02 + i * 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.35 + i * 0.015
      );

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

  playEatSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastEatTime < 0.045) return;
    this.lastEatTime = now;

    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(this.master);

    const glassVerb = this.createReverb(1.1, 2.9);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.12;
    glassVerb.connect(wet);
    wet.connect(this.master);

    const band = this.ctx.createBiquadFilter();
    band.type = "highpass";
    band.frequency.value = 1400;
    band.connect(masterGain);
    band.connect(glassVerb);

    const partials = [
      { freq: 1480, time: 0.000, gain: 0.030, q: 10 },
      { freq: 1960, time: 0.006, gain: 0.026, q: 12 },
      { freq: 2430, time: 0.012, gain: 0.022, q: 14 },
      { freq: 3180, time: 0.018, gain: 0.018, q: 16 },
      { freq: 4020, time: 0.024, gain: 0.014, q: 18 },
    ];

    partials.forEach(({ freq, time, gain, q }, index) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const notch = this.ctx.createBiquadFilter();

      osc.type = index % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(420, freq * 0.72),
        now + time + 0.085
      );

      notch.type = "bandpass";
      notch.frequency.value = freq;
      notch.Q.value = q;

      oscGain.gain.setValueAtTime(0.0001, now + time);
      oscGain.gain.linearRampToValueAtTime(gain, now + time + 0.003);
      oscGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + time + 0.095
      );

      osc.connect(notch);
      notch.connect(oscGain);
      oscGain.connect(band);

      osc.start(now + time);
      osc.stop(now + time + 0.11);
    });

    const click = this.ctx.createBufferSource();
    const clickBuffer = this.ctx.createBuffer(
      1,
      Math.floor(this.ctx.sampleRate * 0.028),
      this.ctx.sampleRate
    );
    const data = clickBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - t, 5) *
        (0.65 + Math.random() * 0.35);
    }

    click.buffer = clickBuffer;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = "highpass";
    clickFilter.frequency.value = 2600;

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.018, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(masterGain);
    clickGain.connect(glassVerb);

    click.start(now);
  }

  playRingGoneSound() {
    if (!this.ctx) return;
    const now = this.now();
    if (now - this.lastRingGoneTime < 0.12) return;
    this.lastRingGoneTime = now;

    const reverb = this.createReverb(2.2, 2.7);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.2;
    reverb.connect(wet);
    wet.connect(this.master);

    const tone = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    const toneFilter = this.ctx.createBiquadFilter();

    tone.type = "sine";
    tone.frequency.setValueAtTime(620, now);
    tone.frequency.exponentialRampToValueAtTime(210, now + 0.42);

    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 1200;

    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.linearRampToValueAtTime(0.028, now + 0.018);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    tone.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneGain.connect(this.master);
    toneGain.connect(reverb);

    const air = this.ctx.createOscillator();
    const airGain = this.ctx.createGain();
    const airFilter = this.ctx.createBiquadFilter();

    air.type = "triangle";
    air.frequency.setValueAtTime(1180, now);
    air.frequency.exponentialRampToValueAtTime(480, now + 0.24);

    airFilter.type = "bandpass";
    airFilter.frequency.value = 900;
    airFilter.Q.value = 1.4;

    airGain.gain.setValueAtTime(0.0001, now);
    airGain.gain.linearRampToValueAtTime(0.016, now + 0.012);
    airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.master);

    tone.start(now);
    air.start(now);

    tone.stop(now + 0.55);
    air.stop(now + 0.28);
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
      gain.gain.linearRampToValueAtTime(
        0.035 - i * 0.007,
        now + 0.04 + i * 0.05
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 1.1 + i * 0.08
      );

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
    
class Starlet {
  constructor(x, y, entrySide = "right", sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.entrySide = entrySide;

    if (entrySide === "right") {
      this.vx = -0.42 - Math.random() * 0.24;
      this.vy = (Math.random() - 0.5) * 0.20;
    } else if (entrySide === "top") {
      this.vx = -0.26 - Math.random() * 0.22;
      this.vy = 0.22 + Math.random() * 0.14;
    } else {
      this.vx = -0.26 - Math.random() * 0.22;
      this.vy = -0.22 - Math.random() * 0.14;
    }

    this.following = false;
    this.lagFactor = 0.082;
    this.dragRadius = 28;
    this.trailTimer = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.wander = Math.random() * 0.22 + 0.08;
    this.wanderY = this.wander * 0.28;
    this.rotation = Math.random() * Math.PI * 2;

    const sizes = [0.66, 1, 1.33];
    this.sizeFactor = sizes[Math.floor(Math.random() * sizes.length)];
    this.radius = (sceneMetrics?.starletBaseRadius ?? 8) * this.sizeFactor;

    const colors = ["#f5b670", "#DEA15E", "#FFF0B8"];
    this.outerColor = colors[Math.floor(Math.random() * colors.length)];
    this.highlightColor =
      this.outerColor === "#FFF0B8" ? "#FFF7D6" : "#FFF0D0";
  }

  update(mousePos, isDragging, swarmCenter = null) {
    let justCaught = false;

    if (isDragging && !this.following) {
      const dx = this.x - mousePos.x;
      const dy = this.y - mousePos.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.dragRadius) {
        this.following = true;
        justCaught = true;
      }
    }

    if (this.following) {
      this.targetX = mousePos.x;
      this.targetY = mousePos.y;
      this.x += (this.targetX - this.x) * this.lagFactor;
      this.y += (this.targetY - this.y) * this.lagFactor;
    } else {
      this.x += this.vx;
      this.y += this.vy;

      const t = performance.now();

      this.x += Math.sin(t * 0.0012 + this.phase) * this.wander;
      this.y += Math.cos(t * 0.0011 + this.phase) * this.wanderY;

      if (swarmCenter) {
        this.x += (swarmCenter.x - this.x) * 0.0012;
        this.y += (swarmCenter.y - this.y) * 0.0008;
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
  }

  update() {
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
      ctx.strokeStyle = 'rgba(53, 97, 132, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
} 

    class HomeStar {
  constructor(sceneMetrics) {
    this.flicker = Math.random() * Math.PI * 2;
    this.rotation = 0;
    this.orbitPhase = Math.random() * Math.PI * 2;

    this.setBounds(sceneMetrics);
    this.x = this.baseX;
    this.y = this.baseY;
  }

  setBounds(sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.baseX = sceneMetrics.homeBaseX;
    this.baseY = sceneMetrics.homeBaseY;

    this.radius = sceneMetrics.homeRadius;
    this.ringRadius = sceneMetrics.homeRingRadius;
    this.glowRadius = sceneMetrics.homeGlowRadius;

    this.orbitX = sceneMetrics.homeOrbitX;
    this.orbitY = sceneMetrics.homeOrbitY;
  }

  update() {
    this.flicker += 0.035;
    this.rotation += 0.006;
    this.orbitPhase += 0.004;

    this.x = this.baseX + Math.cos(this.orbitPhase) * this.orbitX;
    this.y = this.baseY + Math.sin(this.orbitPhase * 0.9) * this.orbitY;
  }

  draw(ctx) {
    this.update();

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

    drawStarPath(ctx, this.x - 4, this.y - 6, this.radius * 0.35, this.radius * 0.15, 5);
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fill();

    ctx.restore();
  }

  isHit(starlet) {
    const dx = starlet.x - this.x;
    const dy = starlet.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + starlet.radius;
  }

  blocksObstacle(obstacle) {
    const dx = obstacle.x - this.x;
    const dy = obstacle.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.ringRadius + obstacle.ringRadius;
  }

  repelObstacle(obstacle) {
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

        class TutorGuide {
  constructor() {
    this.enabled = true;
    this.active = false;
    this.completed = false;

    this.x = 0;
    this.y = 0;
    this.speed = 240;

    this.color = "#7dc8ff";
    this.glowColor = "rgba(125, 200, 255, 0.42)";

    this.mode = "none";
    this.phase = "waiting";

    this.firstStar = null;
    this.secondStar = null;
    this.homeTarget = null;

    this.pathOpacity = 1;
    this.rings = [];

    this.fadeDelay = 0.5;
    this.fadeDuration = 0.8;
    this.fadeTimer = 0;

    this.holdTimer = 0;
    this.markHoldDuration = 0.22;
    this.arrivalThreshold = 8;

    this.restartDelay = 0.35;
    this.restartTimer = 0;

    // Новое: задержка перед самым первым запуском подсказки
    this.startDelay = 2.0;   // секунды после старта игры
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

    this.firstStar = null;
    this.secondStar = null;
    this.homeTarget = null;

    this.pathOpacity = 1;
    this.rings = [];

    this.fadeTimer = 0;
    this.holdTimer = 0;
    this.restartTimer = 0;

    // сбрасываем стартовый таймер
    this.startTimer = 0;
  }

  disable() {
    this.completed = true;
    this.active = false;
    this.mode = "none";
    this.phase = "done";
    this.pathOpacity = 0;
    this.rings = [];
    this.firstStar = null;
    this.secondStar = null;
    this.homeTarget = null;
    this.fadeTimer = 0;
    this.holdTimer = 0;
    this.restartTimer = 0;
    this.startTimer = 0;
  }

  notifyPlayerAction() {
    // Игрок двигает мышь/палец — тутор не выключаем.
    // По новому ТЗ он должен продолжать работать независимо.
  }

  notifySuccess() {
    // Как только игрок сам довёл звезду до цели — тутор отключается полностью.
    this.disable();
  }

  update(delta, game) {
    if (!this.enabled || this.completed || !game.isRunning || game.gameOver) {
      return;
    }

    this.updateRings(delta, game);

    if (game.savedCount > 0) {
      this.disable();
      return;
    }

    if (!this.homeTarget) {
      this.homeTarget = game.homeStar;
    }

    if (!this.active) {
      if (this.phase === "waiting") {
        // Копим время от старта, ждём 1 секунду
        this.startTimer += delta;
        if (this.startTimer < this.startDelay) {
          return;
        }

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

    this.handleStarDestruction(game);

    if (!this.active) {
      if (this.phase === "fading") {
        this.updateFade(delta);
      }
      return;
    }

    if (this.mode === "full") {
      this.updateFullMode(delta, game);
    }
  }

  handleStarDestruction(game) {
    const starlets = game.starlets;

    if (this.mode !== "full") return;

    const firstAlive = this.firstStar && starlets.includes(this.firstStar);
    const secondAlive = this.secondStar && starlets.includes(this.secondStar);

    if (!firstAlive || !secondAlive) {
      this.startFadeOut();
    }
  }

  beginFullHint(game) {
    if (!game.homeStar || !game.starlets || game.starlets.length < 2) {
      this.phase = "waiting";
      return false;
    }

    const candidates = game.starlets.filter((s) => !s.following);
    const pool = candidates.length >= 2 ? candidates.slice() : game.starlets.slice();

    if (pool.length < 2) {
      this.phase = "waiting";
      return false;
    }

    const firstIndex = Math.floor(Math.random() * pool.length);
    this.firstStar = pool.splice(firstIndex, 1)[0];
    const secondIndex = Math.floor(Math.random() * pool.length);
    this.secondStar = pool[secondIndex];

    this.homeTarget = game.homeStar;

    this.mode = "full";
    this.phase = "markFirst";

    this.x = this.firstStar.x + 30;
    this.y = this.firstStar.y - 18;

    this.pathOpacity = 1;
    this.rings = [];
    this.addRing(this.firstStar);

    this.holdTimer = this.markHoldDuration;
    this.active = true;

    // как только один цикл подсказки стартовал — обнуляем стартовый таймер
    this.startTimer = 0;

    return true;
  }

  updateFullMode(delta, game) {
    const starlets = game.starlets;

    if (!this.firstStar || !starlets.includes(this.firstStar)) {
      this.startFadeOut();
      return;
    }

    if (!this.secondStar || !starlets.includes(this.secondStar)) {
      this.startFadeOut();
      return;
    }

    this.homeTarget = game.homeStar;

    if (this.phase === "markFirst") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) {
        this.phase = "toSecond";
      }
      return;
    }

    if (this.phase === "toSecond") {
      const arrived = this.moveTowards(this.secondStar.x, this.secondStar.y, delta);
      if (arrived) {
        this.addRing(this.secondStar);
        this.phase = "markSecond";
        this.holdTimer = this.markHoldDuration;
      }
      return;
    }

    if (this.phase === "markSecond") {
      this.holdTimer -= delta;
      if (this.holdTimer <= 0) {
        this.phase = "toHome";
      }
      return;
    }

    if (this.phase === "toHome") {
      const arrivedHome = this.moveTowards(this.homeTarget.x, this.homeTarget.y, delta);
      if (arrivedHome) {
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

    const fadeT = Math.min(1, (this.fadeTimer - this.fadeDelay) / this.fadeDuration);
    this.pathOpacity = 1 - fadeT;

    if (fadeT >= 1) {
      this.rings = [];
      this.firstStar = null;
      this.secondStar = null;
      this.homeTarget = null;
      this.pathOpacity = 1;
      this.phase = "restart";
      this.restartTimer = this.restartDelay;
    }
  }

  addRing(star) {
    const exists = this.rings.some((ring) => ring.star === star);
    if (exists) return;

    this.rings.push({
      star,
      radius: 18,
      pulse: Math.random() * Math.PI * 2
    });
  }

  updateRings(delta, game) {
    const starlets = game.starlets;

    this.rings = this.rings.filter((ring) => {
      if (!ring.star) return false;
      if (this.phase === "fading" || this.phase === "done") return true;
      return starlets.includes(ring.star);
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
    if (!this.firstStar || !this.secondStar) return;

    ctx.save();
    ctx.globalAlpha = this.pathOpacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(133, 190, 255, 0.8)";

    if (this.phase === "toSecond") {
      ctx.beginPath();
      ctx.moveTo(this.firstStar.x, this.firstStar.y);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (
      this.phase === "markSecond" ||
      this.phase === "toHome" ||
      this.phase === "fading"
    ) {
      ctx.beginPath();
      ctx.moveTo(this.firstStar.x, this.firstStar.y);
      ctx.lineTo(this.secondStar.x, this.secondStar.y);
      ctx.stroke();
    }

    if (
      (this.phase === "toHome" || this.phase === "fading") &&
      this.secondStar &&
      this.homeTarget
    ) {
      const endX = this.phase === "fading" ? this.homeTarget.x : this.x;
      const endY = this.phase === "fading" ? this.homeTarget.y : this.y;

      ctx.beginPath();
      ctx.moveTo(this.secondStar.x, this.secondStar.y);
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
      const star = ring.star;
      if (!star) continue;

      const pulse = 1 + Math.sin(ring.pulse) * 0.08;
      const radius = ring.radius * pulse;

      ctx.beginPath();
      ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(117, 190, 255, 0.85)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(star.x, star.y, radius + 4, 0, Math.PI * 2);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(117, 190, 255, 0.35)";
      ctx.stroke();
    }

    ctx.restore();
  }

  drawGuideRing(ctx) {
    if (this.phase === "waiting" || this.phase === "restart" || this.phase === "done") {
      return;
    }

    if (this.phase === "markFirst") {
      this.x = this.firstStar.x + 30;
      this.y = this.firstStar.y - 18;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.pathOpacity);
    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 16;
    ctx.shadowColor = this.glowColor;

    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "rgba(125, 200, 255, 0.95)";
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(220, 242, 255, 0.8)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-2, -2, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fill();

    ctx.restore();
  }

  draw(ctx) {
    const hasVisuals =
      this.active ||
      this.phase === "fading" ||
      this.rings.length > 0 ||
      this.pathOpacity > 0;

    if (!hasVisuals || this.completed || !this.enabled) return;

    this.drawPathTrail(ctx);
    this.drawRings(ctx);
    this.drawGuideRing(ctx);
  }
}

      export class StarLineGame {
  constructor({
    sceneId = "game1",
    sceneManager = null,
    audio = null,
    onNext = null,
    onRoundFinished = null,
  } = {}) {
    this.sceneId = sceneId;
    this.sceneManager = sceneManager;
    this.audio = audio ?? new GameAudio();
    this.onNext = onNext;
    this.onRoundFinished = onRoundFinished;

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

    this.tutorialEnabledInput = document.getElementById("tutorialEnabled");
    this.rotateHint = document.getElementById("rotateHint");

    this.levelTargetScore = 400;
    this.levelPassed = false;
    this.displayedHeartProgress = 0;
    this.targetHeartProgress = 0;
    this.heartPulseTimeout = null;

    this.tutor = new TutorGuide();
    this.hasPlayerInteracted = false;
    this.tutorialEnabledForRun = true;

    this.homeStar = null;
    this.starlets = [];
    this.obstacles = [];
    this.particles = [];

    this.score = 0;
    this.savedCount = 0;
    this.lostCount = 0;

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

    this.homeStar = new HomeStar(this.sceneMetrics);
    this.spawnStarlets(10);

    this.updateTargetScoreUI();
    this.updateUI();
    this.draw();
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

      homeBaseX: width * 0.18,
      homeBaseY: height * 0.5,

      homeOrbitX: width * 0.016,
      homeOrbitY: height * 0.045,

      starletBaseRadius: clamp(6.6, 7.0 * playScale, 8.9),
      starletDragRadius: clamp(24, 28 * playScale, 34),

      homeRadius: clamp(30, 34 * playScale, 42),
      homeRingRadius: clamp(52, 60 * playScale, 74),
      homeGlowRadius: clamp(116, 140 * playScale, 170),

      obstacleMinWidth: clamp(37, 44 * playScale, 56),
      obstacleMaxWidth: clamp(74, 88 * playScale, 104),
      obstacleMinHeight: clamp(60, 70 * playScale, 84),
      obstacleMaxHeight: clamp(104, 123 * playScale, 144),

      obstacleCullOffset: width * 0.16,
    };
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.computeSceneMetrics();

    if (this.homeStar) {
      this.homeStar.setBounds(this.sceneMetrics);
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

  async start() {
    console.log("START STATE", {
      isRunning: this.isRunning,
      gameOver: this.gameOver,
      isTransitioning: this.isTransitioning,
      startScreenShown: this.startScreen?.classList.contains("show"),
    });

    if (this.isTransitioning) return;
    if (this.isRunning && !this.gameOver) return;

    try {
      await this.audio.init();
      this.audio.startAmbient();
      console.log("audio init ok");
    } catch (e) {
      console.warn("Audio init skipped", e);
    }

    this.tutorialEnabledForRun = this.tutorialEnabledInput
      ? this.tutorialEnabledInput.checked
      : true;
    console.log("tutorial set", this.tutorialEnabledForRun);

    this.tutor.reset({ enabled: this.tutorialEnabledForRun });
    console.log("tutor reset");

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
      console.log("startScreen hidden");
    }

    if (this.rotateHint) {
      this.rotateHint.classList.toggle("show", !this.isLandscape());
      console.log("rotate hint updated");
    }

    this.isRunning = true;
    this.gameOver = false;
    this.lastTime = performance.now();
    console.log("before game loop");

    this.startGameLoop();
    console.log("game loop started");
  }

  createSpawnPoint() {
    const {
      width,
      height,
      offscreenOffset,
      homeBaseX,
      homeRingRadius,
      laneInsetX,
    } = this.sceneMetrics;

    const spawnSides = ["top", "bottom", "right"];
    const side = spawnSides[Math.floor(Math.random() * spawnSides.length)];

    const depth = offscreenOffset * (0.18 + Math.random() * 0.28);

    const forbiddenRightEdge = homeBaseX + homeRingRadius + laneInsetX;

    const minSpawnX = Math.max(forbiddenRightEdge, width * 0.28);
    const maxSpawnX = width - laneInsetX;

    if (side === "top") {
      return {
        x: minSpawnX + Math.random() * Math.max(24, maxSpawnX - minSpawnX),
        y: -depth,
        side: "top",
      };
    }

    if (side === "bottom") {
      return {
        x: minSpawnX + Math.random() * Math.max(24, maxSpawnX - minSpawnX),
        y: height + depth,
        side: "bottom",
      };
    }

    return {
      x: width + depth,
      y: laneInsetX + Math.random() * Math.max(24, height - laneInsetX * 2),
      side: "right",
    };
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
      this.restartBtn.classList.remove(
        "actionBtn-fade-glow",
        "actionBtn-disabled"
      );
      this.restartBtn.style.removeProperty("--fade-glow-duration");
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

    this.score = 0;
    this.savedCount = 0;
    this.lostCount = 0;

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

    this.tutorialEnabledForRun = false;
    this.tutor.reset({ enabled: false });

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

    this.homeStar = new HomeStar(this.sceneMetrics);
    this.spawnStarlets(12);
    this.updateUI();
    this.draw();

    if (restartAmbient) {
      this.audio.startAmbient({ restart: true });
    }

    this.startGameLoop();
  };

  spawnStarlets(count) {
    for (let i = 0; i < count; i++) {
      const spawn = this.createSpawnPoint();
      this.starlets.push(
        new Starlet(spawn.x, spawn.y, spawn.side, this.sceneMetrics)
      );
    }
  }

  removeOffscreenStarlets() {
    for (let i = this.starlets.length - 1; i >= 0; i--) {
      if (this.starlets[i].isOffscreen()) {
        this.starlets.splice(i, 1);
      }
    }
  }

  spawnObstacle() {
    this.obstacles.push(new Obstacle(this.sceneMetrics));
  }

  spawnScatterEffect(x, y, color, cool = false) {
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x, y, color, cool));
    }
  }

  emitFollowingTrail(starlet, followingCount, delta) {
    if (!starlet.following) {
      starlet.trailTimer = 0;
      return;
    }

    const intensity = Math.min(1, 0.45 + followingCount * 0.14);
    const interval = Math.max(0.035, 0.085 - followingCount * 0.008);

    starlet.trailTimer += delta;

    while (starlet.trailTimer >= interval) {
      starlet.trailTimer -= interval;

      const burstCount =
        followingCount >= 4
          ? 2
          : followingCount >= 2 && Math.random() < 0.45
          ? 2
          : 1;

      for (let i = 0; i < burstCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = starlet.radius * (0.2 + Math.random() * 0.9);

        const px = starlet.x + Math.cos(angle) * radius * 0.55;
        const py = starlet.y + Math.sin(angle) * radius * 0.55;

        this.particles.push(
          new Particle(px, py, "rgba(255, 236, 176, 0.95)", false, {
            vx: (Math.random() - 0.5) * 0.45 - 0.15,
            vy: (Math.random() - 0.5) * 0.45 + 0.08,
            life: 0.7 + Math.random() * 0.25,
            decay: 0.04 + Math.random() * 0.025,
            size: 0.9 + Math.random() * 1.5 * intensity,
            gravity: -0.002,
            shrink: 0.01,
            alphaBoost: 0.65 + intensity * 0.25,
          })
        );
      }
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
      if (
        e?.pointerId != null &&
        this.canvas?.hasPointerCapture?.(e.pointerId)
      ) {
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

    let swarmCenter = null;
    if (this.starlets.length > 0) {
      let sx = 0,
        sy = 0;
      for (const s of this.starlets) {
        sx += s.x;
        sy += s.y;
      }
      swarmCenter = {
        x: sx / this.starlets.length,
        y: sy / this.starlets.length,
      };
    }

    const followingCount = this.starlets.reduce(
      (count, s) => count + (s.following ? 1 : 0),
      0
    );

    this.starlets.forEach((s) => {
      const justCaught = s.update(this.mousePos, this.isDragging, swarmCenter);
      if (justCaught) this.audio.playCatchSound();

      this.emitFollowingTrail(s, followingCount, delta);
    });

    this.removeOffscreenStarlets();

    this.obstacles.forEach((o) => {
      o.update();
      if (this.homeStar.blocksObstacle(o)) this.homeStar.repelObstacle(o);
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.tutor.update(delta, this);

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());

    this.checkCollisions();
    this.checkHomeHits();

    this.obstacleTimer += delta * 1000;
    if (this.obstacleTimer >= this.obstacleInterval) {
      this.spawnObstacle();
      this.obstacleTimer = 0;
    }

    if (this.score >= 60) this.obstacleInterval = 2000;
    if (this.score >= 140) this.obstacleInterval = 1800;
    if (this.score >= 260) this.obstacleInterval = 1600;

    if (this.starlets.length < 8) this.spawnStarlets(4);

    this.updateHeartProgress(delta);
    this.updateUI();
  }

  checkCollisions() {
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

  checkHomeHits() {
    for (let i = this.starlets.length - 1; i >= 0; i--) {
      if (this.homeStar.isHit(this.starlets[i])) {
        this.score += 10;
        this.savedCount += 1;
        this.audio.playScoreSound();
        this.tutor.notifySuccess();
        this.spawnScatterEffect(
          this.homeStar.x,
          this.homeStar.y,
          "#DEA15E",
          true
        );
        this.starlets.splice(i, 1);
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
      const progress = Math.max(
        0,
        Math.min(1, this.timeLeft / this.totalTime)
      );
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

    if (this.homeStar) this.homeStar.draw(this.ctx);
    this.obstacles.forEach((o) => o.draw(this.ctx));
    this.starlets.forEach((s) => s.draw(this.ctx));
    this.particles.forEach((p) => p.draw(this.ctx));

    this.tutor.draw(this.ctx);

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
        this.canvas.removeEventListener(
          "pointercancel",
          this.handlePointerEnd
        );
        this.canvas.removeEventListener("pointerleave", this.handlePointerEnd);
      }
    }

    this.inputBound = false;
    this.handlePointerMoveCore = null;
    this.handlePointerDown = null;
    this.handlePointerMove = null;
    this.handlePointerEnd = null;

    window.removeEventListener("resize", this.handleResize);

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
  }
}