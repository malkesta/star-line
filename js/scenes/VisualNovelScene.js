export class VisualNovelScene {
  constructor({
  sceneId = "vn",
  sceneManager = null,
  audio = null,
  onNext = null,
  startNode,
  nodes,
  sprites = {},
  musicUrl = null,
} = {}) {
  this.sceneId = sceneId;
  this.sceneManager = sceneManager;
  this.audio = audio;
  this.onNext = onNext;

  this.startNode = startNode;
  this.nodes = nodes ?? {};
  this.sprites = sprites;
  this.spriteHeightRatios = new Map();

  // The tallest sprite is presented at 80% of the visible viewport. The cap
  // keeps the characters from becoming oversized on televisions and large
  // desktop displays.
  this.spriteViewportCoverage = 0.8;
  this.maxTallestSpriteHeight = 840;

  /*
    Музыка конкретного этапа VN. Если не задана — просто не будет
    вызвано setMusic(), и останется трек, который уже играл
    (например, от предыдущей сцены), либо не будет играть ничего.
  */
  this.musicUrl = musicUrl;

  /*
    На финальной карточке музыка становится тише, но продолжает играть.
    Полное затухание запускается только после нажатия «Дальше».
  */
  this.musicOverlayFadeDuration = 1.2;
  this.musicExitFadeDuration = 0.65;


    this.scene = document.getElementById("vnScene");
    this.dialogShell = document.getElementById("vnDialogShell");
    this.dialogTopper = document.getElementById("vnDialogTopper");

    this.rotateLock = document.getElementById("rotateLock");
    this.bg = document.getElementById("vnBg");
    this.bgTransition = document.getElementById("vnBgTransition");
    this.backgroundTransitionRaf = null;

    this.speakerEl = document.getElementById("vnSpeakerName");
    this.textWrap = document.getElementById("vnDialogTextWrap");
    this.textEl = document.getElementById("vnDialogText");
    this.nextHint = document.getElementById("vnNextHint");

    this.choiceBox = document.getElementById("vnChoiceBox");
    this.choiceLabel = document.getElementById("vnChoiceLabel");
    this.resultOverlay = document.getElementById("vnResultOverlay");
    this.resultTitle = document.getElementById("vnResultTitle");
    this.resultMessage = document.getElementById("vnResultMessage");
    this.resultNextBtn = document.getElementById("vnResultNextBtn");

    this.spriteElements = {
      girl: document.getElementById("spriteGirl"),
      star: document.getElementById("spriteStar"),
      mom: document.getElementById("spriteMom"),
      dad: document.getElementById("spriteDad"),
    };

    this.currentNodeId = null;
    this.typingTimer = null;
    this.hintTimer = null;
    this.typingQueue = null;
    this.entryTimer = null;
    this.presentationTimer = null;
    this.choiceRevealTimer = null;
    this.presentationId = 0;
    this.pendingChoiceNodeId = null;

    this.typingActive = false;
    this.typingDone = false;
    this.waitingChoice = false;
    this.inputLocked = false;
    this.finished = false;
    this.resultShown = false;
    this.orientationBlocked = false;
    this.lastAdvanceAt = 0;

    this.typingSpeed = 26;
    this.hintDelay = 700;
    this.backgroundRevealDuration = 550;
    this.backgroundTransitionDuration = 850;
    this.dialogRevealDuration = 350;
    this.spriteRevealDuration = 600;
    this.choiceRevealDuration = 350;

    /*
      Длительность появления/исчезновения VN. Должна совпадать
      со значением transition для opacity в правиле #vnScene в CSS.
    */
    this.fadeDuration = 1600;

    this.handleSceneClick = this.handleSceneClick.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.handleResultNextClick = this.handleResultNextClick.bind(this);
  }

    async enter() {
    this.audio?.stopAmbient?.();

    if (this.musicUrl) {
      this.audio?.setMusic?.(this.musicUrl);

      try {
        await this.audio?.init?.();
        this.audio?.startAmbient?.(true);
      } catch (e) {
        console.warn("[VN] audio init skipped", e);
      }
    }
    document.body.classList.add("is-vn-blackout");

    this.resetState();
    this.applySpriteSources();
    await this.prepareSpriteSizing();
    this.hideDialog({ immediate: true });

    this.resultOverlay?.classList.remove("show");
    this.resultOverlay?.setAttribute("aria-hidden", "true");

    if (this.resultNextBtn) {
      this.resultNextBtn.disabled = false;
    }

    document.body.classList.add("is-vn-active");

    this.scene.style.display = "block";
    this.scene.style.pointerEvents = "auto";
    this.scene.style.opacity = "0";
    this.scene.setAttribute("aria-hidden", "false");

    this.scene.addEventListener("click", this.handleSceneClick);
    this.scene.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });

    this.resultNextBtn?.addEventListener(
      "click",
      this.handleResultNextClick
    );

    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("orientationchange", this.handleViewportChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.handleViewportChange
      );
    }

    this.handleViewportChange();

    /*
      Подготавливаем полный первый кадр VN, пока весь #vnScene ещё имеет
      opacity: 0. Поэтому фон, рамка, декор и спрайты проявятся одновременно,
      как единое целое, а не по частям.
    */
    const firstNode = this.nodes[this.startNode];

    if (!firstNode) {
      console.warn(`[VN] Не найден стартовый узел: ${this.startNode}`);
      return;
    }

    this.currentNodeId = this.startNode;

    if (firstNode.bg) {
      this.setBackground(firstNode.bg, { immediate: true });
    }

    this.setSprites(firstNode.sprites, firstNode.speakingSprite);
    this.setSpeaker(firstNode.speaker);

    /*
      Текст пока не печатаем: поле остаётся пустым до завершения появления.
      Но уже запоминаем, что это первый активный узел.
    */
    this.textEl.textContent = "";
    this.textWrap.scrollTop = 0;
    this.typingActive = false;
    this.typingDone = false;
    this.nextHint.classList.remove("show");

    /*
      Два последовательных requestAnimationFrame гарантируют, что браузер
      сначала отрисует #vnScene с opacity: 0, а только затем запустит
      CSS-переход к opacity: 1. Иначе оба состояния могут схлопнуться
      в один кадр и переход не будет виден.
    */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scene.style.opacity = "1";
        document
          .getElementById("sceneTransitionVeil")
          ?.classList.remove("is-visible");
      });
    });

    /*
      Печать первой реплики запускаем только после того, как CSS-переход
      opacity полностью завершился (см. this.fadeDuration).
    */
    this.entryTimer = window.setTimeout(() => {
      this.entryTimer = null;

      if (!this.finished && !this.resultShown) {
        this.showDialog();
        this.typeText(firstNode.text);
      }
    }, this.fadeDuration + this.backgroundRevealDuration);
  }

  async exit() {
  this.presentationId += 1;
  this.pendingChoiceNodeId = null;
  this.clearTimers();

  this.resultNextBtn?.removeEventListener("click", this.handleResultNextClick);
  this.resultOverlay?.classList.remove("show");
  this.resultOverlay?.setAttribute("aria-hidden", "true");

  this.scene.removeEventListener("click", this.handleSceneClick);
  this.scene.removeEventListener("touchstart", this.handleTouchStart);

  window.removeEventListener("resize", this.handleViewportChange);
  window.removeEventListener("orientationchange", this.handleViewportChange);

  if (window.visualViewport) {
    window.visualViewport.removeEventListener("resize", this.handleViewportChange);
  }

  this.hideChoices();
  this.setSprites({}, null);

  this.scene.style.pointerEvents = "none";
  this.scene.style.opacity = "0";
  this.scene.setAttribute("aria-hidden", "true");

  await new Promise((resolve) => {
    window.setTimeout(resolve, this.fadeDuration);
  });

  this.scene.style.display = "none";

  document.body.classList.remove("is-vn-active");
  document.body.classList.remove("is-vn-blackout");
}

  resetState() {
    this.presentationId += 1;
    this.clearTimers();

    this.currentNodeId = null;
    this.pendingChoiceNodeId = null;
    this.typingQueue = null;
    this.typingActive = false;
    this.typingDone = false;
    this.waitingChoice = false;
    this.inputLocked = false;
    this.finished = false;
    this.resultShown = false;

    this.textEl.textContent = "";
    this.speakerEl.textContent = "";
    this.speakerEl.classList.remove("show", "narrator");
    this.nextHint.classList.remove("show");

    this.hideChoices();
    this.setSprites({}, null);

    this.resultOverlay?.classList.remove("show");
    this.resultOverlay?.setAttribute("aria-hidden", "true");

    if (this.resultNextBtn) {
      this.resultNextBtn.disabled = false;
    }
  }

  applySpriteSources() {
    Object.entries(this.sprites).forEach(([key, config]) => {
      const element = this.spriteElements[key];

      if (!element || !config?.src) return;

      element.src = config.src;
      element.dataset.spriteSrc = config.src;
      element.alt = config.alt ?? "";
    });
  }

  async prepareSpriteSizing() {
    const spriteDimensions = await Promise.all(
      Object.entries(this.sprites).map(async ([key, config]) => {
        if (!config?.src) return null;

        try {
          const dimensions = await this.getImageDimensions(config.src);
          return { key, ...dimensions };
        } catch (error) {
          console.warn(`[VN] Не удалось определить размер спрайта ${key}`, error);
          return null;
        }
      })
    );

    const availableSprites = spriteDimensions.filter(Boolean);
    const tallestSprite = Math.max(
      0,
      ...availableSprites.map(({ height }) => height)
    );

    this.spriteHeightRatios.clear();

    if (!tallestSprite) return;

    availableSprites.forEach(({ key, height }) => {
      this.spriteHeightRatios.set(key, height / tallestSprite);
    });

    this.updateSpriteSizes();
  }

  getImageDimensions(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("Image has no intrinsic dimensions"));
          return;
        }

        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };

      image.onerror = () => reject(new Error(`Failed to load ${src}`));
      image.src = src;
    });
  }

  preload() {
  const backgroundUrls = new Set();

  Object.values(this.nodes).forEach((node) => {
    if (node?.bg) backgroundUrls.add(node.bg);
  });

  backgroundUrls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  Object.values(this.sprites).forEach((config) => {
    const sources = [config?.src, ...Object.values(config?.variants ?? {})];

    sources.filter(Boolean).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  });

  if (this.musicUrl) {
    const audioPreload = new Audio();
    audioPreload.preload = "auto";
    audioPreload.src = this.musicUrl;
  }
}

  updateViewportUnits() {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;

    const min = Math.min(width, height);
    const max = Math.max(width, height);

    const root = document.documentElement.style;

    root.setProperty("--vmin", `${min / 100}px`);
    root.setProperty("--vmax", `${max / 100}px`);
    root.setProperty("--vw", `${width / 100}px`);
    root.setProperty("--vh", `${height / 100}px`);
  }

  isPortraitBlocked() {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;

    return height > width && Math.min(width, height) < 900;
  }

  handleViewportChange() {
    this.updateViewportUnits();
    this.updateSpriteSizes();
    this.refreshSpeakingSpriteScales();

    const blocked = this.isPortraitBlocked();

    this.rotateLock?.classList.toggle("show", blocked);
    this.scene.style.visibility = blocked ? "hidden" : "visible";
    this.orientationBlocked = blocked;
  }

  updateSpriteSizes() {
    if (!this.spriteHeightRatios.size) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const tallestSpriteHeight = Math.min(
      viewportHeight * this.spriteViewportCoverage,
      this.maxTallestSpriteHeight
    );

    this.spriteHeightRatios.forEach((ratio, key) => {
      const element = this.spriteElements[key];
      if (!element) return;

      element.style.setProperty(
        "--sprite-render-height",
        `${Math.round(tallestSpriteHeight * ratio)}px`
      );
    });
  }

  clearTimers() {
    window.clearTimeout(this.typingTimer);
    window.clearTimeout(this.hintTimer);
    window.clearTimeout(this.entryTimer);
    window.clearTimeout(this.presentationTimer);
    window.clearTimeout(this.choiceRevealTimer);

    this.typingTimer = null;
    this.hintTimer = null;
    this.entryTimer = null;
    this.presentationTimer = null;
    this.choiceRevealTimer = null;
  }

  hideDialog({ immediate = false } = {}) {
    const elements = [this.dialogShell, this.dialogTopper].filter(Boolean);

    elements.forEach((element) => {
      if (immediate) element.classList.add("is-hidden-immediate");
      element.classList.add("is-hidden");
    });
  }

  showDialog() {
    const elements = [this.dialogShell, this.dialogTopper].filter(Boolean);

    elements.forEach((element) => {
      element.classList.remove("is-hidden-immediate");
    });

    requestAnimationFrame(() => {
      elements.forEach((element) => element.classList.remove("is-hidden"));
    });
  }

  clearDialogContent() {
    this.textEl.textContent = "";
    this.textWrap.scrollTop = 0;
    this.speakerEl.textContent = "";
    this.speakerEl.classList.remove("show", "narrator");
    this.nextHint.classList.remove("show");
  }

  waitForPresentation(duration) {
    return new Promise((resolve) => {
      this.presentationTimer = window.setTimeout(() => {
        this.presentationTimer = null;
        resolve();
      }, duration);
    });
  }

  setBackground(src, { immediate = false } = {}) {
    if (!src || this.bg.dataset.src === src) return;

    if (this.backgroundTransitionRaf) {
      cancelAnimationFrame(this.backgroundTransitionRaf);
      this.backgroundTransitionRaf = null;
    }

    const previousBackground = this.bg.style.backgroundImage;

    this.bg.dataset.src = src;
    this.bg.style.backgroundImage = `url("${src}")`;

    if (immediate || !previousBackground || !this.bgTransition) {
      if (this.bgTransition) this.bgTransition.style.opacity = "0";
      return;
    }

    this.bgTransition.style.transition = "none";
    this.bgTransition.style.backgroundImage = previousBackground;
    this.bgTransition.style.opacity = "1";

    this.backgroundTransitionRaf = requestAnimationFrame(() => {
      this.backgroundTransitionRaf = requestAnimationFrame(() => {
        this.bgTransition.style.removeProperty("transition");
        this.bgTransition.style.opacity = "0";
        this.backgroundTransitionRaf = null;
      });
    });
  }

  setSprites(spriteState = {}, speakingKey = null) {
    Object.entries(this.spriteElements).forEach(([key, element]) => {
      if (!element) return;

      const spriteVariant =
        typeof spriteState[key] === "string" ? spriteState[key] : null;
      const config = this.sprites[key];
      const source = spriteVariant
        ? config?.variants?.[spriteVariant]
        : config?.src;

      if (source && element.dataset.spriteSrc !== source) {
        element.src = source;
        element.dataset.spriteSrc = source;
      }

      const visible = Boolean(spriteState[key]);

      element.classList.toggle("show", visible);

      if (!visible) {
        element.classList.remove("speaking", "not-speaking");
        return;
      }

      if (speakingKey) {
        // И говорящий, и слушающий сначала получают свой масштаб для
        // текущего viewport. CSS уменьшает слушающего ровно на 10% от
        // этого же относительного значения.
        this.fitSpeakingSpriteToViewport(element);
        element.classList.toggle("speaking", key === speakingKey);
        element.classList.toggle("not-speaking", key !== speakingKey);
      } else {
        element.classList.remove("speaking", "not-speaking");
      }
    });
  }

  /*
   * Каждый видимый спрайт получает допустимый масштаб от высоты viewport.
   * Говорящий использует его полностью, слушающий — 90% этого значения.
   */
  fitSpeakingSpriteToViewport(element) {
    const height = element.offsetHeight;
    const groundLine = element.offsetTop + height;

    if (!height || !groundLine) return;

    const scale = Math.min(1.06, Math.max(1, groundLine / height));
    element.style.setProperty("--speaking-sprite-scale", scale.toFixed(3));
  }

  refreshSpeakingSpriteScales() {
    Object.values(this.spriteElements).forEach((element) => {
      if (element?.classList.contains("show")) {
        this.fitSpeakingSpriteToViewport(element);
      }
    });
  }

  setSpeaker(name) {
    const label = name || "...";

    this.speakerEl.textContent = label;
    this.speakerEl.classList.toggle("show", Boolean(label));
    this.speakerEl.classList.remove("narrator");
  }

  typeText(text) {
    this.clearTimers();

    this.textEl.textContent = "";
    this.textWrap.scrollTop = 0;

    this.typingQueue = {
      text: String(text ?? ""),
      index: 0,
    };

    this.typingActive = true;
    this.typingDone = false;
    this.nextHint.classList.remove("show");

    this.scheduleTypingTick();
  }

  scheduleTypingTick() {
    if (!this.typingQueue || this.orientationBlocked) return;

    this.typingTimer = window.setTimeout(() => {
      this.typingTick();
    }, this.typingSpeed);
  }

  typingTick() {
    if (!this.typingQueue) return;

    const queue = this.typingQueue;

    if (queue.index < queue.text.length) {
      queue.index += 1;
      this.textEl.textContent = queue.text.slice(0, queue.index);
      this.textWrap.scrollTop = this.textWrap.scrollHeight;

      this.scheduleTypingTick();
      return;
    }

    this.typingQueue = null;
    this.typingActive = false;
    this.typingDone = true;

    if (this.completeChoicePrompt()) return;

    this.hintTimer = window.setTimeout(() => {
      this.nextHint.classList.add("show");
    }, this.hintDelay);
  }

  finishTyping() {
    if (!this.typingActive) return;

    this.clearTimers();

    const node = this.nodes[this.currentNodeId];

    this.typingQueue = null;
    this.typingActive = false;
    this.typingDone = true;

    const isChoicePrompt = this.pendingChoiceNodeId === this.currentNodeId;
    this.textEl.textContent = isChoicePrompt
      ? node?.choiceLabel ?? node?.text ?? ""
      : node?.text ?? "";
    this.textWrap.scrollTop = this.textWrap.scrollHeight;

    if (this.completeChoicePrompt()) return;

    this.hintTimer = window.setTimeout(() => {
      this.nextHint.classList.add("show");
    }, this.hintDelay);
  }

  goTo(nodeId) {
    const node = this.nodes[nodeId];

    if (!node) {
      console.warn(`[VN] Не найден узел: ${nodeId}`);
      this.finish();
      return;
    }

    this.currentNodeId = nodeId;
    this.pendingChoiceNodeId = null;
    this.nextHint.classList.remove("show");
    this.hideChoices();

    const backgroundChanged =
      Boolean(node.bg) && this.bg.dataset.src !== node.bg;

    if (backgroundChanged) {
      void this.presentBackgroundAndSprites(node);
      return;
    }

    if (node.bg) this.setBackground(node.bg);

    this.setSprites(node.sprites, node.speakingSprite);

    if (node.choices?.length) {
      this.beginChoicePrompt(node);
      return;
    }

    this.setSpeaker(node.speaker);
    this.typeText(node.text);
  }

  beginChoicePrompt(node) {
    this.inputLocked = true;
    this.pendingChoiceNodeId = this.currentNodeId;

    // Выбор — это реплика игрока. По умолчанию активна героиня, поэтому
    // второй видимый персонаж получает состояние not-speaking и затемняется.
    // Нетипичная сцена может явно указать choiceSpeakingSprite.
    const choiceSpeakingSprite =
      node.choiceSpeakingSprite ??
      node.speakingSprite ??
      (node.sprites?.girl ? "girl" : null);
    if (choiceSpeakingSprite) {
      this.setSprites(node.sprites, choiceSpeakingSprite);
    }

    this.speakerEl.textContent = "";
    this.speakerEl.classList.remove("show", "narrator");
    this.typeText(node.choiceLabel ?? node.text ?? "");
  }

  completeChoicePrompt() {
    if (this.pendingChoiceNodeId !== this.currentNodeId) return false;

    const node = this.nodes[this.currentNodeId];
    this.pendingChoiceNodeId = null;

    if (!node?.choices?.length) return false;

    this.nextHint.classList.remove("show");
    this.choiceRevealTimer = window.setTimeout(() => {
      this.choiceRevealTimer = null;

      if (!this.finished && this.currentNodeId && this.nodes[this.currentNodeId] === node) {
        this.showChoices(node);
      }
    }, this.choiceRevealDuration);

    return true;
  }

  async presentBackgroundAndSprites(node) {
    const presentationId = ++this.presentationId;

    this.inputLocked = true;
    this.clearTimers();
    this.typingQueue = null;
    this.typingActive = false;
    this.typingDone = false;
    this.clearDialogContent();
    this.hideDialog();
    this.setSprites({}, null);

    // Даём окну и прежним спрайтам исчезнуть до смены кадра.
    await this.waitForPresentation(this.dialogRevealDuration);
    if (presentationId !== this.presentationId || this.finished) return;

    this.setBackground(node.bg);

    // Новый фон остаётся на экране сам по себе, затем проявляются персонажи
    // или диалоговое окно, если в узле нет спрайтов.
    await this.waitForPresentation(this.backgroundTransitionDuration);
    if (presentationId !== this.presentationId || this.finished) return;

    if (!Object.values(node.sprites ?? {}).some(Boolean)) {
      this.setSpeaker(node.speaker);
      this.showDialog();
      this.inputLocked = false;

      if (node.choices?.length) {
        this.beginChoicePrompt(node);
        return;
      }

      this.typeText(node.text);
      return;
    }

    this.setSprites(node.sprites, node.speakingSprite);

    await this.waitForPresentation(this.spriteRevealDuration);
    if (presentationId !== this.presentationId || this.finished) return;

    this.setSpeaker(node.speaker);
    this.showDialog();
    this.inputLocked = false;

    if (node.choices?.length) {
      this.beginChoicePrompt(node);
      return;
    }

    this.typeText(node.text);
  }

  renderChoices(node) {
    this.choiceBox
      .querySelectorAll(".vn-choice-btn")
      .forEach((button) => button.remove());

    // Фраза-приглашение выводится в обычном диалоговом окне, поэтому
    // в самом блоке выбора остаются только варианты.
    if (this.choiceLabel) {
      this.choiceLabel.textContent = "";
      this.choiceLabel.hidden = true;
    }

    node.choices.forEach((choice, index) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "vn-choice-btn";

      button.innerHTML = `
        <svg class="choice-svg" viewBox="0 0 1000 110" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="choiceGrad${index}" x1="0" x2="1">
              <stop offset="0%" stop-color="#a86779" stop-opacity="0.15"/>
              <stop offset="50%" stop-color="#f5b670" stop-opacity="0.42"/>
              <stop offset="100%" stop-color="#3f4f78" stop-opacity="0.18"/>
            </linearGradient>
          </defs>
          <path d="M46 8H954c15 0 27 12 27 27v40c0 15-12 27-27 27H46c-15 0-27-12-27-27V35C19 20 31 8 46 8Z" class="choice-core"/>
          <path d="M64 17H936c10 0 18 8 18 18v21H46V35c0-10 8-18 18-18Z" class="choice-glow" fill="url(#choiceGrad${index})"/>
          <path d="M95 55H905" class="choice-line"/>
          <path d="M76 55l10-10 10 10-10 10Z" class="choice-star"/>
          <path d="M924 55l10-10 10 10-10 10Z" class="choice-star"/>
          <circle cx="500" cy="55" r="13" fill="none" stroke="rgba(255,235,195,.35)"/>
          <path d="M500 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" class="choice-star"/>
        </svg>
        <svg class="choice-edge-star choice-edge-star--left" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 14C53 34 66 47 86 50C66 53 53 66 50 86C47 66 34 53 14 50C34 47 47 34 50 14Z"/>
        </svg>
        <span class="choice-text"></span>
        <svg class="choice-edge-star choice-edge-star--right" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 14C53 34 66 47 86 50C66 53 53 66 50 86C47 66 34 53 14 50C34 47 47 34 50 14Z"/>
        </svg>
      `;

      button.querySelector(".choice-text").textContent = choice.label;

      button.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!this.waitingChoice) return;

        this.hideChoices();
        this.goTo(choice.next);
      });

      this.choiceBox.append(button);
    });
  }

  showChoices(node) {
    this.waitingChoice = true;
    this.inputLocked = true;

    this.nextHint.classList.remove("show");
    this.renderChoices(node);

    this.choiceBox.classList.add("show");
  }

  hideChoices() {
    this.waitingChoice = false;
    this.inputLocked = false;

    this.choiceBox?.classList.remove("show");

    if (this.choiceLabel) {
      this.choiceLabel.textContent = "";
    }
  }

  advance() {
    if (this.finished) return;

    if (this.typingActive) {
      this.finishTyping();
      return;
    }

    if (this.inputLocked) return;

    if (!this.typingDone) return;

    const node = this.nodes[this.currentNodeId];

    if (!node) {
      this.finish();
      return;
    }

    if (node.choices?.length) {
      this.showChoices(node);
      return;
    }

    if (node.last || !node.next) {
      this.finish();
      return;
    }

    this.goTo(node.next);
  }

  handleSceneClick() {
    if (this.waitingChoice || this.inputLocked || this.orientationBlocked) {
      return;
    }

    const now = Date.now();

    if (now - this.lastAdvanceAt < 80) {
      return;
    }

    this.lastAdvanceAt = now;
    this.advance();
  }

  handleTouchStart(event) {
    if (event.target.closest(".vn-choice-btn")) return;

    event.preventDefault();
    this.handleSceneClick();
  }

  async handleResultNextClick(event) {
  event?.stopPropagation();

  if (!this.resultShown) return;

  if (this.resultNextBtn) {
    this.resultNextBtn.disabled = true;
  }

  await this.audio?.fadeOutAmbient?.(this.musicExitFadeDuration);

  const exitPromise = this.exit();

  await exitPromise;

  if (typeof this.onNext === "function") {
    await this.onNext();
    return;
  }

  if (typeof this.sceneManager?.activatePreloaded === "function") {
    // exitPromise уже полностью закрыл текущую VN. Не запускаем второй exit()
    // внутри SceneManager: на мобильных это создавало гонку переходов.
    await this.sceneManager.activatePreloaded({
      currentSceneAlreadyExited: true,
    });
    return;
  }

  await this.sceneManager?.next?.();
}

  finish() {
  if (this.finished || this.resultShown) return;

  this.finished = true;
  this.resultShown = true;
  this.isRunning = false;

  this.clearTimers();
  this.hideChoices();

  this.scene.removeEventListener("click", this.handleSceneClick);
  this.scene.removeEventListener("touchstart", this.handleTouchStart);

  this.nextHint.classList.remove("show");

  /*
    Финальная карточка приглушает музыку, сохраняя её до нажатия
    «Дальше» — так же, как итоговый экран игровой сцены.
  */
  if (this.musicUrl) {
    this.audio?.duckAmbientForOverlay?.(this.musicOverlayFadeDuration);
  }

  const finalNode = this.nodes[this.currentNodeId] ?? {};

  if (this.resultTitle) {
    this.resultTitle.textContent =
      finalNode.resultTitle ?? "История продолжается";
  }

  if (this.resultMessage) {
    this.resultMessage.textContent =
      finalNode.resultMessage ??
      "Ты помогла маленькой звезде снова увидеть свет.";
  }

  this.resultOverlay?.classList.add("show");
  this.resultOverlay?.setAttribute("aria-hidden", "false");

  /*
    Готовим следующую игровую сцену прямо сейчас, пока пользователь
    ещё читает финальный экран VN. Она сама выставит свой фон и
    отрисует homeStar/starlets, но не запустит игровой цикл и не
    станет видимой — canvas всё ещё скрыт классом is-vn-active.
  */
  console.log("[VN] finish() -> preloadNext check", {
  hasSceneManager: !!this.sceneManager,
  hasPreloadNext: typeof this.sceneManager?.preloadNext === "function",
});

if (typeof this.sceneManager?.preloadNext === "function") {
  const preloaded = this.sceneManager.preloadNext();
  console.log("[VN] preloadNext() result", preloaded);
}
}
}
