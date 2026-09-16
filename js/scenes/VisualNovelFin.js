import { VisualNovelScene } from "./VisualNovelScene.js";

const asset = (path) => new URL(path, import.meta.url).href;
const BACKGROUND_URL = asset("../../assets/images/vn/vn_backgrounds/test-stars.png");
const MUSIC_URL = asset("../../assets/audio/vn/VN-1.mp3");

export class VisualNovelFin extends VisualNovelScene {
  constructor(options = {}) {
    super({
      ...options,
      sceneId: "vn-fin",
      musicUrl: MUSIC_URL,
      sprites: {},
      startNode: "epilogue",
      nodes: {
        epilogue: {
          speaker: "...",
          text: "Каждую ночь гаснут и загораются звезды. Они летят сквозь холодную черную пустоту и светят изо всех сил. Ведь есть те, кто рисует им путь. И те, с кем они делятся теплом.",
          bg: BACKGROUND_URL,
          sprites: {},
          last: true,
          resultTitle: "Конец.",
          resultMessage: "Автор Ольга Куран.",
        },
      },
    });
  }
}
