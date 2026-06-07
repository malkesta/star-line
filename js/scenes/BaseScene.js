export class BaseScene {
  constructor({ sceneManager } = {}) {
    this.sceneManager = sceneManager;
  }

  async enter() {}

  async exit() {}
}