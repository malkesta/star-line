import { GameProgress } from "./GameProgress.js";

export class SceneManager {
  constructor({ sceneDefs = [] } = {}) {
    this.sceneDefs = sceneDefs;
    this.currentIndex = -1;
    this.currentScene = null;
    this.gameProgress = new GameProgress();
  }

  resetProgress() {
    this.gameProgress.reset();
  }

  getProgressSummary() {
    return this.gameProgress.getSummary();
  }

  async start() {
    if (!this.sceneDefs.length) {
      this.currentIndex = -1;
      this.currentScene = null;
      return;
    }

    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    this.currentIndex = 0;
    await this.enterCurrentScene();
  }

  async next() {
    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    const nextIndex = this.currentIndex + 1;

    if (nextIndex >= this.sceneDefs.length) {
      this.currentIndex = this.sceneDefs.length;
      this.currentScene = null;
      return;
    }

    this.currentIndex = nextIndex;
    await this.enterCurrentScene();
  }

  async goTo(index) {
    if (index < 0 || index >= this.sceneDefs.length) {
      if (this.currentScene) {
        await this.currentScene.exit();
        this.currentScene = null;
      }

      this.currentIndex = -1;
      return;
    }

    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    this.currentIndex = index;
    await this.enterCurrentScene();
  }

  async restartCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.sceneDefs.length) {
      return;
    }

    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    await this.enterCurrentScene();
  }

  getCurrentSceneDef() {
    if (this.currentIndex < 0 || this.currentIndex >= this.sceneDefs.length) {
      return null;
    }

    return this.sceneDefs[this.currentIndex] ?? null;
  }

  async enterCurrentScene() {
    const sceneDef = this.getCurrentSceneDef();

    if (!sceneDef || typeof sceneDef.create !== "function") {
      this.currentScene = null;
      return;
    }

    const scene = sceneDef.create();

    if (!scene) {
      this.currentScene = null;
      return;
    }

    this.currentScene = scene;
    await this.currentScene.enter();
  }
}