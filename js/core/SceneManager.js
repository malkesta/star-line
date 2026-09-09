import { GameProgress } from "./GameProgress.js";

export class SceneManager {
  constructor({ sceneDefs = [] } = {}) {
    this.sceneDefs = sceneDefs;
    this.currentIndex = -1;
    this.currentScene = null;
    this.gameProgress = new GameProgress();

    /*
      Заранее подготовленная (но не запущенная) следующая сцена.
      Используется, чтобы визуальные объекты сцены (фон, canvas,
      игровые сущности) были готовы ДО того, как VN завершит показ
      финального экрана — тогда переход происходит без видимой
      задержки инициализации.
    */
    this.preloadedScene = null;
    this.preloadedIndex = -1;
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
    this.discardPreloaded();

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
    this.discardPreloaded();

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
    this.discardPreloaded();

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

  getNextSceneDef() {
    const nextIndex = this.currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= this.sceneDefs.length) {
      return null;
    }

    return this.sceneDefs[nextIndex] ?? null;
  }

  /*
    Создаёт следующую сцену заранее и вызывает у неё preload(), если
    метод существует. Сцена НЕ становится активной и НЕ запускает
    свой игровой цикл/аудио — просто готовит фон, canvas и объекты,
    пока пользователь ещё смотрит на предыдущий экран (например,
    финальный экран визуальной новеллы).
  */
  preloadNext() {
    this.discardPreloaded();

    const nextIndex = this.currentIndex + 1;
    const sceneDef = this.sceneDefs[nextIndex];

    if (!sceneDef || typeof sceneDef.create !== "function") {
      return null;
    }

    const scene = sceneDef.create();

    if (!scene) {
      return null;
    }

    if (typeof scene.preload === "function") {
      try {
        scene.preload();
      } catch (error) {
        console.warn("[SceneManager] preload failed", error);
      }
    }

    this.preloadedScene = scene;
    this.preloadedIndex = nextIndex;

    return scene;
  }

  /*
    Отменяет заранее подготовленную сцену без активации — используется,
    когда переход пошёл по другому пути (обычный next()/goTo()), чтобы
    не оставить "осиротевший" объект сцены.
  */
  discardPreloaded() {
    if (this.preloadedScene && typeof this.preloadedScene.destroy === "function") {
      try {
        this.preloadedScene.destroy();
      } catch (error) {
        console.warn("[SceneManager] discardPreloaded failed", error);
      }
    }

    this.preloadedScene = null;
    this.preloadedIndex = -1;
  }

  /*
    Активирует ранее подготовленную сцену вместо создания новой.
    Обязательно вызывается ПОСЛЕ того, как текущая сцена (например,
    VN) вызвала свой exit(). Использует тот же enter(), что и обычный
    переход, поэтому сцена доводит себя до полностью рабочего
    состояния (аудио, RAF-цикл) — но визуальная подготовка уже
    случилась заранее, поэтому эта часть происходит мгновенно.
  */
  async activatePreloaded() {
    if (!this.preloadedScene) {
      await this.next();
      return;
    }

    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    this.currentIndex = this.preloadedIndex;
    this.currentScene = this.preloadedScene;

    this.preloadedScene = null;
    this.preloadedIndex = -1;

    await this.currentScene.enter();
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
