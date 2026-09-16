import { VisualNovelScene } from "./VisualNovelScene.js";
const asset = (path) => new URL(path, import.meta.url).href;
const BACKGROUNDS = { story: asset("../../assets/images/vn/vn_backgrounds/test-stars.png"), home: asset("../../assets/images/vn/vn_backgrounds/test-night.png") };
const MUSIC_URL = asset("../../assets/audio/vn/VN-1.mp3");
const GIRL = asset("../../assets/images/vn/sprites/girl/neutral.png");
const STAR = asset("../../assets/images/vn/sprites/star/neutral.png");

export class VisualNovel2 extends VisualNovelScene {
  constructor(options = {}) {
    super({ ...options, sceneId: "vn-2", musicUrl: MUSIC_URL,
      sprites: { girl: { src: GIRL, alt: "Персонаж — временный спрайт" }, star: { src: STAR, alt: "Звезда — временный спрайт" } }, startNode: "intro",
      nodes: {
        intro: {
          speaker: "...",
          text: "Однажды ночью девочка спасла много-много звёзд. Она по праву гордилась собой — ведь сумела провести их в пустоте, и благополучно доставила домой.",
          bg: BACKGROUNDS.story,
          sprites: {},
          next: "tell"
        },
        tell: {
          speaker: "...",
          text: "И потому с утра ей так сильно захотелось кому-нибудь рассказать!",
          bg: BACKGROUNDS.story,
          sprites: {},
          next: "decided"
        },
        decided: {
          speaker: "...",
          text: "Девочка решила:",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          next: "choice"
        },
        choice: {
          speaker: "",
          text: "",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          choiceLabel: "Я знаю! Знаю, кому рассказать!",
          choices: [
            { label: "Расскажу маме", next: "momRun" },
            { label: "Расскажу папе", next: "dadRun" }
          ]
        },
        momRun: {
          speaker: "...",
          text: "Со всех ног она побежала к маме, предвкушая, как та удивится.",
          bg: BACKGROUNDS.home,
          sprites: {},
          next: "momHello"
        },
        momHello: {
          speaker: "Девочка",
          text: "Мама! Мама! Ты не представляешь, я за ночь спасла столько звёзд!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momDetail"
        },
        momDetail: {
          speaker: "Девочка",
          text: "Там была и космическая пыль, и такая жирная чёрная звезда!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momEnd"
        },
        momEnd: {
          speaker: "Девочка",
          text: "Ух, видела бы ты её! Но я всех привела домой. Почти до утра рисовала им путь!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momNotHappy"
        },
        momNotHappy: {
          speaker: "...",
          text: "Но мама не спешила за неё радоваться.",
          bg: BACKGROUNDS.home,
          sprites: {},
          next: "momScold"
        },
        momScold: {
          speaker: "Мама",
          text: "Так вот чем ты занимаешься по ночам! А потом на уроках не слушаешь!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momScold2"
        },
        momScold2: {
          speaker: "Мама",
          text: "Я столько работаю, а ты тратишь время на ерунду!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momChoice"
        },
        momChoice: {
          speaker: "",
          text: "",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          choiceLabel: "Но, мама, это же очень важно!",
          choices: [
            { label: "Без меня они не доберутся домой.", next: "momAnswer1" },
            { label: "Я тоже радуюсь, когда им хорошо.", next: "momAnswer2" }
          ]
        },
        momAnswer1: {
          speaker: "Мама",
          text: "Вот ещё. Жили как-то до тебя, и ещё проживут.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momAfter"
        },
        momAnswer2: {
          speaker: "Мама",
          text: "Счастьем сыт не будешь! Надо нормально спать и хорошо учиться.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momAnswer3"
        },
        momAnswer3: {
          speaker: "Мама",
          text: "Чтобы потом у тебя была хорошая жизнь.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "momAfter"
        },
        momAfter: {
          speaker: "...",
          text: "И хотя девочке было очень обидно это слушать, она старалась верить в то, что делает. Несмотря на чувство, будто от маминых слов что-то внутри надломилось.",
          bg: BACKGROUNDS.story,
          sprites: {},
          next: "end"
        },
        dadRun: {
          speaker: "...",
          text: "И она скорей побежала искать папу. Ведь это он когда-то подарил ей книжку про звёзды. А значит, должен был понять.",
          bg: BACKGROUNDS.home,
          sprites: {},
          next: "dadHello"
        },
        dadHello: {
          speaker: "Девочка",
          text: "Пап! Папа! Ты точно будешь мной гордиться! Я спасла столько звёзд!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "dadEnd"
        },
        dadEnd: {
          speaker: "Девочка",
          text: "Всю ночь рисовала им путь!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "dadCold"
        },
        dadCold: {
          speaker: "...",
          text: "Но папа только скользнул мимо неё равнодушным взглядом.",
          bg: BACKGROUNDS.home,
          sprites: {},
          next: "dadReply"
        },
        dadReply: {
          speaker: "Папа",
          text: "Милая. Звёзды — это огромные горящие шары. Их не нужно спасать.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "friends"
        },
        friends: {
          speaker: "Девочка",
          text: "Но, папа, они же мои друзья!",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "romance"
        },
        romance: {
          speaker: "Папа",
          text: "Опять эта твоя романтика. Слишком богатое воображение.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "busy"
        },
        busy: {
          speaker: "Папа",
          text: "Впрочем, я занят. Иди поиграй и больше не говори всяких глупостей.",
          bg: BACKGROUNDS.home,
          sprites: { girl: true },
          speakingSprite: "girl",
          next: "dadAfter"
        },
        dadAfter: {
          speaker: "...",
          text: "И хотя девочке было очень обидно это слушать, она старалась верить в то, что делает. Несмотря на чувство, будто от папиных слов что-то погасло.",
          bg: BACKGROUNDS.story,
          sprites: {},
          next: "end"
        },
        end: {
          speaker: "...",
          text: "",
          bg: BACKGROUNDS.story,
          sprites: {},
          last: true,
          resultTitle: "История продолжается",
          resultMessage: ""
        },
      } });
  }
}
