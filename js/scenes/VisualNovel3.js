import { VisualNovelScene } from "./VisualNovelScene.js";
const asset = (path) => new URL(path, import.meta.url).href;

const BACKGROUNDS = {
  night: asset("../../assets/images/vn/vn_backgrounds/test-night.png"),
  stars: asset("../../assets/images/vn/vn_backgrounds/test-stars.png"),
};

const MUSIC_URL = asset("../../assets/audio/vn/VN-1.mp3");

export class VisualNovel3 extends VisualNovelScene {
  constructor(options = {}) {
    super({
      ...options,

      sceneId: "vn-test",
      musicUrl: MUSIC_URL,   // ← этой строки не было

      sprites: {
        girl: {
          src: asset("../../assets/images/vn/sprites/girl/neutral.png"),
          alt: "Девочка",
        },

        star: {
          src: asset("../../assets/images/vn/sprites/star/neutral.png"),
          alt: "Звезда",
        },
      },

      startNode: "intro",

      nodes: {
        intro: {
          speaker: "",
          text: "Ночь была тихой. Но одна маленькая звезда всё ещё не знала дороги домой.",
          bg: BACKGROUNDS.night,
          sprites: {
            girl: false,
            star: false,
          },
          next: "girl",
        },

        girl: {
          speaker: "Девочка",
          text: "Не бойся. Я помогу тебе найти путь.",
          bg: BACKGROUNDS.night,
          sprites: {
            girl: true,
            star: false,
          },
          speakingSprite: "girl",
          next: "star",
        },

        star: {
          speaker: "Звезда",
          text: "Правда? Тогда скажи, куда мне смотреть.",
          bg: BACKGROUNDS.stars,
          sprites: {
            girl: true,
            star: true,
          },
          speakingSprite: "star",
          choiceLabel: "Что ответит девочка?",
          choices: [
            {
              label: "На свет большой звезды.",
              next: "light",
            },
            {
              label: "На рассвет за облаками.",
              next: "dawn",
            },
          ],
        },

        light: {
          speaker: "Девочка",
          text: "Смотри на свет. Он приведёт нас домой.",
          bg: BACKGROUNDS.stars,
          sprites: {
            girl: true,
            star: true,
          },
          speakingSprite: "girl",
          next: "ending",
        },

        dawn: {
          speaker: "Девочка",
          text: "Смотри вперёд. Даже самая длинная ночь заканчивается рассветом.",
          bg: BACKGROUNDS.stars,
          sprites: {
            girl: true,
            star: true,
          },
          speakingSprite: "girl",
          next: "ending",
        },

        ending: {
        speaker: "",
        text: "Звезда стала светиться чуть ярче. Путь только начинался.",
        bg: BACKGROUNDS.stars,
        sprites: {
          girl: false,
          star: true,
        },
        speakingSprite: "star",

        resultTitle: "История продолжается",
        resultMessage: "Маленькая звезда снова увидела свет.",

        last: true,
      },
      },
    });
  }
}