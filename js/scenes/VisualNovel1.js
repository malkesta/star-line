import { VisualNovelScene } from "./VisualNovelScene.js";

const asset = (path) => new URL(path, import.meta.url).href;

const BACKGROUNDS = {
  intro: asset("../../assets/images/vn/vn_backgrounds/test-night-gold.png"),
  hills: asset("../../assets/images/vn/vn_backgrounds/vn-1-bg.png"),
  stars: asset("../../assets/images/vn/vn_backgrounds/test-stars-gold.png"),
};
const MUSIC_URL = asset("../../assets/audio/vn/VN-1.mp3");
const PLACEHOLDER_GIRL = asset("../../assets/images/vn/sprites/girl/neutral.png");
const PLACEHOLDER_STAR = asset("../../assets/images/vn/sprites/star/neutral.png");

export class VisualNovel1 extends VisualNovelScene {
  constructor(options = {}) {
    super({
      ...options,
      sceneId: "vn-1",
      musicUrl: MUSIC_URL,
      sprites: {
        girl: {
          src: PLACEHOLDER_GIRL,
          alt: "Девочка — временный спрайт",
          visualScale: 1,
          viewportHeightRatio: 0.783,
        },
        star: {
          src: PLACEHOLDER_STAR,
          alt: "Звезда — временный спрайт",
          visualScale: 1,
        },
      },
      startNode: "intro",
      nodes: {
        intro: {
          speaker: "...",
          text: "Жила-была девочка, которая дружила со звёздами. Каждую ночь она смотрела в небо и чертила им путь.",
          bg: BACKGROUNDS.intro,
          sprites: {},
          next: "guides"
        },
        guides: {
          speaker: "...",
          text: "Она вела их сквозь пронзительную холодную темноту. И помогала избегать опасностей — голодных чёрных звёзд.",
          bg: BACKGROUNDS.intro,
          sprites: {},
          next: "visits"
        },
        visits: {
          speaker: "...",
          text: "Порой, спасённые звёзды прилетали к ней снова. Благодарить. Рассказывать, что видели в космосе и слушать сказки.",
          bg: BACKGROUNDS.intro,
          sprites: {},
          next: "asked"
        },
        asked: {
          speaker: "...",
          text: "И вот как-то раз, между первой сказкой и первым лучиком зари, девочка спросила.",
          bg: BACKGROUNDS.intro,
          sprites: {},
          next: "question"
        },
        question: {
          speaker: "",
          text: "",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          choiceLabel: "Никак не могу понять...",
          choices: [
            { label: "Откуда же берутся злые звёзды?", next: "darkStars" },
            { label: "Разве тебе не страшно летать в пустоте?", next: "afraid" }
          ]
        },
        darkStars: {
          speaker: "Звезда",
          text: "Они не злые, просто потухли. В каждом из нас есть крохотный светильник. А вокруг него чернота.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "darkMore"
        },
        darkMore: {
          speaker: "Звезда",
          text: "И когда свет слабеет, черноты всё больше и больше.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "blame"
        },
        blame: {
          speaker: "Девочка",
          text: "А я думаю, сами виноваты. Мало того, что почернели, так ещё и едят чужой свет.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "cold"
        },
        cold: {
          speaker: "Звезда",
          text: "Им просто очень холодно. А когда кому-то холодно, он бывает жестоким.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "never"
        },
        never: {
          speaker: "Девочка",
          text: "Зря ты их защищаешь. Вот я бы никогда не стала как они!",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "merge"
        },
        afraid: {
          speaker: "Звезда",
          text: "Очень страшно. В космосе холодно и жутко. И приходится лететь изо всех сил, и светить изо всех сил, чтобы не замёрзнуть.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "safety"
        },
        safety: {
          speaker: "Девочка",
          text: "Тогда почему не остаться где-нибудь? В безопасности.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "home"
        },
        home: {
          speaker: "Звезда",
          text: "Только так можно добраться домой.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "tired"
        },
        tired: {
          speaker: "Девочка",
          text: "Но что, если ты устанешь и больше не сможешь светить? Ты же замёрзнешь.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "born"
        },
        born: {
          speaker: "Звезда",
          text: "Так и рождаются чёрные звёзды. Они устают и гаснут.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "blackness"
        },
        blackness: {
          speaker: "Звезда",
          text: "И черноту внутри них больше нечему рассеивать.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "star",
          next: "dislike"
        },
        dislike: {
          speaker: "Девочка",
          text: "Они мне не нравятся. Едят чужой свет и только умеют, что разрушать.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "never2"
        },
        never2: {
          speaker: "Девочка",
          text: "Подумаешь, устали светить.",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "never3"
        },
        never3: {
          speaker: "Девочка",
          text: "Даже если я устану, я никогда не буду как они!",
          bg: BACKGROUNDS.hills,
          sprites: { girl: true, star: true },
          speakingSprite: "girl",
          next: "merge"
        },
        merge: {
          speaker: "...",
          text: "Девочка сказала это так решительно.\nОна была уверена, что звезда согласится. Они же дружили.",
          bg: BACKGROUNDS.stars,
          sprites: {},
          next: "mergeSilence"
        },
        mergeSilence: {
          speaker: "...",
          text: "Но та молчала, и в её молчании звенела грусть. Холод, какой бывает только в небе.",
          bg: BACKGROUNDS.stars,
          sprites: {},
          next: "mergeUnease"
        },
        mergeUnease: {
          speaker: "...",
          text: "А девочке впервые рядом со звездой вдруг стало не по себе.",
          bg: BACKGROUNDS.stars,
          sprites: {},
          last: true,
          resultTitle: "История продолжается",
          resultMessage: ""
        },
      },
    });
  }
}
