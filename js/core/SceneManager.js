export class SceneManager {
  constructor({ scenes = [] } = {}) {
    this.scenes = scenes;
    this.currentIndex = -1;
    this.currentScene = null;
  }

  async start() {
    if (!this.scenes.length) {
      this.currentIndex = -1;
      this.currentScene = null;
      return;
    }

    this.currentIndex = 0;
    await this.enterCurrentScene();
  }

  async next() {
    if (this.currentScene) {
      await this.currentScene.exit();
    }

    const nextIndex = this.currentIndex + 1;

    if (nextIndex >= this.scenes.length) {
      this.currentIndex = this.scenes.length;
      this.currentScene = null;
      return;
    }

    this.currentIndex = nextIndex;
    await this.enterCurrentScene();
  }

  async goTo(index) {
    if (index < 0 || index >= this.scenes.length) {
      this.currentIndex = -1;
      this.currentScene = null;
      return;
    }

    if (this.currentScene) {
      await this.currentScene.exit();
    }

    this.currentIndex = index;
    await this.enterCurrentScene();
  }

  async enterCurrentScene() {
    const scene = this.scenes[this.currentIndex];

    if (!scene) {
      this.currentScene = null;
      return;
    }

    this.currentScene = scene;
    await this.currentScene.enter();
  }
}