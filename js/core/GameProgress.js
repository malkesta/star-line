export class GameProgress {
  constructor() {
    this.reset();
  }

  reset() {
    this.sceneResults = [];
  }

  recordSceneResult(result) {
    if (!result || !result.sceneId) return;

    const existingIndex = this.sceneResults.findIndex(
      (item) => item.sceneId === result.sceneId
    );

    const payload = {
      sceneId: result.sceneId,
      score: result.score ?? 0,
      savedCount: result.savedCount ?? 0,
      lostCount: result.lostCount ?? 0,
      levelPassed: Boolean(result.levelPassed),
      levelTargetScore: result.levelTargetScore ?? 0,
      sceneRank: result.sceneRank ?? 0,
    };

    if (existingIndex >= 0) {
      this.sceneResults[existingIndex] = payload;
      return;
    }

    this.sceneResults.push(payload);
  }

  getSceneRanks() {
    return this.sceneResults.map((item) => item.sceneRank ?? 0);
  }

  getAverageRankValue() {
    const ranks = this.getSceneRanks();

    if (!ranks.length) return 0;

    const sum = ranks.reduce((acc, value) => acc + value, 0);
    return sum / ranks.length;
  }

  getFinalRank() {
    const average = this.getAverageRankValue();

    if (average >= 2.5) return 3;
    if (average >= 1.5) return 2;
    if (average >= 0.5) return 1;
    return 0;
  }

  getFinalRankLabel() {
    const finalRank = this.getFinalRank();

    switch (finalRank) {
      case 3:
        return "S";
      case 2:
        return "A";
      case 1:
        return "B";
      default:
        return "C";
    }
  }

  getFinalAchievement() {
    const finalRank = this.getFinalRank();

    switch (finalRank) {
      case 3:
        return "Хранитель созвездий";
      case 2:
        return "Собиратель света";
      case 1:
        return "Юный проводник";
      default:
        return "Первый луч";
    }
  }

  getSummary() {
    return {
      sceneResults: [...this.sceneResults],
      averageRankValue: this.getAverageRankValue(),
      finalRank: this.getFinalRank(),
      finalRankLabel: this.getFinalRankLabel(),
      finalAchievement: this.getFinalAchievement(),
    };
  }
}