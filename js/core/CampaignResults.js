export const GAME_SCENE_IDS = Object.freeze([
  "game1", "game2", "game3", "game4", "game5",
  "game6", "game7", "game8", "game9", "game10",
]);

const isValidResult = (result) =>
  Boolean(result?.levelPassed) &&
  GAME_SCENE_IDS.includes(result?.sceneId) &&
  Number.isInteger(result?.sceneRank) &&
  result.sceneRank >= 1 &&
  result.sceneRank <= 3;

const copyResult = (result) => ({
  sceneId: result.sceneId,
  sceneRank: result.sceneRank,
  levelPassed: true,
});

// Реестр только текущего сюжетного прохождения. Он хранит простые числа,
// не знает о DOM, анимациях и не пишет ничего в localStorage.
export class CampaignResults {
  constructor() {
    this.reset();
  }

  reset() {
    this.results = new Map();
  }

  record(result) {
    if (!isValidResult(result)) return false;
    this.results.set(result.sceneId, copyResult(result));
    return true;
  }

  snapshot() {
    return GAME_SCENE_IDS
      .map((sceneId) => this.results.get(sceneId))
      .filter(Boolean)
      .map(copyResult);
  }
}

export class FinalReplaySession {
  constructor(initialResults = []) {
    this.results = new Map();
    initialResults.forEach((result) => this.record(result));
  }

  record(result) {
    if (!isValidResult(result)) return false;
    this.results.set(result.sceneId, copyResult(result));
    return true;
  }

  getLevelResults() {
    return GAME_SCENE_IDS.map((sceneId) => this.results.get(sceneId) ?? {
      sceneId,
      sceneRank: 0,
    });
  }

  getSummary() {
    const completed = this.getLevelResults().filter(({ sceneRank }) => sceneRank > 0);
    const totalRank = completed.reduce((sum, { sceneRank }) => sum + sceneRank, 0);
    return {
      completedCount: completed.length,
      averageRank: completed.length ? totalRank / completed.length : 0,
    };
  }

  dispose() {
    this.results.clear();
  }
}
