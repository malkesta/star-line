import { VisualNovelScene } from "./VisualNovelScene.js";

const asset = (path) => new URL(path, import.meta.url).href;

const BACKGROUND_URL = asset(
  "../../assets/images/vn/vn_backgrounds/vn-start-clouds.webp"
);
const MUSIC_URL = asset("../../assets/audio/vn/VN-1.mp3");

export class VisualNovelStart extends VisualNovelScene {
  constructor(options = {}) {
    super({
      ...options,
      sceneId: "vn-start",
      musicUrl: MUSIC_URL,
      sprites: {},
      startNode: "intro",
      nodes: {
        intro: {
          speaker: "...",
          text: "В холодном космосе бесконечно мчатся звёзды.",
          bg: BACKGROUND_URL,
          next: "stories",
        },
        stories: {
          speaker: "...",
          text: "Они торопятся светить и жить. И создавать новые сказки.",
          bg: BACKGROUND_URL,
          next: "earth",
        },
        earth: {
          speaker: "...",
          text: "Но самые удивительные истории случаются с ними на Земле.",
          bg: BACKGROUND_URL,
          next: "ending",
        },
        ending: {
          speaker: "...",
          text: "С ними. И с теми, кто чертит им путь.",
          bg: BACKGROUND_URL,
          last: true,
          resultTitle: "История начинается",
          resultMessage: "",
        },
      },
    });
  }
}
