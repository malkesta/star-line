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
    
class Starlet {
  constructor(x, y, entrySide = "top", sceneMetrics) {
    this.sceneMetrics = sceneMetrics;

    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.prevX = x;
    this.prevY = y;
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
    this.releaseCooldown = 0;
    this.ringCooldown = 0;
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
    this.prevX = this.x;
this.prevY = this.y;

if (this.releaseCooldown > 0) this.releaseCooldown -= 1;
if (this.ringCooldown > 0) this.ringCooldown -= 1;

if (isDragging && !this.following && this.releaseCooldown <= 0) {
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
  constructor(sceneMetrics, side = "left", phaseOffset = 0) {
    this.side = side;
    this.phaseOffset = phaseOffset;

    this.x = 0;
    this.y = 0;

    this.baseRadius = 34;
    this.radius = 34;
    this.ringRadius = 60;
    this.glowRadius = 140;

    this.flicker = Math.random() * Math.PI * 2;
    this.rotation = 0;
    this.motionTime = Math.random() * Math.PI * 2;
    this.sizeTime = Math.random() * Math.PI * 2;

    this.setBounds(sceneMetrics);
  }

  setBounds(sceneMetrics) {
  this.sceneMetrics = sceneMetrics;
  if (!sceneMetrics) return;

  this.baseRadius = sceneMetrics.homeRadius;
  this.radius = this.baseRadius;
  this.ringRadius = sceneMetrics.homeRingRadius;
  this.glowRadius = sceneMetrics.homeGlowRadius;

  this.leftMinX = sceneMetrics.homeLeftMinX;
  this.leftMaxX = sceneMetrics.homeLeftMaxX;
  this.rightMinX = sceneMetrics.homeRightMinX;
  this.rightMaxX = sceneMetrics.homeRightMaxX;
  this.minY = sceneMetrics.homeMinY;
  this.maxY = sceneMetrics.homeMaxY;

  this.pulseScaleMin = sceneMetrics.homePulseScaleMin;
  this.pulseScaleMax = sceneMetrics.homePulseScaleMax;

  this.update(0);
}

  update(delta = 0.016) {
    this.flicker += 0.035;
    this.rotation += 0.006;
    this.motionTime += delta * 0.3;
    this.sizeTime += delta * 0.55;

    const t = this.motionTime + this.phaseOffset;
    const horizontalWave = Math.sin(t * 0.95) * 0.5 + 0.5;
    const verticalWave = Math.cos(t * 1.15) * 0.5 + 0.5;

    if (this.side === "left") {
      this.x = this.leftMinX + (this.leftMaxX - this.leftMinX) * horizontalWave;
    } else {
      this.x = this.rightMinX + (this.rightMaxX - this.rightMinX) * (1 - horizontalWave);
    }

    this.y = this.minY + (this.maxY - this.minY) * verticalWave;

    const pulseWave = Math.sin(this.sizeTime + this.phaseOffset) * 0.5 + 0.5;
    const pulseScale =
      this.pulseScaleMin +
      (this.pulseScaleMax - this.pulseScaleMin) * pulseWave;

    this.radius = this.baseRadius * pulseScale;
    this.ringRadius = this.sceneMetrics.homeRingRadius * pulseScale;
    this.glowRadius = this.sceneMetrics.homeGlowRadius * pulseScale;
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

class BrokenRingObstacle {
  constructor(sceneMetrics, radiusScale = 1) {
    this.anchorStar = null;
    this.radiusScale = radiusScale;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.0041;
    this.pulseTime = Math.random() * Math.PI * 2;

    this.sceneMetrics = null;
    this.radius = 0;
    this.lineWidth = 0;
    this.innerRingInset = 0;
    this.innerRingLineWidth = 0;
    this.sectionCount = 3;
    this.centerX = 0;
    this.centerY = 0;
    this.ringHitPadding = 2;
    this.bounceStrength = 1.2;

    this.setBounds(sceneMetrics);
  }

  setBounds(sceneMetrics) {
  this.sceneMetrics = sceneMetrics;
  if (!sceneMetrics) return;

  const clamp = (min, value, max) => Math.max(min, Math.min(max, value));
  const minSide = Math.min(sceneMetrics.width, sceneMetrics.height);

  const minRefSide = 320;
  const maxRefSide = 1080;

  const minLargeRingDiameter = minRefSide * 0.7;   // 224
  const maxLargeRingDiameter = maxRefSide * 0.7;   // 756

  const largeRingDiameter = clamp(
    minLargeRingDiameter,
    minSide * 0.7,
    maxLargeRingDiameter
  );

  const largeRingRadius = largeRingDiameter / 2;

  this.radius = largeRingRadius * this.radiusScale;

this.lineWidth = clamp(
  sceneMetrics.brokenRingLineWidthMin,
  this.radius * sceneMetrics.brokenRingLineWidthRatio,
  sceneMetrics.brokenRingLineWidthMax
);

this.innerRingInset = clamp(
  sceneMetrics.brokenRingInnerInsetMin,
  this.lineWidth * sceneMetrics.brokenRingInnerInsetRatio,
  sceneMetrics.brokenRingInnerInsetMax
);

this.innerRingLineWidth = clamp(
  sceneMetrics.brokenRingInnerLineWidthMin,
  this.lineWidth * sceneMetrics.brokenRingInnerLineWidthRatio,
  sceneMetrics.brokenRingInnerLineWidthMax
);
  this.sectionCount = sceneMetrics.brokenRingSectionCount;
  this.centerX = sceneMetrics.brokenRingCenterX;
  this.centerY = sceneMetrics.brokenRingCenterY;
  this.ringHitPadding = clamp(
  sceneMetrics.brokenRingHitPaddingMin,
  this.lineWidth * sceneMetrics.brokenRingHitPaddingRatio,
  sceneMetrics.brokenRingHitPaddingMax
);
  this.bounceStrength = sceneMetrics.brokenRingBounceStrength;
}

  update(delta = 0.016) {
    this.rotation += this.rotationSpeed * delta * 60;
    this.pulseTime += delta * 2.1;
  }

  setAnchor(star) {
  this.anchorStar = star ?? null;
}

 getCenter() {
  if (this.anchorStar) {
    return { x: this.anchorStar.x, y: this.anchorStar.y };
  }
  return { x: this.centerX, y: this.centerY };
}

  getGeometry() {
  const fullStep = (Math.PI * 2) / this.sectionCount;
  const targetGapWidth = this.sceneMetrics?.brokenRingGapWidth ?? 48;

  const rawGapAngle = targetGapWidth / Math.max(1, this.radius);
  const maxGapAngle = fullStep * 0.82;
  const gapAngle = Math.min(rawGapAngle, maxGapAngle);

  const arcSpan = fullStep - gapAngle;

  return {
    fullStep,
    targetGapWidth,
    gapAngle,
    arcSpan,
  };
}

  normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let result = angle % twoPi;
    if (result < 0) result += twoPi;
    return result;
  }

  isAngleInsideArc(angle, start, end) {
    const a = this.normalizeAngle(angle);
    const s = this.normalizeAngle(start);
    const e = this.normalizeAngle(end);

    if (s <= e) return a >= s && a <= e;
    return a >= s || a <= e;
  }

  resolveStarletCollision(starlet) {
  if (!starlet) return false;
  if ((starlet.ringCooldown ?? 0) > 0) return false;

  const center = this.getCenter();
  const geometry = this.getGeometry();

  const dx = starlet.x - center.x;
  const dy = starlet.y - center.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

  const prevDx = (starlet.prevX ?? starlet.x) - center.x;
  const prevDy = (starlet.prevY ?? starlet.y) - center.y;
  const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy) || 0.0001;

const ringZoneHalf = starlet.radius + this.lineWidth * 0.36 + this.ringHitPadding;
  const isNearRingNow = Math.abs(dist - this.radius) <= ringZoneHalf;
  const crossedRingBand =
    (prevDist < this.radius && dist > this.radius) ||
    (prevDist > this.radius && dist < this.radius);

  if (!isNearRingNow && !crossedRingBand) return false;

  const midX = ((starlet.prevX ?? starlet.x) + starlet.x) * 0.5;
  const midY = ((starlet.prevY ?? starlet.y) + starlet.y) * 0.5;

  const angleNow = Math.atan2(dy, dx);
  const angleMid = Math.atan2(midY - center.y, midX - center.x);

  let hitSolidArc = false;

  for (let i = 0; i < this.sectionCount; i++) {
    const start = this.rotation + i * geometry.fullStep;
    const end = start + geometry.arcSpan;

    if (
      this.isAngleInsideArc(angleNow, start, end) ||
      this.isAngleInsideArc(angleMid, start, end)
    ) {
      hitSolidArc = true;
      break;
    }
  }

  if (!hitSolidArc) return false;

  const nx = dx / dist;
const ny = dy / dist;
const tx = -ny;
const ty = nx;

const wasOutside = prevDist > this.radius;

const separationPadding = wasOutside ? 8 : 18;
const targetDist = wasOutside
  ? this.radius + ringZoneHalf + separationPadding
  : Math.max(0, this.radius - ringZoneHalf - separationPadding);

starlet.x = center.x + nx * targetDist;
starlet.y = center.y + ny * targetDist;

const velocityDot = starlet.vx * nx + starlet.vy * ny;
const tangentDot = starlet.vx * tx + starlet.vy * ty;

const outwardNormalSpeed = wasOutside ? 1.8 : -2.6;
const tangentDamping = 0.72;

starlet.vx = tx * tangentDot * tangentDamping + nx * outwardNormalSpeed;
starlet.vy = ty * tangentDot * tangentDamping + ny * outwardNormalSpeed;

if (starlet.following) {
  starlet.following = false;
  starlet.releaseCooldown = 24;
} else {
  starlet.releaseCooldown = Math.max(starlet.releaseCooldown || 0, 16);
}

starlet.ringCooldown = wasOutside ? 6 : 12;
return true;
}

  drawArc(ctx, cx, cy, radius, start, end, color, width, alpha = 1, blur = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    if (blur > 0) {
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
    }
    ctx.stroke();
    ctx.restore();
  }

  drawArcGlow(ctx, cx, cy, radius, start, end, alphaBoost = 1) {
    const grad = ctx.createRadialGradient(cx, cy, radius - 80, cx, cy, radius + 30);
    grad.addColorStop(0, `rgba(206, 69, 69, ${0.0 * alphaBoost})`);
    grad.addColorStop(0.72, `rgba(206, 69, 69, ${0.06 * alphaBoost})`);
    grad.addColorStop(0.9, `rgba(206, 69, 69, ${0.22 * alphaBoost})`);
    grad.addColorStop(1, `rgba(206, 69, 69, ${0.0 * alphaBoost})`);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.strokeStyle = grad;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(206, 69, 69, 0.24)";
    ctx.stroke();
    ctx.restore();
  }

  drawGem(ctx, x, y, angle, pulse = 1) {
    const glow = 0.65 + pulse * 0.35;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.shadowBlur = 18 + pulse * 10;
    ctx.shadowColor = `rgba(206, 69, 69, ${0.45 + pulse * 0.2})`;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(206, 69, 69, ${0.88 + pulse * 0.12})`;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-4.5, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 185, 185, ${0.34 + pulse * 0.18})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255, 220, 220, ${0.58 + glow * 0.18})`;
    ctx.stroke();

    ctx.restore();
  }

  draw(ctx) {
    
    const center = this.getCenter();
    const cx = center.x;
    const cy = center.y;
    const geometry = this.getGeometry();

    for (let i = 0; i < this.sectionCount; i++) {
      const start = this.rotation + i * geometry.fullStep;
      const end = start + geometry.arcSpan;

      const pulseA = (Math.sin(this.pulseTime + i * 1.3) + 1) * 0.5;
      const pulseB = (Math.sin(this.pulseTime + i * 1.3 + 0.9) + 1) * 0.5;
      const sectionGlow = 0.7 + pulseA * 0.3;

      this.drawArcGlow(ctx, cx, cy, this.radius, start, end, 0.75 + pulseA * 0.45);

      this.drawArc(
        ctx,
        cx,
        cy,
        this.radius,
        start,
        end,
        "#8f1126",
        this.lineWidth + 1.8,
        0.98
      );

      this.drawArc(
        ctx,
        cx,
        cy,
        this.radius,
        start,
        end,
        `rgba(206, 69, 69, ${0.28 + sectionGlow * 0.22})`,
        this.lineWidth + 0.4,
        1,
        8
      );

      this.drawArc(
        ctx,
        cx,
        cy,
        this.radius,
        start + 0.015,
        end - 0.015,
        `rgba(206, 69, 69, ${0.72 + sectionGlow * 0.2})`,
        1.6,
        1,
        14
      );

      this.drawArc(
  ctx,
  cx,
  cy,
  this.radius - this.innerRingInset,
  start + 0.02,
  end - 0.02,
  "#ce4545",
  this.innerRingLineWidth,
  0.95,
  10
);

      const gem1Angle = start;
      const gem2Angle = end;

      const gem1X = cx + Math.cos(gem1Angle) * this.radius;
      const gem1Y = cy + Math.sin(gem1Angle) * this.radius;
      const gem2X = cx + Math.cos(gem2Angle) * this.radius;
      const gem2Y = cy + Math.sin(gem2Angle) * this.radius;

      this.drawGem(ctx, gem1X, gem1Y, gem1Angle, pulseA);
      this.drawGem(ctx, gem2X, gem2Y, gem2Angle, pulseB);
    }
  }
}

        export class GameplayScene6 {

  constructor({
  sceneId = "game6",
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
  this.sceneMusicUrl = "../../assets/audio/game5.mp3";
this.sceneBackgroundUrl = "../../assets/images/backgrounds/game_bg5.webp";
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

  this.levelTargetScore = 400;
  this.levelPassed = false;
  this.displayedHeartProgress = 0;
  this.targetHeartProgress = 0;
  this.heartPulseTimeout = null;

  this.homeStars = [];
  this.starlets = [];
  this.obstacles = [];
  this.particles = [];
  this.brokenRings = [];

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


    // Рестарт
this.handleRestartClick = () => {
  if (this.isTransitioning) return;

  this.isDragging = false;
  this.resetGame({ restartAmbient: true });
};

// Кнопка дальше
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

 this.homeStars = [
  new HomeStar(this.sceneMetrics, "left", 0),
  new HomeStar(this.sceneMetrics, "right", Math.PI),
];

this.brokenRings = [
  new BrokenRingObstacle(this.sceneMetrics, 0.63),
  new BrokenRingObstacle(this.sceneMetrics, 1.0),
];

this.brokenRings[0].setAnchor(this.homeStars[0]);
this.brokenRings[1].setAnchor(this.homeStars[1]);

this.spawnStarlets(12);

this.updateTargetScoreUI();
this.updateUI();
this.draw();
}
  
              isLandscape() { return window.innerWidth >= window.innerHeight; }

              computeSceneMetrics() {
  const width = this.canvas.width;
  const height = this.canvas.height;
  const clamp = (min, value, max) => Math.max(min, Math.min(max, value));
  const playScale = clamp(0.9, width / 1366, 1.18);
  const minSide = Math.min(width, height);

  const starletBaseRadius = clamp(6.6, 7.0 * playScale, 8.9);
  const maxStarletRadius = starletBaseRadius * 1.33;
  const maxStarletDiameter = maxStarletRadius * 2;

  const brokenRingBaseRadius = clamp(72, minSide * 0.135, 132);
  const brokenRingGapWidth = clamp(54, maxStarletDiameter * 3.4, 92);

  this.sceneMetrics = {
    width,
    height,
    minSide,
    playScale,

    laneInsetX: width * 0.04,
    offscreenOffset: width * 0.06,
    obstacleCullOffset: width * 0.16,

    homeRadius: clamp(24, 28 * playScale, 34),
    homeRingRadius: clamp(42, 48 * playScale, 60),
    homeGlowRadius: clamp(92, 110 * playScale, 132),

    homeLeftMinX: -width * 0.10,
    homeLeftMaxX: width * 0.24,
    homeRightMinX: width * 0.76,
    homeRightMaxX: width + width * 0.10,
    homeMinY: height * 0.26,
    homeMaxY: height * 0.74,

    homePulseScaleMin: 0.72,
    homePulseScaleMax: 1.28,

    brokenRingBaseRadius,
    brokenRingMinRadius: clamp(52, minSide * 0.10, 90),
    brokenRingMaxRadius: clamp(96, minSide * 0.24, 180),
    brokenRingGapWidth,
    brokenRingLineWidthMin: 3.2,
    brokenRingLineWidthMax: 5.1,
    brokenRingLineWidthRatio: 5.1 / (1080 * 0.7 * 0.5),
    brokenRingInnerInsetMin: 6,
    brokenRingInnerInsetMax: 10,
    brokenRingInnerInsetRatio: 10 / 5.1,

    brokenRingInnerLineWidthMin: 1.4,
    brokenRingInnerLineWidthMax: 2.2,
    brokenRingInnerLineWidthRatio: 2.2 / 5.1,
    brokenRingSectionCount: 3,
    brokenRingCenterX: width * 0.5,
    brokenRingCenterY: height * 0.5,
    brokenRingHitPaddingMin: 2.56,
    brokenRingHitPaddingMax: 3.8,
    brokenRingHitPaddingRatio: 3.8 / 5.1,
    brokenRingBounceStrength: 1.4,

    starletBaseRadius,
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

  if (this.homeStars?.length) {
    this.homeStars.forEach((star) => star.setBounds(this.sceneMetrics));
  }

  if (this.brokenRings?.length) {
  this.brokenRings.forEach((ring) => ring.setBounds(this.sceneMetrics));
}

  if (this.rotateHint)
    this.rotateHint.classList.toggle(
      "show",
      !this.isLandscape && !this.gameOver && !this.isRunning
    );
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

  this.isRunning = true;
  this.gameOver = false;
  this.lastTime = performance.now();
  console.log("before game loop");

  this.startGameLoop();
  console.log("game loop started");
}
  
 createSpawnPoint() {
  const { width, height, offscreenOffset } = this.sceneMetrics;

  const side = Math.random() < 0.5 ? "top" : "bottom";
  const depth = offscreenOffset * (0.18 + Math.random() * 0.28);

  const margin = 24;
  const x = margin + Math.random() * Math.max(1, width - margin * 2);

  if (side === "top") {
    return {
      x,
      y: -depth,
      side: "top",
    };
  }

  return {
    x,
    y: height + depth,
    side: "bottom",
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
                this.displayedHeartProgress += (this.targetHeartProgress - this.displayedHeartProgress) * blend;
              
                if (Math.abs(this.targetHeartProgress - this.displayedHeartProgress) < 0.002) {
                  this.displayedHeartProgress = this.targetHeartProgress;
                }
              
                if (this.heartFillRect) {
                  const heartMaskMaxWidth = 43.5;
                  this.heartFillRect.setAttribute("width", heartMaskMaxWidth * this.displayedHeartProgress);
                }
              
                if (this.heartIconElement) {
                  this.heartIconElement.classList.toggle("is-active", this.displayedHeartProgress > 0.02);
              
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
    this.finalRankLabelElement.textContent = this.getSceneRankLabel(finalRank);
  }
}

  showRoundResult() {
    if (this.isTransitioning) return;

    // levelPassed уже считается перед вызовом этого метода
    if (this.finalScoreElement) {
    this.finalScoreElement.textContent = this.score;
  }

  if (this.targetScoreElement) {
    this.targetScoreElement.textContent = this.levelTargetScore;
  }

  // Заголовок: пройден / почти получилось
  if (this.resultTitleElement) {
    this.resultTitleElement.textContent = this.levelPassed
      ? 'Ночь закончилась'
      : 'Почти получилось';
  }

  // Фраза про девочку
  if (this.resultMessageElement) {
    this.resultMessageElement.textContent = this.levelPassed
      ? 'Девочка счастлива — она спасла так много звёзд!'
      : 'Девочка надеялась спасти больше звёзд.';
  }

  // Обновляем ранги (HUD + финальный блок)
  this.updateRankUI();

     // Кнопка "Дальше" доступна только если уровень пройден
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

  // Показываем оверлей
  this.audio.playGameOverSound();
  this.overlay?.classList.add('show');
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

    if (this.overlay) {
      this.overlay.classList.remove("show");
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove("actionBtn-disabled", "actionBtn-fade-glow");
      this.restartBtn.disabled = false;
      this.restartBtn.style.removeProperty("--fade-glow-duration");
    }

    if (this.nextBtn) {
      this.nextBtn.classList.remove("actionBtn-fade-glow");
      this.nextBtn.classList.add("actionBtn-disabled");
      this.nextBtn.disabled = true;
      this.nextBtn.style.removeProperty("--fade-glow-duration");
    }

    this.homeStars = [
  new HomeStar(this.sceneMetrics, "left", 0),
  new HomeStar(this.sceneMetrics, "right", Math.PI),
];

this.brokenRings = [
  new BrokenRingObstacle(this.sceneMetrics, 0.63),
  new BrokenRingObstacle(this.sceneMetrics, 1.0),
];

this.brokenRings[0].setAnchor(this.homeStars[0]);
this.brokenRings[1].setAnchor(this.homeStars[1]);

this.spawnStarlets(12);

this.updateTargetScoreUI();
this.updateUI();
this.draw();

    if (restartAmbient) {
      this.audio.startAmbient({ restart: true });
    }

    this.startGameLoop();
  };
            
    removeOffscreenStarlets() {
  for (let i = this.starlets.length - 1; i >= 0; i--) {
    if (this.starlets[i].isOffscreen()) {
      this.starlets.splice(i, 1);
    }
  }
}
refillStarletsIfLow({ minCount = 4, targetCount = 12 } = {}) {
  if (this.starlets.length <= minCount) {
    this.spawnStarlets(targetCount - this.starlets.length);
  }
}
             spawnStarlets(count) {
  for (let i = 0; i < count; i++) {
    const spawn = this.createSpawnPoint();
    this.starlets.push(
      new Starlet(spawn.x, spawn.y, spawn.side, this.sceneMetrics)
    );
  }
} 
  
              spawnObstacle() {
  this.obstacles.push(new Obstacle(this.sceneMetrics));
}
  
  
              spawnScatterEffect(x, y, color, cool = false) {
                  for (let i = 0; i < 12; i++) this.particles.push(new Particle(x, y, color, cool));
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
      followingCount >= 4 ? 2 :
      followingCount >= 2 && Math.random() < 0.45 ? 2 : 1;

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
      if (e.pointerType === "mouse" && e.buttons === 0 && !this.isDragging) return;
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
    let sx = 0;
    let sy = 0;

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

  this.obstacles.forEach((o) => o.update());

  if (this.brokenRings?.length) {
    this.brokenRings.forEach((ring) => ring.update(delta));
  }

  this.homeStars.forEach((star) =>
    this.obstacles.forEach((o) => {
      if (star.blocksObstacle(o)) {
        star.repelObstacle(o);
      }
    })
  );

  if (this.brokenRings?.length) {
    this.starlets.forEach((starlet) => {
      this.brokenRings.forEach((ring) => {
        ring.resolveStarletCollision(starlet);
      });
    });
  }

  for (let i = this.particles.length - 1; i >= 0; i--) {
    this.particles[i].update();
    if (this.particles[i].life <= 0) {
      this.particles.splice(i, 1);
    }
  }

  this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());

  this.checkCollisions();
  this.checkHomeHits();

  this.refillStarletsIfLow({ minCount: 4, targetCount: 12 });

  this.obstacleTimer += delta * 1000;
  if (this.obstacleTimer >= this.obstacleInterval) {
    this.spawnObstacle();
    this.obstacleTimer = 0;
  }

  if (this.score >= 60) this.obstacleInterval = 2000;
  if (this.score >= 140) this.obstacleInterval = 1800;
  if (this.score >= 260) this.obstacleInterval = 1600;

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
                              this.spawnScatterEffect(starlet.x, starlet.y, '#7e3c48', true);
                              this.starlets.splice(i, 1);
                              break;
                          }
                      }
                  }
              }
  
              checkHomeHits() {
  for (let i = this.starlets.length - 1; i >= 0; i--) {
    const starlet = this.starlets[i];

    const hitHome = this.homeStars.some((homeStar) => homeStar.isHit(starlet));

    if (hitHome) {
      this.score += 10;
      this.savedCount += 1;
      this.audio.playScoreSound();

      const targetHome =
        this.homeStars.reduce((best, star) => {
          const dx = starlet.x - star.x;
          const dy = starlet.y - star.y;
          const dist = dx * dx + dy * dy;
          if (!best || dist < best.dist) return { star, dist };
          return best;
        }, null)?.star ?? this.homeStars[0];

      this.spawnScatterEffect(targetHome.x, targetHome.y, "#DEA15E", true);
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

  this.homeStars.forEach((star) => star.draw(this.ctx));

  if (this.brokenRings?.length) {
  this.brokenRings.forEach((ring) => ring.draw(this.ctx));
}

  this.obstacles.forEach((o) => o.draw(this.ctx));
  this.starlets.forEach((s) => s.draw(this.ctx));
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
  
       if (this.overlay) {
      this.overlay.classList.remove("show");
    }

    if (this.restartBtn) {
      this.restartBtn.classList.remove("actionBtn-disabled", "actionBtn-fade-glow");
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
    this.restartBtn.classList.remove("actionBtn-disabled", "actionBtn-fade-glow");
    this.restartBtn.disabled = false;
    this.restartBtn.style.removeProperty("--fade-glow-duration");
  }

  if (this.nextBtn) {
    this.nextBtn.classList.remove("actionBtn-disabled", "actionBtn-fade-glow");
    this.nextBtn.disabled = false;
    this.nextBtn.style.removeProperty("--fade-glow-duration");
  }
   this.resetSceneBackground();
}
  }