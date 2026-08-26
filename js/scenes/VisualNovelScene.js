export class VisualNovelScene {
  constructor({
    sceneId = "vn",
    sceneManager = null,
    audio = null,
    onNext = null,
    startNode,
    nodes,
    sprites = {},
  } = {}) {
    this.sceneId = sceneId;
    this.sceneManager = sceneManager;
    this.audio = audio;
    this.onNext = onNext;

    this.startNode = startNode;
    this.nodes = nodes ?? {};
    this.sprites = sprites;

    this.scene = document.getElementById("vnScene");
    this.rotateLock = document.getElementById("rotateLock");
    this.bg = document.getElementById("vnBg");

    this.speakerEl = document.getElementById("vnSpeakerName");
    this.textWrap = document.getElementById("vnDialogTextWrap");
    this.textEl = document.getElementById("vnDialogText");
    this.nextHint = document.getElementById("vnNextHint");

    this.choiceBox = document.getElementById("vnChoiceBox");
    this.choiceLabel = document.getElementById("vnChoiceLabel");

    this.spriteElements = {
      girl: document.getElementById("spriteGirl"),
      star: document.getElementById("spriteStar"),
    };

    this.currentNodeId = null;
    this.typingTimer = null;
    this.hintTimer = null;
    this.typingQueue = null;

    this.typingActive = false;
    this.typingDone = false;
    this.waitingChoice = false;
    this.inputLocked = false;
    this.finished = false;
    this.orientationBlocked = false;
    this.lastAdvanceAt = 0;

    this.typingSpeed = 26;
    this.hintDelay = 700;

    this.handleSceneClick = this.handleSceneClick.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  async enter() {
    this.resetState();
    this.applySpriteSources();

    document.body.classList.add("is-vn-active");

    this.scene.style.display = "block";
    this.scene.style.pointerEvents = "auto";
    this.scene.style.opacity = "0";
    this.scene.setAttribute("aria-hidden", "false");

    this.scene.addEventListener("click", this.handleSceneClick);
    this.scene.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });

    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("orientationchange", this.handleViewportChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.handleViewportChange
      );
    }

    this.handleViewportChange();

    requestAnimationFrame(() => {
      this.scene.style.opacity = "1";
    });

    window.setTimeout(() => {
      this.goTo(this.startNode);
    }, 700);
  }

  async exit() {
    this.clearTimers();

    this.scene.removeEventListener("click", this.handleSceneClick);
    this.scene.removeEventListener("touchstart", this.handleTouchStart);

    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("orientationchange", this.handleViewportChange);

    if (window.visualViewport) {
      window.visualViewport.removeEventListener(
        "resize",
        this.handleViewportChange
      );
    }

    this.hideChoices();
    this.setSprites({}, null);

    this.scene.style.pointerEvents = "none";
    this.scene.style.opacity = "0";
    this.scene.setAttribute("aria-hidden", "true");

    document.body.classList.remove("is-vn-active");

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    this.scene.style.display = "none";
  }

  resetState() {
    this.clearTimers();

    this.currentNodeId = null;
    this.typingQueue = null;
    this.typingActive = false;
    this.typingDone = false;
    this.waitingChoice = false;
    this.inputLocked = false;
    this.finished = false;

    this.textEl.textContent = "";
    this.speakerEl.textContent = "";
    this.speakerEl.classList.remove("show", "narrator");
    this.nextHint.classList.remove("show");

    this.hideChoices();
    this.setSprites({}, null);
  }

  applySpriteSources() {
    Object.entries(this.sprites).forEach(([key, config]) => {
      const element = this.spriteElements[key];

      if (!element || !config?.src) return;

      element.src = config.src;
      element.alt = config.alt ?? "";
    });
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

    const blocked = this.isPortraitBlocked();

    this.rotateLock?.classList.toggle("show", blocked);
    this.scene.style.visibility = blocked ? "hidden" : "visible";
    this.orientationBlocked = blocked;
  }

  clearTimers() {
    window.clearTimeout(this.typingTimer);
    window.clearTimeout(this.hintTimer);

    this.typingTimer = null;
    this.hintTimer = null;
  }

  setBackground(src) {
    if (!src || this.bg.dataset.src === src) return;

    this.bg.dataset.src = src;
    this.bg.style.backgroundImage = `url("${src}")`;
  }

  setSprites(spriteState = {}, speakingKey = null) {
    Object.entries(this.spriteElements).forEach(([key, element]) => {
      if (!element) return;

      const visible = Boolean(spriteState[key]);

      element.classList.toggle("show", visible);

      if (!visible) {
        element.classList.remove("speaking", "not-speaking");
        return;
      }

      if (speakingKey) {
        element.classList.toggle("speaking", key === speakingKey);
        element.classList.toggle("not-speaking", key !== speakingKey);
      } else {
        element.classList.remove("speaking", "not-speaking");
      }
    });
  }

  setSpeaker(name) {
    const narrator = !name;
    const label = narrator ? "Рассказчик" : name;

    this.speakerEl.textContent = label;
    this.speakerEl.classList.toggle("show", Boolean(label));
    this.speakerEl.classList.toggle("narrator", narrator);
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

    this.textEl.textContent = node?.text ?? "";
    this.textWrap.scrollTop = this.textWrap.scrollHeight;

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
    this.nextHint.classList.remove("show");
    this.hideChoices();

    if (node.bg) {
      this.setBackground(node.bg);
    }

    this.setSprites(node.sprites, node.speakingSprite);
    this.setSpeaker(node.speaker);
    this.typeText(node.text);
  }

  renderChoices(node) {
    this.choiceBox
      .querySelectorAll(".vn-choice-btn")
      .forEach((button) => button.remove());

    this.choiceLabel.textContent = node.choiceLabel ?? "";

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
        <span class="choice-text"></span>
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
    if (this.inputLocked || this.finished) return;

    if (this.typingActive) {
      this.finishTyping();
      return;
    }

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

  async finish() {
    if (this.finished) return;

    this.finished = true;
    this.isRunning = false;

    await this.exit();

    if (typeof this.onNext === "function") {
      await this.onNext();
      return;
    }

    await this.sceneManager?.next?.();
  }
}