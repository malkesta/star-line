import { BaseScene } from "./BaseScene.js";
import { StarLineGame, GameAudio } from "../legacy/StarLineGame.js";

const asset = (path) => new URL(path, import.meta.url).href;

export class GameplayScene extends BaseScene {
  constructor({ sceneManager, audio } = {}) {
    super({ sceneManager });
    this.audio = audio ?? new GameAudio();
    this.game = null;
    this.musicUrl = asset("../../assets/audio/game1.mp3");
  }

  preload() {
    if (this.game) return;

    this.game = new StarLineGame({
      audio: this.audio,
      musicUrl: this.musicUrl,
      onNext: async () => {
        await this.sceneManager.next();
      },
      onRoundFinished: (result) => {
        console.log("Round finished:", result);
      },
    });

    if (typeof this.game.preload === "function") {
      this.game.preload();
    }
  }

  async enter() {
    if (!this.game) {
      this.game = new StarLineGame({
        audio: this.audio,
        musicUrl: this.musicUrl,
        onNext: async () => {
          await this.sceneManager.next();
        },
        onRoundFinished: (result) => {
          console.log("Round finished:", result);
        },
      });
    }

    this.game.start();
  }

  async exit() {
    this.game?.destroy?.();
    this.game = null;
  }

  destroy() {
    this.game?.destroy?.();
    this.game = null;
  }
}