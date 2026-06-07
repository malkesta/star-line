export class StartScreenScene {
  constructor({ sceneManager, audio }) {
    this.sceneManager = sceneManager;
    this.audio = audio;

    this.startScreen = document.getElementById("startScreen");
    this.startBtn = document.getElementById("startBtn");
    this.rotateHint = document.getElementById("rotateHint");

    this.handleStartClick = this.handleStartClick.bind(this);
  }

  get isLandscape() {
    return window.innerWidth > window.innerHeight;
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
    if (this.startScreen) {
      this.startScreen.classList.add("show");
    }

    this.startBtn?.addEventListener("click", this.handleStartClick);
  }

  async exit() {
    this.startBtn?.removeEventListener("click", this.handleStartClick);

    if (this.startScreen) {
      this.startScreen.classList.remove("show");
    }
  }
}