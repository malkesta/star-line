const ROUTE = ["book", "star", "star", "book", "star", "star", "book", "star", "star", "book", "star", "star", "book", "star", "star", "book"];

const starIcon = `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="22"/><path d="M27 10.5 31.8 20l10.6 1.6-7.7 7.5 1.8 10.6L27 34.7l-9.5 5 1.8-10.6-7.7-7.5L22.2 20Z"/></svg>`;
const bookIcon = `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="22"/><path d="M27 17c-4-2.8-8.5-2.7-12.5-.2v19c4-2.5 8.5-2.5 12.5.2m0-19c4-2.8 8.5-2.7 12.5-.2v19c-4-2.5-8.5-2.5-12.5.2M27 17v19"/></svg>`;

class ResultOverlayLayout {
  constructor(host) {
    this.overlay = host?.closest("#overlay, #vnResultOverlay") ?? host;
    this.observe();
  }

  observe() {
    if (!this.overlay || typeof ResizeObserver === "undefined") return;
    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(this.overlay);
  }

  update() {
    const height = this.overlay?.getBoundingClientRect().height ?? 0;
    if (!height) return;
    // Пересчёт всегда идёт от исходной высоты, поэтому масштаб не накапливается.
    const tier = height >= 720 ? [1.18, 1, 1] : height >= 560 ? [.94, .9, .72] : [.76, .78, .4];
    const style = this.overlay.style;
    style.setProperty("--result-progress-scale", tier[0]);
    style.setProperty("--result-card-scale", tier[1]);
    style.setProperty("--result-decoration-scale", tier[2]);
  }

  destroy() { this.observer?.disconnect(); }
}

// Живёт только вместе с одним экземпляром сцены. Здесь нет менеджера,
// сохранения, событий окна и знания о результатах других сцен.
export class LocalResultProgression {
  constructor({ currentIndex, host, nextButton, anchor = null }) {
    this.currentIndex = currentIndex;
    this.host = host;
    this.nextButton = nextButton;
    this.anchor = anchor;
    this.timers = new Set();
    this.finished = false;
    this.layout = new ResultOverlayLayout(host);
  }

  mount() {
    this.destroyVisual();
    const strip = document.createElement("div");
    strip.className = "local-progression";
    strip.innerHTML = ROUTE.map((kind, index) => {
      const medal = `<span class="local-progress-medal ${index < this.currentIndex ? "is-lit" : index === this.currentIndex ? "is-current" : "is-locked"}">${kind === "book" ? bookIcon : starIcon}</span>`;
      const connector = index === ROUTE.length - 1
        ? ""
        : `<span class="local-progress-connector" aria-hidden="true">✦</span>`;
      return medal + connector;
    }).join("");
    if (this.anchor?.parentElement === this.host) {
      this.anchor.insertAdjacentElement("afterend", strip);
    } else {
      this.host?.prepend(strip);
    }
    this.strip = strip;
    this.current = strip.querySelector(".is-current");
    this.layout.update();
  }

  playSuccess() {
    this.start();
    this.setNextEnabled(false);
    this.current?.classList.add("is-success-running");
    const comet = document.createElement("span");
    comet.className = "local-progress-comet";
    comet.innerHTML = `<span class="local-comet-core">★</span>${Array.from(
      { length: 5 },
      () => '<i class="local-comet-tail-particle"></i>'
    ).join("")}`;
    this.current?.append(comet);
    // Кнопка живёт по собственному таймеру: её доступность не зависит от
    // длительности декоративной анимации медали.
    this.after(1000, () => this.setNextEnabled(true));
    this.after(1100, () => {
      comet.remove();
      this.createImpactBurst();
    });
    this.after(1900, () => this.current?.querySelector(".local-impact-burst")?.remove());
    this.after(1900, () => this.finishOnce(true));
  }

  playFailure() {
    this.start();
    this.setNextEnabled(false);
    this.current?.classList.add("is-failure-running");
    this.after(2500, () => this.finishOnce(false));
  }

  start() {
    this.cancelTimers();
    this.finished = false;
    this.mount();
  }

  createImpactBurst() {
    if (!this.current) return;
    const burst = document.createElement("span");
    burst.className = "local-impact-burst";
    burst.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const angle = `${index * 30}deg`;
      const distance = `${11 + (index % 3) * 4}px`;
      return `<i style="--particle-angle:${angle};--particle-distance:${distance}"></i>`;
    }).join("");
    this.current.append(burst);
  }

  finishOnce(passed) {
    if (this.finished) return;
    this.finished = true;
    // `is-current` намеренно снимается: он описывает лишь исходное тусклое
    // состояние. После результата медаль должна остаться яркой до выхода
    // из сцены либо остаться потухшей при неудаче.
    this.current?.classList.remove(
      "is-current",
      "is-success-running",
      "is-failure-running"
    );
    this.current?.classList.toggle("is-lit", passed);
    this.current?.classList.toggle("is-failed", !passed);
    // При успехе кнопка уже включена отдельным таймером. При провале она
    // принципиально остаётся заблокированной.
    if (!passed) this.setNextEnabled(false);
  }

  setNextEnabled(enabled) {
    if (!this.nextButton) return;
    this.nextButton.disabled = !enabled;
    this.nextButton.classList.toggle("actionBtn-disabled", !enabled);
  }

  after(delay, callback) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  cancelTimers() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
  }

  destroyVisual() {
    this.strip?.remove();
    this.strip = null;
    this.current = null;
  }

  destroy() {
    this.reset();
    this.layout.destroy();
  }

  reset() {
    this.cancelTimers();
    this.destroyVisual();
  }
}
