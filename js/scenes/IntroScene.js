import { BaseScene } from "./BaseScene.js";

export class IntroScene extends BaseScene {
  constructor(options = {}) {
    super(options);
    this.introCinematic = null;
    this.introFrame1 = null;
    this.introFrame2 = null;
    this.timers = [];
  }

  async enter() {
    this.introCinematic = document.getElementById("introCinematic");
    this.introFrame1 = document.getElementById("introFrame1");
    this.introFrame2 = document.getElementById("introFrame2");

    if (!this.introCinematic || !this.introFrame1 || !this.introFrame2) {
      await this.sceneManager.next();
      return;
    }

    this.introCinematic.classList.remove("hidden");
    this.introFrame1.classList.remove("dimmed");
    this.introFrame2.classList.remove("show");

    this.later(() => this.introFrame1.classList.add("dimmed"), 1000);
    this.later(() => this.introFrame2.classList.add("show"), 3200);
    this.later(async () => {
      this.introCinematic.classList.add("hidden");
      await this.sceneManager.next();
    }, 7700);
  }

  async exit() {
    this.clearTimers();
    if (this.introCinematic) {
      this.introCinematic.classList.add("hidden");
    }
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