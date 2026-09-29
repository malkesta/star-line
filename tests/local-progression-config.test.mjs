import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const expected = new Map([
  ["GameplayScene.js", 1], ["GameplayScene2.js", 2], ["GameplayScene3.js", 4],
  ["GameplayScene4.js", 5], ["GameplayScene5.js", 7], ["GameplayScene6.js", 8],
  ["GameplayScene7.js", 10], ["GameplayScene8.js", 11], ["GameplayScene9.js", 13],
  ["GameplayScene10.js", 14],
]);

const rankThresholds = new Map([
  ["GameplayScene.js", [400, 600, 900]], ["GameplayScene2.js", [400, 600, 900]],
  ["GameplayScene3.js", [400, 600, 900]], ["GameplayScene4.js", [400, 600, 900]],
  ["GameplayScene5.js", [300, 400, 500]], ["GameplayScene6.js", [400, 500, 600]],
  ["GameplayScene7.js", [400, 600, 800]], ["GameplayScene8.js", [400, 500, 550]],
  ["GameplayScene9.js", [400, 500, 600]], ["GameplayScene10.js", [100, 150, 200]],
]);

test("every gameplay scene declares its own correct local progression position", () => {
  for (const [file, index] of expected) {
    const source = readFileSync(new URL(`../js/scenes/${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`progressionIndex:\\s*${index}|currentIndex:\\s*${index}`), file);
    const progressionOwner = file === "GameplayScene.js"
      ? readFileSync(new URL("../js/legacy/StarLineGame.js", import.meta.url), "utf8")
      : source;
    assert.match(progressionOwner, /resultProgression\.playSuccess\(\)/, `${file} success path`);
    assert.match(progressionOwner, /resultProgression\.playFailure\(\)/, `${file} failure path`);
    assert.match(progressionOwner, /rankSource:\s*this/, `${file} local rank thresholds`);
    assert.match(progressionOwner, /enableNextImmediately:\s*true/, `${file} immediate next button`);
  }
});

test("each gameplay scene uses its configured score thresholds for real rank calculation", () => {
  for (const [file, [one, two, three]] of rankThresholds) {
    const source = file === "GameplayScene.js"
      ? readFileSync(new URL("../js/legacy/StarLineGame.js", import.meta.url), "utf8")
      : readFileSync(new URL(`../js/scenes/${file}`, import.meta.url), "utf8");
    const method = source.match(/getRankThresholds\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
    assert.match(method, new RegExp(`oneMedalScore:\\s*${one}`), `${file} one medal`);
    assert.match(method, new RegExp(`twoMedalScore:\\s*${two}`), `${file} two medals`);
    assert.match(method, new RegExp(`threeMedalScore:\\s*${three}`), `${file} three medals`);
  }
});
