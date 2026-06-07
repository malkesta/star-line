import { BaseScene } from "./BaseScene.js";
import { StarLineGame, GameAudio } from "../legacy/StarLineGame.js";

export class GameplayScene extends BaseScene {
  constructor({ sceneManager, audio } = {}) {
    super({ sceneManager });
    this.audio = audio ?? new GameAudio();
    this.game = null;
  }

  async enter() {
    this.game = new StarLineGame({
      audio: this.audio,
      onNext: async () => {
        await this.sceneManager.next();
      },
      onRoundFinished: (result) => {
        console.log("Round finished:", result);
      },
    });

    this.game.start();
  }

  async exit() {
    this.game?.destroy?.();
    this.game = null;
  }
}