import { SceneManager } from "./core/SceneManager.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { StartScreenScene } from "./scenes/StartScreenScene.js";
import { GameplayScene } from "./scenes/GameplayScene.js";
import { GameplayScene2 } from "./scenes/GameplayScene2.js";
import { GameplayScene3 } from "./scenes/GameplayScene3.js";
import { GameplayScene4 } from "./scenes/GameplayScene4.js";
import { GameplayScene5 } from "./scenes/GameplayScene5.js";
import { GameAudio } from "./legacy/StarLineGame.js";

const DEBUG_START_SCENE = null;
// null    -> обычный порядок
// "intro" -> только IntroScene
// "start" -> только StartScreenScene
// "game1" -> только GameplayScene
// "game2" -> только GameplayScene2
// "game3" -> только GameplayScene3
// "game4" -> только GameplayScene4
// "game5" -> только GameplayScene5

const audio = new GameAudio();

const sceneManager = new SceneManager({
  scenes: [],
});

const allScenes = {
  intro: new IntroScene({ sceneManager }),
  start: new StartScreenScene({ sceneManager, audio }),
  game1: new GameplayScene({ sceneManager, audio }),
  game2: new GameplayScene2({ sceneManager, audio }),
  game3: new GameplayScene3({ sceneManager, audio }),
  game4: new GameplayScene4({ sceneManager, audio }),
  game5: new GameplayScene5({ sceneManager, audio }),
};

const defaultSceneOrder = [
  allScenes.intro,
  allScenes.start,
  allScenes.game1,
  allScenes.game2,
  allScenes.game3,
  allScenes.game4,
  allScenes.game5,
];

if (DEBUG_START_SCENE) {
  document.getElementById("introCinematic")?.classList.add("hidden");
  document.getElementById("introFrame1")?.classList.remove("show");
  document.getElementById("introFrame2")?.classList.remove("show");
  document.getElementById("startScreen")?.classList.remove("show");
}

sceneManager.scenes =
  DEBUG_START_SCENE && allScenes[DEBUG_START_SCENE]
    ? [allScenes[DEBUG_START_SCENE]]
    : defaultSceneOrder;

if (DEBUG_START_SCENE) {
  try {
    await audio.init();
  } catch (e) {
    console.warn("Audio init skipped", e);
  }

  if (!audio.ambientStarted) {
    audio.startAmbient();
  }
}

await sceneManager.start();