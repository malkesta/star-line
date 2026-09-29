import { SceneManager } from "./core/SceneManager.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { StartScreenScene } from "./scenes/StartScreenScene.js";
import { GameplayScene } from "./scenes/GameplayScene.js";
import { GameplayScene2 } from "./scenes/GameplayScene2.js";
import { GameplayScene3 } from "./scenes/GameplayScene3.js";
import { GameplayScene4 } from "./scenes/GameplayScene4.js";
import { GameplayScene5 } from "./scenes/GameplayScene5.js";
import { GameplayScene6 } from "./scenes/GameplayScene6.js";
import { GameplayScene7 } from "./scenes/GameplayScene7.js";
import { GameplayScene8 } from "./scenes/GameplayScene8.js";
import { GameplayScene9 } from "./scenes/GameplayScene9.js";
import { GameplayScene10 } from "./scenes/GameplayScene10.js";
import { VisualNovelStart } from "./scenes/VisualNovelStart.js";
import { VisualNovel1 } from "./scenes/VisualNovel1.js";
import { VisualNovel2 } from "./scenes/VisualNovel2.js";
import { VisualNovel3 } from "./scenes/VisualNovel3.js";
import { VisualNovel4 } from "./scenes/VisualNovel4.js";
import { VisualNovelFin } from "./scenes/VisualNovelFin.js";
import { FinalReplayScene } from "./scenes/FinalReplayScene.js";
import { CampaignResults } from "./core/CampaignResults.js";
import { GameAudio } from "./legacy/StarLineGame.js";

const DEBUG_START_SCENE =  null;
// В режиме дебага показываем локальную панель производительности.
// В обычном запуске она не создаётся и не влияет на игру.
globalThis.__starLineDebugMetrics = Boolean(DEBUG_START_SCENE);
// null       -> обычный порядок
// "intro"    -> только IntroScene
// "start"    -> только StartScreenScene
// "vnStart"  -> только VisualNovelStart
// "game1"    -> только GameplayScene
// "game2"    -> только GameplayScene2
// "vn1"      -> только VisualNovel1
// "game3"    -> только GameplayScene3
// "game4"    -> только GameplayScene4
// "vn2"      -> только VisualNovel2
// "game5"    -> только GameplayScene5
// "game6"    -> только GameplayScene6
// "vn3"      -> только VisualNovel3
// "game7"    -> только GameplayScene7
// "game8"    -> только GameplayScene8
// "vn4"      -> только VisualNovel4
// "game9"    -> только GameplayScene9
// "game10"   -> только GameplayScene10
// "vnFin"    -> только VisualNovelFin
// "finalReplay" -> финальный экран с тестовыми рангами и перепрохождением

const audio = new GameAudio();
const campaignResults = new CampaignResults();

// Только для удобной отладки финала. В обычной игре эти данные никогда не
// создаются и не сохраняются.
const DEBUG_FINAL_REPLAY_RESULTS = Object.freeze([
  ["game1", 3], ["game2", 2], ["game3", 1], ["game4", 3], ["game5", 2],
  ["game6", 3], ["game7", 1], ["game8", 2], ["game9", 3], ["game10", 2],
]);

if (DEBUG_START_SCENE === "finalReplay") {
  DEBUG_FINAL_REPLAY_RESULTS.forEach(([sceneId, sceneRank]) => {
    campaignResults.record({ sceneId, sceneRank, levelPassed: true });
  });
}

const sceneManager = new SceneManager({
  sceneDefs: [],
});

const createSceneDef = (id, create) => ({ id, create });

const gameplayOptions = ({ finalReplaySession, replayNavigator } = {}) => ({
  sceneManager: replayNavigator ?? sceneManager,
  audio,
  onRoundFinished: (result) => {
    (finalReplaySession ?? campaignResults).record(result);
  },
  onNext: async () => {
    if (finalReplaySession) {
      await sceneManager.returnFromFinalReplay();
      return;
    }
    await sceneManager.next();
  },
});

const allSceneDefs = {
  intro: createSceneDef("intro", () => new IntroScene({ sceneManager })),

  start: createSceneDef(
    "start",
    () => new StartScreenScene({
      sceneManager,
      audio,
      onNewRun: () => campaignResults.reset(),
    })
  ),

  vnStart: createSceneDef(
    "vnStart",
    () => new VisualNovelStart({ sceneManager, audio })
  ),

  game1: createSceneDef(
    "game1",
    (options) => new GameplayScene(gameplayOptions(options))
  ),

  game2: createSceneDef(
    "game2",
    (options) => new GameplayScene2(gameplayOptions(options))
  ),

  vn1: createSceneDef(
    "vn1",
    () => new VisualNovel1({ sceneManager, audio })
  ),

  game3: createSceneDef(
    "game3",
    (options) => new GameplayScene3(gameplayOptions(options))
  ),

  game4: createSceneDef(
    "game4",
    (options) => new GameplayScene4(gameplayOptions(options))
  ),

  vn2: createSceneDef(
    "vn2",
    () => new VisualNovel2({ sceneManager, audio })
  ),

  game5: createSceneDef(
    "game5",
    (options) => new GameplayScene5(gameplayOptions(options))
  ),

  game6: createSceneDef(
    "game6",
    (options) => new GameplayScene6(gameplayOptions(options))
  ),

  vn3: createSceneDef(
    "vn3",
    () => new VisualNovel3({ sceneManager, audio })
  ),

  game7: createSceneDef(
    "game7",
    (options) => new GameplayScene7(gameplayOptions(options))
  ),

  game8: createSceneDef(
    "game8",
    (options) => new GameplayScene8(gameplayOptions(options))
  ),

  vn4: createSceneDef(
    "vn4",
    () => new VisualNovel4({ sceneManager, audio })
  ),

  game9: createSceneDef(
    "game9",
    (options) => new GameplayScene9(gameplayOptions(options))
  ),

  game10: createSceneDef(
    "game10",
    (options) => new GameplayScene10(gameplayOptions(options))
  ),

  vnFin: createSceneDef(
    "vnFin",
    () => new VisualNovelFin({ sceneManager, audio })
  ),

  finalReplay: createSceneDef(
    "finalReplay",
    () => new FinalReplayScene({ sceneManager, campaignResults })
  ),
};

/*
  Полный маршрут игры: intro/start — вступление, дальше чередование
  VN-эпизодов и игровых уровней согласно сюжету, и vnFin в самом конце.
*/
const defaultSceneOrder = [
  allSceneDefs.intro,
  allSceneDefs.start,
  allSceneDefs.vnStart,
  allSceneDefs.game1,
  allSceneDefs.game2,
  allSceneDefs.vn1,
  allSceneDefs.game3,
  allSceneDefs.game4,
  allSceneDefs.vn2,
  allSceneDefs.game5,
  allSceneDefs.game6,
  allSceneDefs.vn3,
  allSceneDefs.game7,
  allSceneDefs.game8,
  allSceneDefs.vn4,
  allSceneDefs.game9,
  allSceneDefs.game10,
  allSceneDefs.vnFin,
  allSceneDefs.finalReplay,
];

const finalReplayDebugSceneOrder = [
  allSceneDefs.finalReplay,
  allSceneDefs.game1,
  allSceneDefs.game2,
  allSceneDefs.game3,
  allSceneDefs.game4,
  allSceneDefs.game5,
  allSceneDefs.game6,
  allSceneDefs.game7,
  allSceneDefs.game8,
  allSceneDefs.game9,
  allSceneDefs.game10,
];

if (DEBUG_START_SCENE) {
  document.getElementById("introCinematic")?.classList.add("hidden");
  document.getElementById("introFrame1")?.classList.remove("show");
  document.getElementById("introFrame2")?.classList.remove("show");
  document.getElementById("startScreen")?.classList.remove("show");
}

sceneManager.sceneDefs =
  DEBUG_START_SCENE === "finalReplay"
    ? finalReplayDebugSceneOrder
    : DEBUG_START_SCENE && allSceneDefs[DEBUG_START_SCENE]
    ? [allSceneDefs[DEBUG_START_SCENE]]
    : defaultSceneOrder;

if (
  DEBUG_START_SCENE &&
  DEBUG_START_SCENE !== "vnStart" &&
  DEBUG_START_SCENE !== "vn1" &&
  DEBUG_START_SCENE !== "vn2" &&
  DEBUG_START_SCENE !== "vn3" &&
  DEBUG_START_SCENE !== "vn4" &&
  DEBUG_START_SCENE !== "vnFin" &&
  DEBUG_START_SCENE !== "finalReplay"
) {
  try {
    await audio.init();
  } catch (error) {
    console.warn("Audio init skipped", error);
  }

  if (!audio.musicStarted) {
    audio.startAmbient();
  }
}

await sceneManager.start();
