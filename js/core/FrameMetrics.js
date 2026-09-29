const enabled = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).has("perf");

class FrameMetrics {
  constructor() {
    this.enabled = enabled;
    this.samples = [];
    this.previousRafTime = null;
    this.lastRenderTime = 0;
    this.panel = null;

    if (this.enabled) this.activate();
  }

  begin(rafTime) {
    if (!this.enabled && !globalThis.__starLineDebugMetrics) return null;
    if (!this.enabled) this.activate();
    const start = performance.now();
    const frameDelta = this.previousRafTime === null ? 0 : rafTime - this.previousRafTime;
    this.previousRafTime = rafTime;
    return { start, frameDelta };
  }

  activate() {
    this.enabled = true;
    window.__starLineFrameMetrics = this;
  }

  markUpdate(frame) {
    return frame ? performance.now() : 0;
  }

  end(frame, updateEnd) {
    if (!frame) return;

    const end = performance.now();
    this.samples.push({
      frame: frame.frameDelta,
      update: updateEnd - frame.start,
      draw: end - updateEnd,
      total: end - frame.start,
    });
    if (this.samples.length > 240) this.samples.shift();

    if (end - this.lastRenderTime >= 500) {
      this.lastRenderTime = end;
      this.render();
    }
  }

  snapshot() {
    const samples = this.samples.filter((sample) => sample.frame > 0);
    if (!samples.length) return null;
    const average = (key) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    const sortedFrames = samples.map((sample) => sample.frame).sort((a, b) => a - b);
    const p95Frame = sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * .95))];
    const slowFrames = samples.filter((sample) => sample.frame > 20).length;
    return {
      samples: samples.length,
      fps: 1000 / average("frame"),
      p95Frame,
      slowFrames,
      update: average("update"),
      draw: average("draw"),
      total: average("total"),
    };
  }

  render() {
    const snapshot = this.snapshot();
    if (!snapshot) return;
    if (!this.panel) {
      this.panel = document.createElement("output");
      this.panel.setAttribute("aria-live", "off");
      Object.assign(this.panel.style, {
        position: "fixed", top: "8px", right: "8px", zIndex: "100", padding: "7px 9px",
        borderRadius: "7px", background: "rgba(7, 12, 24, .78)", color: "#d7dde8",
        font: "12px/1.45 ui-monospace, monospace", pointerEvents: "none", whiteSpace: "pre",
      });
      document.body.append(this.panel);
    }
    this.panel.textContent = [
      `FPS ${snapshot.fps.toFixed(1)}  p95 ${snapshot.p95Frame.toFixed(1)} ms`,
      `slow ${snapshot.slowFrames}/${snapshot.samples}  update ${snapshot.update.toFixed(2)} ms`,
      `draw ${snapshot.draw.toFixed(2)} ms  total ${snapshot.total.toFixed(2)} ms`,
    ].join("\n");
  }
}

export const frameMetrics = new FrameMetrics();
