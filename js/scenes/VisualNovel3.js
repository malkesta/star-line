import { VisualNovelScene } from "./VisualNovelScene.js";
const asset = (path) => new URL(path, import.meta.url).href;
const BG = { story: asset("../../assets/images/vn/vn_backgrounds/vn-3_school1.png"), school: asset("../../assets/images/vn/vn_backgrounds/school_bg.png"), schoolOut: asset("../../assets/images/vn/vn_backgrounds/school_out_bg.png"), schoolFinalArgument: asset("../../assets/images/vn/vn_backgrounds/vn-3_school2_paper_v1.png"), schoolFinal: asset("../../assets/images/vn/vn_backgrounds/vn-3_school2_paper_v7.png") };
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
      text: "Но однажды она пришла в школу и увидела большую дружную компанию.",
      bg: BG.school,
      sprites: {},
      next: "choice"
    },
    choice: {
      speaker: "",
      text: "",
      bg: BG.school,
      sprites: { girl: true },
      choiceLabel: "У них весело!",
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
      text: "Девочка замерла. Неужели они говорят про неё?",
      bg: BG.school,
      sprites: {},
      next: "freezeDoubt"
    },
    freezeDoubt: {
      speaker: "...",
      text: "Но она же не такая: не дурочка и не странная.",
      bg: BG.school,
      sprites: {},
      next: "freezeShame"
    },
    freezeShame: {
      speaker: "...",
      text: "И ей впервые стало стыдно — что она помогает звёздам.",
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
      next: "schoolGardenCold"
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
      text: "Она думала, что ей обрадуются. Что её примут в компанию.",
      bg: BG.school,
      sprites: {},
      next: "hopeFriendship"
    },
    hopeFriendship: {
      speaker: "...",
      text: "Ведь ей нравилось дружить.",
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
      text: "Девочка оторопела — будто парализовало.",
      bg: BG.school,
      sprites: {},
      next: "paralyzedCold"
    },
    paralyzedCold: {
      speaker: "...",
      text: "И стало так холодно, как не было даже в самую лютую зиму.",
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
      next: "schoolGardenCold"
    },
    schoolGardenCold: {
      speaker: "...",
      text: "В школьном саду было холодно и тихо.",
      bg: BG.schoolOut,
      sprites: {},
      next: "schoolGardenStar"
    },
    schoolGardenStar: {
      speaker: "...",
      text: "Только мягко светилась крохотная звезда.",
      bg: BG.schoolOut,
      sprites: {},
      next: "forest"
    },
    forest: {
      speaker: "Девочка",
      text: "Уйди! Это всё из-за тебя! Ненавижу тебя! Ненавижу!",
      bg: BG.schoolOut,
      sprites: { girl: "anger" },
      speakingSprite: "girl",
      next: "help"
    },
    help: {
      speaker: "Звезда",
      text: "Я знаю, что тебе больно. И прилетела помочь.",
      bg: BG.schoolOut,
      sprites: { girl: "anger", star: true },
      speakingSprite: "star",
      next: "angryChoice"
    },
    angryChoice: {
      speaker: "",
      text: "",
      bg: BG.schoolOut,
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
      bg: BG.schoolOut,
      sprites: { girl: "anger", star: true },
      speakingSprite: "girl",
      next: "hate"
    },
    hate: {
      speaker: "Девочка",
      text: "Да лучше бы вас вовсе не было!",
      bg: BG.schoolOut,
      sprites: { girl: "anger", star: true },
      speakingSprite: "girl",
      next: "alone"
    },
    alone: {
      speaker: "...",
      text: "Девочка всё говорила и говорила гадости.",
      bg: BG.schoolFinalArgument,
      sprites: {},
      next: "aloneArgues"
    },
    aloneArgues: {
      speaker: "...",
      text: "Размахивала руками и доказывала, что от звёзд только хуже.",
      bg: BG.schoolFinalArgument,
      sprites: {},
      next: "aloneRealizes"
    },
    aloneRealizes: {
      speaker: "...",
      text: "А когда обернулась, поняла, что осталась одна.",
      bg: BG.schoolFinal,
      sprites: {},
      next: "noRoute"
    },
    noRoute: {
      speaker: "...",
      text: "И в эту ночь она больше не рисовала звёздам маршрут.",
      bg: BG.schoolFinal,
      sprites: {},
      last: true,
      resultTitle: "История продолжается",
      resultMessage: ""
    },
  } }); }
}
