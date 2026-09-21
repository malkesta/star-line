import { VisualNovelScene } from "./VisualNovelScene.js";
const asset = (path) => new URL(path, import.meta.url).href;
const BG = { story: asset("../../assets/images/vn/vn_backgrounds/vn-3_school1.png"), school: asset("../../assets/images/vn/vn_backgrounds/school_bg.png"), forest: asset("../../assets/images/vn/vn_backgrounds/test-night-gold.png") };
const MUSIC = asset("../../assets/audio/vn/VN-1.mp3");
const GIRL = asset("../../assets/images/vn/sprites/girl/girl_school.png");
const GIRL_ANGER = asset("../../assets/images/vn/sprites/girl/girl_school_anger.png");
const STAR = asset("../../assets/images/vn/sprites/star/neutral.png");
const BOY_CLASSMATE = asset("../../assets/images/vn/sprites/boy_classmate/boy.png");
const GIRL_CLASSMATE = asset("../../assets/images/vn/sprites/girl_classmate/girl_classmate.png");
export class VisualNovel3 extends VisualNovelScene {
  constructor(options = {}) { super({ ...options, sceneId: "vn-3", musicUrl: MUSIC, sprites: { girl: { src: GIRL, variants: { anger: GIRL_ANGER }, alt: "Девочка", visualScale: 1, viewportHeightRatio: 0.783, focusViewportHeightRatio: 1.2 }, star: { src: STAR, alt: "Звезда", visualScale: 1 }, boyClassmate: { src: BOY_CLASSMATE, alt: "Одноклассник", visualScale: 1, viewportHeightRatio: 0.9, focusViewportHeightRatio: 1.2 }, girlClassmate: { src: GIRL_CLASSMATE, alt: "Одноклассница", visualScale: 1, viewportHeightRatio: 0.9, focusViewportHeightRatio: 1.2 } }, startNode: "intro", nodes: {
    intro: {
      speaker: "...",
      text: "Девочка стала осторожнее. Она больше не говорила про звёзды ни маме, ни папе.",
      bg: BG.story,
      sprites: {},
      next: "introRoutes"
    },
    introRoutes: {
      speaker: "...",
      text: "Просто молча рисовала маршруты в небе каждый день. Даже когда уставала.",
      bg: BG.story,
      sprites: {},
      next: "fading"
    },
    fading: {
      speaker: "...",
      text: "Даже когда ей казалось: гаснет больше звёзд, чем спасается.",
      bg: BG.story,
      sprites: {},
      next: "school"
    },
    school: {
      speaker: "...",
      text: "Но однажды она пришла в школу и увидела большую дружную компанию. И решила:",
      bg: BG.school,
      sprites: {},
      next: "choice"
    },
    choice: {
      speaker: "",
      text: "",
      bg: BG.school,
      sprites: { girl: true },
      choiceLabel: "У них весело",
      choices: [
        { label: "Послушаю, о чём они говорят", next: "listen" },
        { label: "Подойду к ним", next: "approach" }
      ]
    },
    listen: {
      speaker: "...",
      text: "Но как только она подошла, услышала нечто странное.",
      bg: BG.school,
      sprites: {},
      next: "insult1"
    },
    insult1: {
      speaker: "Мальчик",
      text: "Да она тупая! Треплется, будто слушает звёзды! Совсем дурочка.",
      bg: BG.school,
      sprites: { boyClassmate: true, girlClassmate: true },
      speakingSprite: "boyClassmate",
      next: "insult2"
    },
    insult2: {
      speaker: "Другая девочка",
      text: "И вечно сидит в своей дурацкой книжке. Со странностями, в общем.",
      bg: BG.school,
      sprites: { boyClassmate: true, girlClassmate: true },
      speakingSprite: "girlClassmate",
      next: "freeze"
    },
    freeze: {
      speaker: "...",
      text: "Девочка замерла. Неужели они говорят про неё?Но она же не такая: не дурочка и не странная. И ей впервые стало стыдно — что она помогает звёздам.",
      bg: BG.school,
      sprites: {},
      next: "leave"
    },
    leave: {
      speaker: "Мальчик",
      text: "Эй, это ведь она! А ну иди отсюда, тупая! Нам тут такие не нужны.",
      bg: BG.school,
      sprites: { boyClassmate: true },
      speakingSprite: "boyClassmate",
      next: "stars"
    },
    stars: {
      speaker: "Мальчик",
      text: "Вали к своим звёздам!",
      bg: BG.school,
      sprites: { boyClassmate: true },
      speakingSprite: "boyClassmate",
      next: "run"
    },
    run: {
      speaker: "...",
      text: "Все засмеялись, а девочка бросилась бежать со всех ног.",
      bg: BG.school,
      sprites: {},
      next: "forest"
    },
    approach: {
      speaker: "Девочка",
      text: "Что обсуждаете?",
      bg: BG.school,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "hope"
    },
    hope: {
      speaker: "...",
      text: "Она думала, что ей обрадуются. Что её примут в компанию. Ведь ей нравилось дружить.",
      bg: BG.school,
      sprites: {},
      next: "insult3"
    },
    insult3: {
      speaker: "Мальчик",
      text: "А вот и эта. Эй, тупая, говорят, ты там со звёздами болтаешь.",
      bg: BG.school,
      sprites: { boyClassmate: true },
      speakingSprite: "boyClassmate",
      next: "paralyzed"
    },
    paralyzed: {
      speaker: "...",
      text: "Девочка оторопела. Будто парализовало — и стало так холодно, как не было даже в самую лютую зиму.",
      bg: BG.school,
      sprites: {},
      next: "stammer1"
    },
    stammer1: {
      speaker: "Девочка",
      text: "Я… я…",
      bg: BG.school,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "voice"
    },
    voice: {
      speaker: "...",
      text: "Она пыталась сказать, а голос не слушался.",
      bg: BG.school,
      sprites: {},
      next: "stammer2"
    },
    stammer2: {
      speaker: "Другая девочка",
      text: "Ещё и заика! Она потому всё это придумывает!",
      bg: BG.school,
      sprites: { girlClassmate: true },
      speakingSprite: "girlClassmate",
      next: "normal"
    },
    normal: {
      speaker: "Другая девочка",
      text: "Говорить нормально не умеет!",
      bg: BG.school,
      sprites: { girlClassmate: true },
      speakingSprite: "girlClassmate",
      next: "stammer3"
    },
    stammer3: {
      speaker: "Девочка",
      text: "Я н-не… н-не…",
      bg: BG.school,
      sprites: { girl: true },
      speakingSprite: "girl",
      next: "chant"
    },
    chant: {
      speaker: "Мальчик",
      text: "Тупая! Заика! Тупая! Заика!",
      bg: BG.school,
      sprites: { boyClassmate: true },
      speakingSprite: "boyClassmate",
      next: "run2"
    },
    run2: {
      speaker: "...",
      text: "Девочка сделала шаг назад. Ещё один. И бросилась бежать со всех ног.",
      bg: BG.school,
      sprites: {},
      next: "forest"
    },
    forest: {
      speaker: "Девочка",
      text: "Уйди! Это всё из-за тебя! Ненавижу тебя! Ненавижу!",
      bg: BG.forest,
      sprites: { girl: "anger" },
      speakingSprite: "girl",
      next: "help"
    },
    help: {
      speaker: "Звезда",
      text: "Я знаю, что тебе больно. И прилетела помочь.",
      bg: BG.forest,
      sprites: { girl: "anger", star: true },
      speakingSprite: "star",
      next: "angryChoice"
    },
    angryChoice: {
      speaker: "",
      text: "",
      bg: BG.forest,
      sprites: { girl: "anger", star: true },
      choiceLabel: "Глупая звезда!",
      choices: [
        { label: "Даже себе помочь не можешь!", next: "anger" },
        { label: "Лети! Пусть тебя там сожрут в этом твоём космосе!", next: "anger" }
      ]
    },
    anger: {
      speaker: "Девочка",
      text: "Вечно ноете и ноете! «Ах, в небе так холодно и страшно!», «Ах, но нам надо домой!»",
      bg: BG.forest,
      sprites: { girl: "anger", star: true },
      speakingSprite: "girl",
      next: "hate"
    },
    hate: {
      speaker: "Девочка",
      text: "Да лучше бы вас вовсе не было!",
      bg: BG.forest,
      sprites: { girl: "anger", star: true },
      speakingSprite: "girl",
      next: "alone"
    },
    alone: {
      speaker: "...",
      text: "Девочка всё говорила и говорила гадости, размахивала руками и доказывала, что от звёзд только хуже. А когда обернулась, поняла, что осталась одна.",
      bg: BG.forest,
      sprites: { girl: "anger" },
      next: "noRoute"
    },
    noRoute: {
      speaker: "...",
      text: "И в эту ночь она больше не рисовала звёздам маршрут.",
      bg: BG.forest,
      sprites: { girl: "anger" },
      last: true,
      resultTitle: "История продолжается",
      resultMessage: ""
    },
  } }); }
}
