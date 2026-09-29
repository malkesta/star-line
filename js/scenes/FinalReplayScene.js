import { FinalReplaySession, GAME_SCENE_IDS } from "../core/CampaignResults.js";

export const GAME_SHARE_URL = "https://malkesta.github.io/star-line/";
const GAME_BACKGROUND_URL = new URL(
  "../../assets/images/backgrounds/game_bg1.webp",
  import.meta.url
).href;

const LEVEL_LABELS = Object.freeze({
  game1: "Игра 1", game2: "Игра 2", game3: "Игра 3", game4: "Игра 4", game5: "Игра 5",
  game6: "Игра 6", game7: "Игра 7", game8: "Игра 8", game9: "Игра 9", game10: "Игра 10",
});

const rankMedals = (rank) => Array.from({ length: 3 }, (_, index) =>
  `<span class="rank-medal ${index < rank ? "is-lit" : "is-locked"}" aria-hidden="true"></span>`
).join("");

const shareText = (summary) =>
  `Мой средний ранг в «Звёздной линии» — ${summary.averageRank.toFixed(1)} из 3. Попробуй тоже!`;

const roundedRect = (ctx, x, y, width, height, radius) => {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.arcTo(x + width, y, x + width, y + height, corner);
  ctx.arcTo(x + width, y + height, x, y + height, corner);
  ctx.arcTo(x, y + height, x, y, corner);
  ctx.arcTo(x, y, x + width, y, corner);
  ctx.closePath();
};

export const getShareCardMedalCount = (averageRank, completedCount) => {
  if (!completedCount) return 0;
  if (averageRank >= 2.7) return 3;
  if (averageRank > 2) return 2;
  return 1;
};

export class FinalReplayScene {
  constructor({ sceneManager, campaignResults } = {}) {
    this.sceneManager = sceneManager;
    this.campaignResults = campaignResults;
    this.root = document.getElementById("finalReplayScreen");
    this.session = null;
    this.bound = false;
  }

  async enter() {
    // Снимок делается только при фактическом входе. Предзагрузка финала не
    // может забрать или изменить результаты кампании.
    this.session = new FinalReplaySession(this.campaignResults?.snapshot?.());
    this.campaignResults?.reset?.();
    this.root?.classList.add("show");
    this.render();
  }

  suspend() {
    this.root?.classList.remove("show");
  }

  resume() {
    if (!this.session) return;
    this.root?.classList.add("show");
    this.render();
  }

  render() {
    if (!this.root || !this.session) return;
    const summary = this.session.getSummary();
    const average = summary.completedCount ? summary.averageRank.toFixed(1) : "—";
    const levels = this.session.getLevelResults();

    this.root.innerHTML = `
      <section class="final-replay-panel" aria-labelledby="finalReplayTitle">
        <div class="final-replay-emblem" aria-hidden="true">✦</div>
        <h1 id="finalReplayTitle">Твоя звёздная линия</h1>
        <p class="final-replay-average">Средний ранг <strong>${average}</strong><span>из 3</span></p>
        <p class="final-replay-caption">Пройдено уровней: ${summary.completedCount} из ${GAME_SCENE_IDS.length}</p>
        <div class="final-replay-levels" aria-label="Перепройти игровой уровень">
          ${levels.map(({ sceneId, sceneRank }) => `
            <button class="final-replay-level" type="button" data-replay-level="${sceneId}" aria-label="Перепройти ${LEVEL_LABELS[sceneId]}">
              <span>${LEVEL_LABELS[sceneId]}</span>
              <span class="final-replay-rank" aria-label="Ранг ${sceneRank || 0}">${rankMedals(sceneRank)}</span>
              <span class="final-replay-icon" aria-hidden="true">↻</span>
            </button>
          `).join("")}
        </div>
        <div class="final-replay-share">
          <button class="final-replay-share-toggle" type="button" aria-expanded="false">Поделиться</button>
          <div class="final-replay-share-menu" hidden>
            <button type="button" data-share-native>В приложения</button>
            <button type="button" data-share-telegram>Telegram</button>
            <button type="button" data-share-x>X</button>
            <button type="button" data-share-download>Скачать результат PNG</button>
          </div>
        </div>
      </section>`;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.root) return;
    this.root.querySelectorAll("[data-replay-level]").forEach((button) => {
      button.addEventListener("click", () => this.openReplay(button.dataset.replayLevel));
    });
    const toggle = this.root.querySelector(".final-replay-share-toggle");
    const menu = this.root.querySelector(".final-replay-share-menu");
    toggle?.addEventListener("click", () => {
      const open = menu?.hidden;
      if (menu) menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(Boolean(open)));
    });
    this.root.querySelector("[data-share-native]")?.addEventListener("click", () => this.shareNative());
    this.root.querySelector("[data-share-telegram]")?.addEventListener("click", () => this.openTelegramLink());
    this.root.querySelector("[data-share-x]")?.addEventListener("click", () => this.openX());
    this.root.querySelector("[data-share-download]")?.addEventListener("click", () => this.downloadCard());
  }

  async openReplay(sceneId) {
    if (!this.session || !GAME_SCENE_IDS.includes(sceneId)) return;
    await this.sceneManager?.openFinalReplay?.(sceneId, this.session);
  }

  async loadShareBackground() {
    return new Promise((resolve) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => resolve(null), { once: true });
      image.src = GAME_BACKGROUND_URL;
    });
  }

  async createShareFile() {
    const summary = this.session?.getSummary() ?? { averageRank: 0, completedCount: 0 };
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#091528");
    gradient.addColorStop(1, "#21162b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const background = await this.loadShareBackground();
    if (background) {
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      const shade = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      shade.addColorStop(0, "rgba(5, 13, 29, .34)");
      shade.addColorStop(1, "rgba(27, 16, 39, .38)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = "rgba(255, 232, 184, .12)";
    for (let index = 0; index < 36; index += 1) {
      const x = (index * 137) % canvas.width;
      const y = (index * 83) % canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (index % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff0b8";
    ctx.font = "56px Georgia";
    ctx.fillText("Звёздная линия", 600, 158);
    roundedRect(ctx, 230, 195, 740, 300, 34);
    ctx.fillStyle = "rgba(13, 20, 39, .58)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 220, 190, .28)";
    ctx.stroke();
    ctx.fillStyle = "#f5b670";
    ctx.font = "96px Georgia";
    const medalCount = getShareCardMedalCount(
      summary.averageRank,
      summary.completedCount
    );
    ctx.fillText(medalCount ? Array(medalCount).fill("✦").join("  ") : "—", 600, 298);
    ctx.fillStyle = "#fff0b8";
    ctx.font = "42px Georgia";
    const average = summary.completedCount ? summary.averageRank.toFixed(1) : "—";
    ctx.fillText(`Средний ранг: ${average} из 3`, 600, 395);
    ctx.fillStyle = "#c4cad5";
    ctx.font = "28px Segoe UI";
    ctx.fillText(`Пройдено уровней: ${summary.completedCount} из ${GAME_SCENE_IDS.length}`, 600, 455);
    ctx.fillStyle = "#f5d38b";
    ctx.font = "24px Segoe UI";
    ctx.fillText(GAME_SHARE_URL, 600, 550);
    return new Promise((resolve) => canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], "star-line-result.png", { type: "image/png" }) : null);
    }, "image/png"));
  }

  async shareNative({ downloadFallback = true } = {}) {
    const file = await this.createShareFile();
    const summary = this.session?.getSummary() ?? { averageRank: 0 };
    const data = { title: "Звёздная линия", text: shareText(summary), url: GAME_SHARE_URL, files: file ? [file] : [] };
    if (!navigator.share || (file && !navigator.canShare?.({ files: [file] }))) {
      if (downloadFallback) await this.downloadCard();
      return "unsupported";
    }
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      if (downloadFallback) await this.downloadCard();
      return "failed";
    }
  }

  openTelegramLink() {
    const text = encodeURIComponent(shareText(this.session.getSummary()));
    window.open(`https://t.me/share/url?url=${encodeURIComponent(GAME_SHARE_URL)}&text=${text}`, "_blank", "noopener,noreferrer");
  }

  openX() {
    const text = encodeURIComponent(shareText(this.session.getSummary()));
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(GAME_SHARE_URL)}`, "_blank", "noopener,noreferrer");
  }

  async downloadCard() {
    const file = await this.createShareFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async exit() {
    this.root?.classList.remove("show");
    this.root?.replaceChildren();
    this.session?.dispose();
    this.session = null;
  }
}
