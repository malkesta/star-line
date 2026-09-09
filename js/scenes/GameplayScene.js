import { BaseScene } from "./BaseScene.js";
import { StarLineGame, GameAudio } from "../legacy/StarLineGame.js";

export class GameplayScene extends BaseScene {
  constructor({ sceneManager, audio } = {}) {
    super({ sceneManager });
    this.audio = audio ?? new GameAudio();
    this.game = null;
  }

  /*
    Создаёт StarLineGame заранее и готовит его визуальное состояние
    (фон, homeStar, starlets, один нарисованный кадр) — но НЕ запускает
    игровой цикл и не трогает аудио. Вызывается SceneManager.preloadNext()
    пока пользователь ещё смотрит финальный экран VN.
  */
  preload() {
    if (this.game) return;

    this.game = new StarLineGame({
      audio: this.audio,
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
    /*
      Если сцена уже была предзагружена через preload(), this.game
      уже существует и полностью готов визуально — не создаём его
      заново, чтобы не терять уже отрисованный кадр и не запускать
      двойную инициализацию.
    */
    if (!this.game) {
      this.game = new StarLineGame({
        audio: this.audio,
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

  /*
    Вызывается SceneManager.discardPreloaded(), если подготовленная
    сцена была создана, но в итоге не понадобилась (например, если
    пользователь вышел из VN другим путём). Уничтожает StarLineGame,
    чтобы не оставить висящие RAF/слушатели событий.
  */
  destroy() {
    this.game?.destroy?.();
    this.game = null;
  }
}