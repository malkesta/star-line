import assert from "node:assert/strict";
import { test } from "node:test";
import { StarLineGame } from "../js/legacy/StarLineGame.js";
import { GameplayScene2 } from "../js/scenes/GameplayScene2.js";
import { GameplayScene3 } from "../js/scenes/GameplayScene3.js";
import { GameplayScene4 } from "../js/scenes/GameplayScene4.js";
import { GameplayScene5 } from "../js/scenes/GameplayScene5.js";
import { GameplayScene6 } from "../js/scenes/GameplayScene6.js";
import { GameplayScene7 } from "../js/scenes/GameplayScene7.js";
import { GameplayScene8 } from "../js/scenes/GameplayScene8.js";
import { GameplayScene9 } from "../js/scenes/GameplayScene9.js";
import { GameplayScene10 } from "../js/scenes/GameplayScene10.js";

const lightLabels = ["Юный проводник", "Проводник звезд", "Звездочет", "Космический друг"];
const darkLabels = ["Наблюдатель", "Ведущий к тьме", "Пожиратель", "Космический враг"];
const scenes = [
  [StarLineGame, [150, 600, 900], lightLabels], [GameplayScene2, [200, 600, 900], lightLabels],
  [GameplayScene3, [400, 600, 900], lightLabels], [GameplayScene4, [400, 600, 900], lightLabels],
  [GameplayScene5, [300, 400, 500], lightLabels], [GameplayScene6, [400, 500, 600], lightLabels],
  [GameplayScene7, [400, 600, 800], darkLabels], [GameplayScene8, [400, 500, 550], darkLabels],
  [GameplayScene9, [400, 500, 600], lightLabels], [GameplayScene10, [100, 150, 200], lightLabels],
];

test("fixed game states keep the same rank and final-screen label", () => {
  for (const [Scene, [one, two, three], labels] of scenes) {
    const rankFor = (score, levelPassed) => Scene.prototype.getSceneRank.call({
      score,
      levelPassed,
      getRankThresholds: () => ({ oneMedalScore: one, twoMedalScore: two, threeMedalScore: three }),
    });
    assert.equal(rankFor(one - 1, true), 0, `${Scene.name}: below first rank`);
    assert.equal(rankFor(one, true), 1, `${Scene.name}: first rank`);
    assert.equal(rankFor(two, true), 2, `${Scene.name}: second rank`);
    assert.equal(rankFor(three, true), 3, `${Scene.name}: third rank`);
    assert.equal(rankFor(three + 1000, false), 0, `${Scene.name}: failed run`);
    labels.forEach((label, rank) => {
      assert.equal(Scene.prototype.getSceneRankLabel.call({}, rank), label, `${Scene.name}: rank ${rank} label`);
    });
  }
});
