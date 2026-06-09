import { BaseScene } from "./BaseScene.js";

export class IntroScene extends BaseScene {
  constructor(options = {}) {
    super(options);
    this.introCinematic = null;
    this.introFrame1 = null;
    this.introFrame2 = null;
    this.timers = [];
    this.introDisposed = false;
  }

  async enter() {
    this.introCinematic = document.getElementById("introCinematic");
    this.introFrame1 = document.getElementById("introFrame1");
    this.introFrame2 = document.getElementById("introFrame2");
    this.introDisposed = false;

    if (!this.introCinematic || !this.introFrame1 || !this.introFrame2) {
      await this.sceneManager.next();
      return;
    }

    this.introCinematic.classList.remove("hidden");
    this.introFrame1.classList.remove("dimmed");
    this.introFrame2.classList.remove("show");

    this.later(() => {
      if (this.introDisposed || !this.introFrame1) return;
      this.introFrame1.classList.add("dimmed");
    }, 1000);

    this.later(() => {
      if (this.introDisposed || !this.introFrame2) return;
      this.introFrame2.classList.add("show");
    }, 3200);

    this.later(async () => {
      this.disposeIntro();
      await this.sceneManager.next();
    }, 7700);
  }

  async exit() {
    this.disposeIntro();
  }

  disposeIntro() {
    if (this.introDisposed) return;
    this.introDisposed = true;

    this.clearTimers();

    if (this.introFrame1) {
      this.introFrame1.classList.remove("dimmed");
    }

    if (this.introFrame2) {
      this.introFrame2.classList.remove("show");
    }

    if (this.introCinematic) {
      this.introCinematic.classList.add("hidden");
      this.introCinematic.remove();
    }

    this.introCinematic = null;
    this.introFrame1 = null;
    this.introFrame2 = null;
  }

  later(fn, ms) {
    const id = setTimeout(fn, ms);
    this.timers.push(id);
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}