import test from "node:test";
import assert from "node:assert/strict";
import { CampaignResults, FinalReplaySession } from "../js/core/CampaignResults.js";
import { SceneManager } from "../js/core/SceneManager.js";
import { getShareCardMedalCount } from "../js/scenes/FinalReplayScene.js";

test("campaign records only confirmed successful gameplay results", () => {
  const campaign = new CampaignResults();
  assert.equal(campaign.record({ sceneId: "game1", levelPassed: false, sceneRank: 3 }), false);
  assert.equal(campaign.record({ sceneId: "vn1", levelPassed: true, sceneRank: 3 }), false);
  assert.equal(campaign.record({ sceneId: "game1", levelPassed: true, sceneRank: 2 }), true);
  assert.deepEqual(campaign.snapshot(), [{ sceneId: "game1", sceneRank: 2, levelPassed: true }]);
  assert.deepEqual(new FinalReplaySession(campaign.snapshot()).getSummary(), {
    completedCount: 1,
    averageRank: 2,
  });
});

test("final replay overwrites only its own temporary rank and ignores invalid data", () => {
  const session = new FinalReplaySession([{ sceneId: "game1", levelPassed: true, sceneRank: 1 }]);
  assert.equal(session.record({ sceneId: "game1", levelPassed: true, sceneRank: 3 }), true);
  assert.equal(session.record({ sceneId: "game2", levelPassed: false, sceneRank: 3 }), false);
  assert.deepEqual(session.getSummary(), { completedCount: 1, averageRank: 3 });
  assert.equal(session.getLevelResults().find(({ sceneId }) => sceneId === "game1").sceneRank, 3);
  session.dispose();
  assert.deepEqual(session.getSummary(), { completedCount: 0, averageRank: 0 });
});

test("final replay returns to its existing final scene without changing the route index", async () => {
  const calls = [];
  const finalScene = {
    suspend: () => calls.push("suspend"),
    resume: () => calls.push("resume"),
    enter: () => calls.push("final-enter"),
  };
  const replayScene = {
    enter: () => calls.push("replay-enter"),
    exit: () => calls.push("replay-exit"),
  };
  const manager = new SceneManager({
    sceneDefs: [
      { id: "game1", create: () => replayScene },
      { id: "final", create: () => finalScene },
    ],
  });
  manager.currentIndex = 1;
  manager.currentScene = finalScene;
  const session = new FinalReplaySession([{ sceneId: "game1", levelPassed: true, sceneRank: 1 }]);

  assert.equal(await manager.openFinalReplay("game1", session), true);
  assert.equal(manager.currentIndex, 1);
  assert.equal(await manager.returnFromFinalReplay(), true);
  assert.equal(manager.currentIndex, 1);
  assert.equal(manager.currentScene, finalScene);
  assert.deepEqual(calls, ["suspend", "replay-enter", "replay-exit", "resume"]);
});

test("share card turns the average rank into the requested medal count", () => {
  assert.equal(getShareCardMedalCount(2.0, 10), 1);
  assert.equal(getShareCardMedalCount(2.01, 10), 2);
  assert.equal(getShareCardMedalCount(2.69, 10), 2);
  assert.equal(getShareCardMedalCount(2.7, 10), 3);
  assert.equal(getShareCardMedalCount(3, 10), 3);
  assert.equal(getShareCardMedalCount(3, 0), 0);
});
