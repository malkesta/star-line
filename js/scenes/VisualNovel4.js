import { VisualNovelScene } from "./VisualNovelScene.js";
const asset = (path) => new URL(path, import.meta.url).href;
const BG = { story: asset("../../assets/images/vn/vn_backgrounds/test-stars.png"), room: asset("../../assets/images/vn/vn_backgrounds/test-night.png") };
const MUSIC = asset("../../assets/audio/vn/VN-1.mp3");
const GIRL = asset("../../assets/images/vn/sprites/girl/neutral.png");
const STAR = asset("../../assets/images/vn/sprites/star/neutral.png");
export class VisualNovel4 extends VisualNovelScene {
  constructor(options = {}) { super({ ...options, sceneId: "vn-4", musicUrl: MUSIC, sprites: { girl: { src: GIRL, alt: "Девочка — временный спрайт" }, star: { src: STAR, alt: "Звезда — временный спрайт" } }, startNode: "intro", nodes: {
    intro: {
      speaker: "...",
      text: "Шли дни. Девочка ходила в школу, слушала маму с папой. И внутри у неё было тихо и темно.",
      bg: BG.story,
      sprites: {},
      next: "stars"
    },
    stars: {
      speaker: "...",
      text: "Звёзды не прилетали, и она старалась не смотреть на небо.",
      bg: BG.story,
      sprites: {},
      next: "dust"
    },
    dust: {
      speaker: "...",
      text: "Никто её больше не трогал, и её ничто больше не трогало. Будто всё внутри покрыла холодная космическая пыль.",
      bg: BG.story,
      sprites: {},
      next: "sleep"
    },
    sleep: {
      speaker: "...",
      text: "А ночами она просто спала.",
      bg: BG.story,
      sprites: {},
      next: "window"
    },
    window: {
      speaker: "...",
      text: "Но потом как-то раз зажигала фонарь, и выглянула в окно. Там был след от падающей звезды.",
      bg: BG.room,
      sprites: {},
      next: "cried"
    },
    cried: {
      speaker: "...",
      text: "И девочка вдруг расплакалась.",
      bg: BG.room,
      sprites: { girl: true },
      next: "choice"
    },
    choice: {
      speaker: "",
      text: "",
      bg: BG.room,
      sprites: { girl: true },
      choiceLabel: "Что со мной?",
      choices: [
        { label: "Мне больно?", next: "quiet" },
        { label: "Это одиночество?", next: "hear" }
      ]
    },
    quiet: {
      speaker: "...",
      text: "Девочка позвала тихо-тихо. Будто боялась, что кто-нибудь услышит.",
      bg: BG.room,
      sprites: { girl: true },
      next: "here"
    },
    here: {
      speaker: "Девочка",
      text: "Звезда? Ты здесь?",
      bg: BG.room,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "noAnswer1"
    },
    noAnswer1: {
      speaker: "...",
      text: "Но ей никто не ответил.",
      bg: BG.room,
      sprites: { girl: true },
      next: "merge"
    },
    hear: {
      speaker: "Девочка",
      text: "Звезда? Ты меня слышишь?",
      bg: BG.room,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "noAnswer2"
    },
    noAnswer2: {
      speaker: "...",
      text: "Но ей никто не ответил.",
      bg: BG.room,
      sprites: { girl: true },
      next: "better"
    },
    better: {
      speaker: "Девочка",
      text: "Так, наверное, даже лучше. Чтобы ты не видела меня такой.",
      bg: BG.room,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "merge"
    },
    merge: {
      speaker: "Девочка",
      text: "Знаешь, а я думала, со мной этого не случится. Что я… не как те чёрные звёзды. Что я никогда не погасну.",
      bg: BG.room,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "cold"
    },
    cold: {
      speaker: "Звезда",
      text: "Тебе просто холодно. А когда кому-то холодно, он становится жестоким.",
      bg: BG.room,
      sprites: { girl: true, star: true },
      speakingSprite: "star",
      next: "forever"
    },
    forever: {
      speaker: "Девочка",
      text: "Я навсегда останусь такой? Смогу только разрушать?",
      bg: BG.room,
      sprites: { girl: true, star: true },
      speakingSprite: "girl",
      next: "hope"
    },
    hope: {
      speaker: "Звезда",
      text: "Даже для чёрных звёзд есть надежда. Если с ними поделиться теплом, они снова начнут сиять.",
      bg: BG.room,
      sprites: { girl: true, star: true },
      speakingSprite: "star",
      last: true,
      resultTitle: "История продолжается",
      resultMessage: ""
    },
  } }); }
}
