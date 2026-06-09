export class StartScreenScene {
  constructor({ sceneManager, audio }) {
    this.sceneManager = sceneManager;
    this.audio = audio;

    this.startScreen = document.getElementById("startScreen");
    this.startBtn = document.getElementById("startBtn");
    this.rotateHint = document.getElementById("rotateHint");

    this.fullscreenBtn = null;
    this.fullscreenHintTimer = null;
    this.fullscreenHintCleanupTimer = null;

    this.handleStartClick = this.handleStartClick.bind(this);
    this.handleFullscreenClick = this.handleFullscreenClick.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
    this.handleLayoutUpdate = this.handleLayoutUpdate.bind(this);
  }

  get isLandscape() {
    return window.innerWidth > window.innerHeight;
  }

  get fullscreenSupported() {
    const el = document.documentElement;
    return !!(
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      document.exitFullscreen ||
      document.webkitExitFullscreen
    );
  }

  get fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

removeIntroFallback() {
    const introCinematic = document.getElementById("introCinematic");
    if (introCinematic) {
      introCinematic.remove();
    }
  }

  async enterFullscreen() {
    const root = document.documentElement;

    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return;
    }

    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
    }
  }

  async exitFullscreen() {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }

    if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    }
  }

  async toggleFullscreen() {
    try {
      if (this.fullscreenElement) {
        await this.exitFullscreen();
      } else {
        await this.enterFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen toggle failed", error);
    }
  }

  handleFullscreenClick() {
    this.toggleFullscreen();
  }

  handleLayoutUpdate() {
    this.positionFullscreenButton();
  }

  handleFullscreenChange() {
    if (!this.fullscreenBtn) return;

    const isActive = !!this.fullscreenElement;
    this.fullscreenBtn.classList.toggle("is-active", isActive);
    this.fullscreenBtn.setAttribute(
      "aria-label",
      isActive ? "Выйти из полноэкранного режима" : "Полноэкранный режим"
    );
    this.fullscreenBtn.setAttribute(
      "title",
      isActive ? "Выйти из полноэкранного режима" : "Полноэкранный режим"
    );

    requestAnimationFrame(() => {
      this.positionFullscreenButton();
    });
  }

  ensureFullscreenStyles() {
    if (document.getElementById("startScreenFullscreenStyles")) return;

    const style = document.createElement("style");
    style.id = "startScreenFullscreenStyles";

    style.textContent = `
  #startScreen .fullscreen-btn {
    --fs-btn-size: clamp(46px, 6.4vh, 58px);
    --fs-icon-size: clamp(28px, 5.7vh, 38px);

    appearance: none;
    position: fixed;
    width: var(--fs-btn-size);
    height: var(--fs-btn-size);
    min-width: var(--fs-btn-size);
    padding: 0;
    border: 1px solid rgba(196, 202, 212, 0);
    border-radius: clamp(14px, 1.8vh, 18px);
    background: rgba(150, 156, 168, 0);
    color: rgba(176, 182, 193, 0.55);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 0 0 rgba(223, 233, 255, 0);
    z-index: 25;
    transition:
      color 180ms ease,
      border-color 240ms ease,
      background-color 240ms ease,
      box-shadow 280ms ease,
      opacity 220ms ease;
  }

  #startScreen .fullscreen-btn:hover {
    color: rgba(202, 208, 220, 0.96);
    background: rgba(150, 156, 168, 0.08);
    border-color: rgba(196, 202, 212, 0.14);
  }

  #startScreen .fullscreen-btn:active {
    background: rgba(150, 156, 168, 0.12);
  }

  #startScreen .fullscreen-btn:focus-visible {
    outline: none;
    color: rgba(214, 220, 230, 0.98);
    border-color: rgba(210, 218, 232, 0.3);
    box-shadow:
      0 0 0 3px rgba(210, 218, 232, 0.1),
      0 0 18px rgba(210, 218, 232, 0.12);
  }

  #startScreen .fullscreen-btn svg {
    width: var(--fs-icon-size);
    height: var(--fs-icon-size);
    fill: none;
    stroke: currentColor;
    stroke-width: 1.0;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }

  #startScreen .fullscreen-btn.is-active {
    color: rgba(176, 182, 193, 0.22);
  }

  #startScreen .fullscreen-btn.hint-pulse {
    animation: fullscreenHintPulse 2.9s ease-out forwards;
  }

  @keyframes fullscreenHintPulse {
    0% {
      border-color: rgba(196, 202, 212, 0);
      background: rgba(150, 156, 168, 0);
      box-shadow: 0 0 0 rgba(223, 233, 255, 0);
      color: rgba(176, 182, 193, 0.82);
    }

    12% {
      border-color: rgba(214, 224, 241, 0.34);
      background: rgba(150, 156, 168, 0.07);
      box-shadow:
        0 0 0 2px rgba(214, 224, 241, 0.08),
        0 0 18px rgba(214, 224, 241, 0.2);
      color: rgba(232, 238, 248, 0.96);
    }

    26% {
      border-color: rgba(196, 202, 212, 0.08);
      background: rgba(150, 156, 168, 0.02);
      box-shadow:
        0 0 0 1px rgba(214, 224, 241, 0.04),
        0 0 10px rgba(214, 224, 241, 0.08);
      color: rgba(190, 197, 209, 0.88);
    }

    45% {
      border-color: rgba(214, 224, 241, 0.38);
      background: rgba(150, 156, 168, 0.08);
      box-shadow:
        0 0 0 2px rgba(214, 224, 241, 0.1),
        0 0 20px rgba(214, 224, 241, 0.22);
      color: rgba(240, 244, 252, 0.98);
    }

    62% {
      border-color: rgba(196, 202, 212, 0.1);
      background: rgba(150, 156, 168, 0.03);
      box-shadow:
        0 0 0 1px rgba(214, 224, 241, 0.04),
        0 0 10px rgba(214, 224, 241, 0.08);
      color: rgba(190, 197, 209, 0.88);
    }

    100% {
      border-color: rgba(196, 202, 212, 0);
      background: rgba(150, 156, 168, 0);
      box-shadow: 0 0 0 rgba(223, 233, 255, 0);
      color: rgba(176, 182, 193, 0.82);
    }
  }

  @media (max-width: 640px) {
    #startScreen .fullscreen-btn {
      --fs-btn-size: clamp(44px, 5.8vh, 52px);
      --fs-icon-size: clamp(21px, 2.9vh, 26px);
    }
  }
`;

    document.head.appendChild(style);
  }

  ensureFullscreenButton() {
    if (!this.startScreen || !this.startBtn || !this.fullscreenSupported) return;
    if (this.fullscreenBtn) return;

    this.ensureFullscreenStyles();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fullscreen-btn";
    btn.setAttribute("aria-label", "Полноэкранный режим");
    btn.setAttribute("title", "Полноэкранный режим");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3H4v5"></path>
        <path d="M15 3h5v5"></path>
        <path d="M9 21H4v-5"></path>
        <path d="M15 21h5v-5"></path>
        <path d="M4 4l6 6"></path>
        <path d="M20 4l-6 6"></path>
        <path d="M4 20l6-6"></path>
        <path d="M20 20l-6-6"></path>
      </svg>
    `;

    btn.addEventListener("click", this.handleFullscreenClick);
    this.startScreen.appendChild(btn);

    this.fullscreenBtn = btn;
    this.handleFullscreenChange();
  }

  positionFullscreenButton() {
    if (!this.startScreen || !this.startBtn || !this.fullscreenBtn) return;
    if (!this.startScreen.classList.contains("show")) return;

    const startRect = this.startBtn.getBoundingClientRect();
    const fsRect = this.fullscreenBtn.getBoundingClientRect();

    const gap = Math.max(10, Math.min(18, window.innerWidth * 0.012));

    let left = startRect.right + gap;
    let top = startRect.top + (startRect.height - fsRect.height) / 2;

    const minLeft = 8;
    const maxLeft = window.innerWidth - fsRect.width - 8;
    const minTop = 8;
    const maxTop = window.innerHeight - fsRect.height - 8;

    left = Math.min(Math.max(left, minLeft), maxLeft);
    top = Math.min(Math.max(top, minTop), maxTop);

    this.fullscreenBtn.style.left = `${left}px`;
    this.fullscreenBtn.style.top = `${top}px`;
  }

  scheduleFullscreenHint() {
    if (!this.fullscreenBtn || this.fullscreenElement) return;

    clearTimeout(this.fullscreenHintTimer);
    clearTimeout(this.fullscreenHintCleanupTimer);

    this.fullscreenBtn.classList.remove("hint-pulse");

    this.fullscreenHintTimer = setTimeout(() => {
      if (!this.fullscreenBtn || !this.startScreen?.classList.contains("show")) return;
      if (this.fullscreenElement) return;

      this.fullscreenBtn.classList.remove("hint-pulse");
      void this.fullscreenBtn.offsetWidth;
      this.fullscreenBtn.classList.add("hint-pulse");

      this.fullscreenHintCleanupTimer = setTimeout(() => {
        this.fullscreenBtn?.classList.remove("hint-pulse");
      }, 3000);
    }, 1000);
  }

  async handleStartClick() {
    try {
      await this.audio.init();
    } catch (e) {
      console.warn("Audio init skipped", e);
    }

    if (!this.audio.ambientStarted) {
      this.audio.startAmbient();
    }

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
    }

    if (this.rotateHint) {
      this.rotateHint.classList.toggle("show", !this.isLandscape);
    }

    await this.sceneManager.next();
  }

  async enter() {
    this.removeIntroFallback();
    this.ensureFullscreenButton();

    if (this.startScreen) {
      this.startScreen.classList.add("show");
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.positionFullscreenButton();
      });
    });

    this.scheduleFullscreenHint();

    this.startBtn?.addEventListener("click", this.handleStartClick);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange);
    window.addEventListener("resize", this.handleLayoutUpdate);
  }

  async exit() {
    this.startBtn?.removeEventListener("click", this.handleStartClick);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this.handleFullscreenChange);
    window.removeEventListener("resize", this.handleLayoutUpdate);

    clearTimeout(this.fullscreenHintTimer);
    clearTimeout(this.fullscreenHintCleanupTimer);

    if (this.fullscreenBtn) {
      this.fullscreenBtn.removeEventListener("click", this.handleFullscreenClick);
      this.fullscreenBtn.classList.remove("hint-pulse");
    }

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
    }
  }
}