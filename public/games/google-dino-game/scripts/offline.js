function _isIpad() {
  var isIpad = navigator.userAgent.toLowerCase().indexOf("ipad") !== -1;
  if (
    !isIpad &&
    navigator.userAgent.match(/Mac/) &&
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2
  ) {
    return true;
  }
  return isIpad;
}
function Runner(outerContainerId, opt_config) {
  if (Runner.instance_) {
    return Runner.instance_;
  }
  Runner.instance_ = this;
  this.outerContainerEl = document.querySelector(outerContainerId);
  this.containerEl = null;
  this.snackbarEl = null;
  this.touchController = null;
  this.config = opt_config || Object.assign(Runner.config, Runner.normalConfig);
  this.dimensions = Runner.defaultDimensions;
  this.gameType = null;
  Runner.spriteDefinition = Runner.spriteDefinitionByType["original"];
  this.altGameImageSprite = null;
  this.altGameModeActive = false;
  this.altGameModeFlashTimer = null;
  this.fadeInTimer = 0;
  this.canvas = null;
  this.canvasCtx = null;
  this.tRex = null;
  this.distanceMeter = null;
  this.distanceRan = 0;
  this.highestScore = window.localStorage.getItem("chrome-dino");
  this.syncHighestScore = false;
  this.time = 0;
  this.runningTime = 0;
  this.msPerFrame = 1000 / FPS;
  this.currentSpeed = this.config.SPEED;
  Runner.slowDown = false;
  this.obstacles = [];
  this.activated = false;
  this.playing = false;
  this.crashed = false;
  this.paused = false;
  this.inverted = false;
  this.invertTimer = 0;
  this.resizeTimerId_ = null;
  this.playCount = 0;
  this.audioBuffer = null;
  this.soundFx = {};
  this.generatedSoundFx = null;
  this.audioContext = null;
  this.images = {};
  this.imagesLoaded = 0;
  this.pollingGamepads = false;
  this.gamepadIndex = undefined;
  this.previousGamepad = null;
  if (this.isDisabled()) {
    this.setupDisabledRunner();
  } else {
    if (Runner.isAltGameModeEnabled()) {
      this.initAltGameType();
      Runner.gameType = this.gameType;
    }
    this.loadImages();
    window["initializeEasterEggHighScore"] =
      this.initializeHighScore.bind(this);
  }
}
const DEFAULT_WIDTH = 600;
const FPS = 60;
const IS_HIDPI = window.devicePixelRatio > 1;
const IS_IOS =
  (!!window.navigator.userAgent.match(/iP(hone|ad|od)/i) &&
    !!window.navigator.userAgent.match(/Safari/i)) ||
  _isIpad() ||
  /CriOS/.test(window.navigator.userAgent) ||
  /FxiOS/.test(window.navigator.userAgent);
const IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;
const IS_RTL = document.querySelector("html").dir == "rtl";
const ARCADE_MODE_URL = "chrome://dino/";
const RESOURCE_POSTFIX = "offline-resources-";
const A11Y_STRINGS = {
  ariaLabel: "dinoGameA11yAriaLabel",
  description: "dinoGameA11yDescription",
  gameOver: "dinoGameA11yGameOver",
  highScore: "dinoGameA11yHighScore",
  jump: "dinoGameA11yJump",
  started: "dinoGameA11yStartGame",
  speedLabel: "dinoGameA11ySpeedToggle",
};
Runner.config = {
  AUDIOCUE_PROXIMITY_THRESHOLD: 190,
  AUDIOCUE_PROXIMITY_THRESHOLD_MOBILE_A11Y: 250,
  BG_CLOUD_SPEED: 0.2,
  BOTTOM_PAD: 10,
  CANVAS_IN_VIEW_OFFSET: -10,
  CLEAR_TIME: 3000,
  CLOUD_FREQUENCY: 0.5,
  FADE_DURATION: 1,
  FLASH_DURATION: 1000,
  GAMEOVER_CLEAR_TIME: 1200,
  INITIAL_JUMP_VELOCITY: 12,
  INVERT_FADE_DURATION: 12000,
  MAX_BLINK_COUNT: 3,
  MAX_CLOUDS: 6,
  MAX_OBSTACLE_LENGTH: 3,
  MAX_OBSTACLE_DUPLICATION: 2,
  RESOURCE_TEMPLATE_ID: "audio-resources",
  SPEED: 6,
  SPEED_DROP_COEFFICIENT: 3,
  ARCADE_MODE_INITIAL_TOP_POSITION: 35,
  ARCADE_MODE_TOP_POSITION_PERCENT: 0.1,
};
Runner.normalConfig = {
  ACCELERATION: 0.001,
  AUDIOCUE_PROXIMITY_THRESHOLD: 190,
  AUDIOCUE_PROXIMITY_THRESHOLD_MOBILE_A11Y: 250,
  GAP_COEFFICIENT: 0.6,
  INVERT_DISTANCE: 700,
  MAX_SPEED: 13,
  MOBILE_SPEED_COEFFICIENT: 1.2,
  SPEED: 6,
};
Runner.slowConfig = {
  ACCELERATION: 0.0005,
  AUDIOCUE_PROXIMITY_THRESHOLD: 170,
  AUDIOCUE_PROXIMITY_THRESHOLD_MOBILE_A11Y: 220,
  GAP_COEFFICIENT: 0.3,
  INVERT_DISTANCE: 350,
  MAX_SPEED: 9,
  MOBILE_SPEED_COEFFICIENT: 1.5,
  SPEED: 4.2,
};
Runner.defaultDimensions = { WIDTH: DEFAULT_WIDTH, HEIGHT: 150 };
Runner.classes = {
  ARCADE_MODE: "arcade-mode",
  CANVAS: "runner-canvas",
  CONTAINER: "runner-container",
  CRASHED: "crashed",
  ICON: "icon-offline",
  INVERTED: "inverted",
  SNACKBAR: "snackbar",
  SNACKBAR_SHOW: "snackbar-show",
  TOUCH_CONTROLLER: "controller",
};
Runner.sounds = {
  BUTTON_PRESS: "offline-sound-press",
  HIT: "offline-sound-hit",
  SCORE: "offline-sound-reached",
};
Runner.keycodes = {
  JUMP: { 38: 1, 32: 1 },
  DUCK: { 40: 1 },
  RESTART: { 13: 1 },
};
Runner.events = {
  ANIM_END: "webkitAnimationEnd",
  CLICK: "click",
  KEYDOWN: "keydown",
  KEYUP: "keyup",
  POINTERDOWN: "pointerdown",
  POINTERUP: "pointerup",
  RESIZE: "resize",
  TOUCHEND: "touchend",
  TOUCHSTART: "touchstart",
  VISIBILITY: "visibilitychange",
  BLUR: "blur",
  FOCUS: "focus",
  LOAD: "load",
  GAMEPADCONNECTED: "gamepadconnected",
};
Runner.prototype = {
  initAltGameType() {
    if (GAME_TYPE.length > 0) {
      this.gameType =
        loadTimeData && loadTimeData.valueExists("altGameType")
          ? GAME_TYPE[parseInt(loadTimeData.getValue("altGameType"), 10) - 1]
          : "";
    }
  },
  isDisabled() {
    return loadTimeData && loadTimeData.valueExists("disabledEasterEgg");
  },
  setupDisabledRunner() {
    this.containerEl = document.createElement("div");
    this.containerEl.className = Runner.classes.SNACKBAR;
    this.containerEl.textContent = loadTimeData.getValue("disabledEasterEgg");
    this.outerContainerEl.appendChild(this.containerEl);
    document.addEventListener(
      Runner.events.KEYDOWN,
      function (e) {
        if (Runner.keycodes.JUMP[e.keyCode]) {
          this.containerEl.classList.add(Runner.classes.SNACKBAR_SHOW);
          document.querySelector(".icon").classList.add("icon-disabled");
        }
      }.bind(this)
    );
  },
  updateConfigSetting(setting, value) {
    if (setting in this.config && value !== undefined) {
      this.config[setting] = value;
      switch (setting) {
        case "GRAVITY":
        case "MIN_JUMP_HEIGHT":
        case "SPEED_DROP_COEFFICIENT":
          this.tRex.config[setting] = value;
          break;
        case "INITIAL_JUMP_VELOCITY":
          this.tRex.setJumpVelocity(value);
          break;
        case "SPEED":
          this.setSpeed(value);
          break;
      }
    }
  },
  createImageElement(resourceName) {
    const imgSrc =
      loadTimeData && loadTimeData.valueExists(resourceName)
        ? loadTimeData.getString(resourceName)
        : null;
    if (imgSrc) {
      const el = document.createElement("img");
      el.id = resourceName;
      el.src = imgSrc;
      document.getElementById("offline-resources").appendChild(el);
      return el;
    }
    return null;
  },
  loadImages() {
    let scale = "1x";
    this.spriteDef = Runner.spriteDefinition.LDPI;
    if (IS_HIDPI) {
      scale = "2x";
      this.spriteDef = Runner.spriteDefinition.HDPI;
    }
    Runner.imageSprite = document.getElementById(RESOURCE_POSTFIX + scale);
    if (this.gameType) {
      Runner.altGameImageSprite = this.createImageElement(
        "altGameSpecificImage" + scale
      );
      Runner.altCommonImageSprite = this.createImageElement(
        "altGameCommonImage" + scale
      );
    }
    Runner.origImageSprite = Runner.imageSprite;
    if (!Runner.altGameImageSprite || !Runner.altCommonImageSprite) {
      Runner.isAltGameModeEnabled = () => false;
      this.altGameModeActive = false;
    }
    if (Runner.imageSprite.complete) {
      this.init();
    } else {
      Runner.imageSprite.addEventListener(
        Runner.events.LOAD,
        this.init.bind(this)
      );
    }
  },
  loadSounds() {
    if (!IS_IOS) {
      this.audioContext = new AudioContext();
      const resourceTemplate = document.getElementById(
        this.config.RESOURCE_TEMPLATE_ID
      ).content;
      for (const sound in Runner.sounds) {
        let soundSrc = resourceTemplate.getElementById(
          Runner.sounds[sound]
        ).src;
        soundSrc = soundSrc.substr(soundSrc.indexOf(",") + 1);
        const buffer = decodeBase64ToArrayBuffer(soundSrc);
        this.audioContext.decodeAudioData(
          buffer,
          function (index, audioData) {
            this.soundFx[index] = audioData;
          }.bind(this, sound)
        );
      }
    }
  },
  setSpeed(opt_speed) {
    const speed = opt_speed || this.currentSpeed;
    if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
      const mobileSpeed = Runner.slowDown
        ? speed
        : ((speed * this.dimensions.WIDTH) / DEFAULT_WIDTH) *
          this.config.MOBILE_SPEED_COEFFICIENT;
      this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
    } else if (opt_speed) {
      this.currentSpeed = opt_speed;
    }
  },
  init() {
    document.querySelector("." + Runner.classes.ICON).style.visibility =
      "hidden";
    this.adjustDimensions();
    this.setSpeed();
    const ariaLabel = getA11yString(A11Y_STRINGS.ariaLabel);
    this.containerEl = document.createElement("div");
    this.containerEl.setAttribute("role", IS_MOBILE ? "button" : "application");
    this.containerEl.setAttribute("tabindex", "0");
    this.containerEl.setAttribute("title", ariaLabel);
    this.containerEl.className = Runner.classes.CONTAINER;
    this.canvas = createCanvas(
      this.containerEl,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT
    );
    this.a11yStatusEl = document.createElement("span");
    this.a11yStatusEl.className = "offline-runner-live-region";
    this.a11yStatusEl.setAttribute("aria-live", "assertive");
    this.a11yStatusEl.textContent = "";
    Runner.a11yStatusEl = this.a11yStatusEl;
    this.slowSpeedCheckboxLabel = document.createElement("label");
    this.slowSpeedCheckboxLabel.className = "slow-speed-option hidden";
    this.slowSpeedCheckboxLabel.textContent = getA11yString(
      A11Y_STRINGS.speedLabel
    );
    this.slowSpeedCheckbox = document.createElement("input");
    this.slowSpeedCheckbox.setAttribute("type", "checkbox");
    this.slowSpeedCheckbox.setAttribute(
      "title",
      getA11yString(A11Y_STRINGS.speedLabel)
    );
    this.slowSpeedCheckbox.setAttribute("tabindex", "0");
    this.slowSpeedCheckbox.setAttribute("checked", "checked");
    this.slowSpeedToggleEl = document.createElement("span");
    this.slowSpeedToggleEl.className = "slow-speed-toggle";
    this.slowSpeedCheckboxLabel.appendChild(this.slowSpeedCheckbox);
    this.slowSpeedCheckboxLabel.appendChild(this.slowSpeedToggleEl);
    if (IS_IOS) {
      this.outerContainerEl.appendChild(this.a11yStatusEl);
    } else {
      this.containerEl.appendChild(this.a11yStatusEl);
    }
    announcePhrase(getA11yString(A11Y_STRINGS.description));
    this.generatedSoundFx = new GeneratedSoundFx();
    this.canvasCtx = this.canvas.getContext("2d");
    this.canvasCtx.fillStyle = "#f7f7f7";
    this.canvasCtx.fill();
    Runner.updateCanvasScaling(this.canvas);
    this.horizon = new Horizon(
      this.canvas,
      this.spriteDef,
      this.dimensions,
      this.config.GAP_COEFFICIENT
    );
    this.distanceMeter = new DistanceMeter(
      this.canvas,
      this.spriteDef.TEXT_SPRITE,
      this.dimensions.WIDTH
    );
    this.tRex = new Trex(this.canvas, this.spriteDef.TREX);
    this.outerContainerEl.appendChild(this.containerEl);
    this.outerContainerEl.appendChild(this.slowSpeedCheckboxLabel);
    this.startListening();
    this.update();
    window.addEventListener(
      Runner.events.RESIZE,
      this.debounceResize.bind(this)
    );
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );
    this.isDarkMode = darkModeMediaQuery && darkModeMediaQuery.matches;
    darkModeMediaQuery.addListener((e) => {
      this.isDarkMode = e.matches;
    });
  },
  createTouchController() {
    this.touchController = document.createElement("div");
    this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
    this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
    this.touchController.addEventListener(Runner.events.TOUCHEND, this);
    this.outerContainerEl.appendChild(this.touchController);
  },
  debounceResize() {
    if (!this.resizeTimerId_) {
      this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250);
    }
  },
  adjustDimensions() {
    clearInterval(this.resizeTimerId_);
    this.resizeTimerId_ = null;
    const boxStyles = window.getComputedStyle(this.outerContainerEl);
    const padding = Number(
      boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2)
    );
    this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;
    if (this.isArcadeMode()) {
      this.dimensions.WIDTH = Math.min(DEFAULT_WIDTH, this.dimensions.WIDTH);
      if (this.activated) {
        this.setArcadeModeContainerScale();
      }
    }
    if (this.canvas) {
      this.canvas.width = this.dimensions.WIDTH;
      this.canvas.height = this.dimensions.HEIGHT;
      Runner.updateCanvasScaling(this.canvas);
      this.distanceMeter.calcXPos(this.dimensions.WIDTH);
      this.clearCanvas();
      this.horizon.update(0, 0, true);
      this.tRex.update(0);
      if (this.playing || this.crashed || this.paused) {
        this.containerEl.style.width = this.dimensions.WIDTH + "px";
        this.containerEl.style.height = this.dimensions.HEIGHT + "px";
        this.distanceMeter.update(0, Math.ceil(this.distanceRan));
        this.stop();
      } else {
        this.tRex.draw(0, 0);
      }
      if (this.crashed && this.gameOverPanel) {
        this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
        this.gameOverPanel.draw(this.altGameModeActive, this.tRex);
      }
    }
  },
  playIntro() {
    if (!this.activated && !this.crashed) {
      this.playingIntro = true;
      this.tRex.playingIntro = true;
      if (window.localStorage.getItem("chrome-dino") !== null) {
        this.distanceMeter.setHighScore(
          window.localStorage.getItem("chrome-dino")
        );
      }
      const keyframes =
        "@-webkit-keyframes intro { " +
        "from { width:" +
        Trex.config.WIDTH +
        "px }" +
        "to { width: " +
        this.dimensions.WIDTH +
        "px }" +
        "}";
      var sheet = document.createElement("style");
      sheet.innerHTML = keyframes;
      document.head.appendChild(sheet);
      this.containerEl.addEventListener(
        Runner.events.ANIM_END,
        this.startGame.bind(this)
      );
      this.containerEl.style.webkitAnimation = "intro .4s ease-out 1 both";
      this.containerEl.style.width = this.dimensions.WIDTH + "px";
      this.setPlayStatus(true);
      this.activated = true;
    } else if (this.crashed) {
      this.restart();
    }
  },
  startGame() {
    if (this.isArcadeMode()) {
      this.setArcadeMode();
    }
    this.toggleSpeed();
    this.runningTime = 0;
    this.playingIntro = false;
    this.tRex.playingIntro = false;
    this.containerEl.style.webkitAnimation = "";
    this.playCount++;
    this.generatedSoundFx.background();
    announcePhrase(getA11yString(A11Y_STRINGS.started));
    if (Runner.audioCues) {
      this.containerEl.setAttribute("title", getA11yString(A11Y_STRINGS.jump));
    }
    document.addEventListener(
      Runner.events.VISIBILITY,
      this.onVisibilityChange.bind(this)
    );
    window.addEventListener(
      Runner.events.BLUR,
      this.onVisibilityChange.bind(this)
    );
    window.addEventListener(
      Runner.events.FOCUS,
      this.onVisibilityChange.bind(this)
    );
  },
  clearCanvas() {
    this.canvasCtx.clearRect(
      0,
      0,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT
    );
  },
  isCanvasInView() {
    return (
      this.containerEl.getBoundingClientRect().top >
      Runner.config.CANVAS_IN_VIEW_OFFSET
    );
  },
  enableAltGameMode() {
    Runner.imageSprite = Runner.altGameImageSprite;
    Runner.spriteDefinition = Runner.spriteDefinitionByType[Runner.gameType];
    if (IS_HIDPI) {
      this.spriteDef = Runner.spriteDefinition.HDPI;
    } else {
      this.spriteDef = Runner.spriteDefinition.LDPI;
    }
    this.altGameModeActive = true;
    this.tRex.enableAltGameMode(this.spriteDef.TREX);
    this.horizon.enableAltGameMode(this.spriteDef);
    this.generatedSoundFx.background();
  },
  update() {
    this.updatePending = false;
    const now = getTimeStamp();
    let deltaTime = now - (this.time || now);
    if (this.altGameModeFlashTimer < 0 || this.altGameModeFlashTimer === 0) {
      this.altGameModeFlashTimer = null;
      this.tRex.setFlashing(false);
      this.enableAltGameMode();
    } else if (this.altGameModeFlashTimer > 0) {
      this.altGameModeFlashTimer -= deltaTime;
      this.tRex.update(deltaTime);
      deltaTime = 0;
    }
    this.time = now;
    if (this.playing) {
      this.clearCanvas();
      if (
        this.altGameModeActive &&
        this.fadeInTimer <= this.config.FADE_DURATION
      ) {
        this.fadeInTimer += deltaTime / 1000;
        this.canvasCtx.globalAlpha = this.fadeInTimer;
      } else {
        this.canvasCtx.globalAlpha = 1;
      }
      if (this.tRex.jumping) {
        this.tRex.updateJump(deltaTime);
      }
      this.runningTime += deltaTime;
      const hasObstacles = this.runningTime > this.config.CLEAR_TIME;
      if (this.tRex.jumpCount === 1 && !this.playingIntro) {
        this.playIntro();
      }
      if (this.playingIntro) {
        this.horizon.update(0, this.currentSpeed, hasObstacles);
      } else if (!this.crashed) {
        const showNightMode = this.isDarkMode ^ this.inverted;
        deltaTime = !this.activated ? 0 : deltaTime;
        this.horizon.update(
          deltaTime,
          this.currentSpeed,
          hasObstacles,
          showNightMode
        );
      }
      let collision =
        hasObstacles && checkForCollision(this.horizon.obstacles[0], this.tRex);
      if (Runner.audioCues && hasObstacles) {
        const jumpObstacle =
          this.horizon.obstacles[0].typeConfig.type != "COLLECTABLE";
        if (!this.horizon.obstacles[0].jumpAlerted) {
          const threshold = Runner.isMobileMouseInput
            ? Runner.config.AUDIOCUE_PROXIMITY_THRESHOLD_MOBILE_A11Y
            : Runner.config.AUDIOCUE_PROXIMITY_THRESHOLD;
          const adjProximityThreshold =
            threshold +
            threshold * Math.log10(this.currentSpeed / Runner.config.SPEED);
          if (this.horizon.obstacles[0].xPos < adjProximityThreshold) {
            if (jumpObstacle) {
              this.generatedSoundFx.jump();
            }
            this.horizon.obstacles[0].jumpAlerted = true;
          }
        }
      }
      if (
        Runner.isAltGameModeEnabled() &&
        collision &&
        this.horizon.obstacles[0].typeConfig.type == "COLLECTABLE"
      ) {
        this.horizon.removeFirstObstacle();
        this.tRex.setFlashing(true);
        collision = false;
        this.altGameModeFlashTimer = this.config.FLASH_DURATION;
        this.runningTime = 0;
        this.generatedSoundFx.collect();
      }
      if (!collision) {
        this.distanceRan += (this.currentSpeed * deltaTime) / this.msPerFrame;
        if (this.currentSpeed < this.config.MAX_SPEED) {
          this.currentSpeed += this.config.ACCELERATION;
        }
      } else {
        this.gameOver();
      }
      const playAchievementSound = this.distanceMeter.update(
        deltaTime,
        Math.ceil(this.distanceRan)
      );
      if (!Runner.audioCues && playAchievementSound) {
        this.playSound(this.soundFx.SCORE);
      }
      if (!Runner.isAltGameModeEnabled()) {
        if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
          this.invertTimer = 0;
          this.invertTrigger = false;
          this.invert(false);
        } else if (this.invertTimer) {
          this.invertTimer += deltaTime;
        } else {
          const actualDistance = this.distanceMeter.getActualDistance(
            Math.ceil(this.distanceRan)
          );
          if (actualDistance > 0) {
            this.invertTrigger = !(
              actualDistance % this.config.INVERT_DISTANCE
            );
            if (this.invertTrigger && this.invertTimer === 0) {
              this.invertTimer += deltaTime;
              this.invert(false);
            }
          }
        }
      }
    }
    if (
      this.playing ||
      (!this.activated && this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)
    ) {
      this.tRex.update(deltaTime);
      this.scheduleNextUpdate();
    }
  },
  handleEvent(e) {
    return function (evtType, events) {
      switch (evtType) {
        case events.KEYDOWN:
        case events.TOUCHSTART:
        case events.POINTERDOWN:
          this.onKeyDown(e);
          break;
        case events.KEYUP:
        case events.TOUCHEND:
        case events.POINTERUP:
          this.onKeyUp(e);
          break;
        case events.GAMEPADCONNECTED:
          this.onGamepadConnected(e);
          break;
      }
    }.bind(this)(e.type, Runner.events);
  },
  handleCanvasKeyPress(e) {
    if (!this.activated && !Runner.audioCues) {
      this.toggleSpeed();
      Runner.audioCues = true;
      this.generatedSoundFx.init();
      Runner.generatedSoundFx = this.generatedSoundFx;
      Runner.config.CLEAR_TIME *= 1.2;
    } else if (e.keyCode && Runner.keycodes.JUMP[e.keyCode]) {
      this.onKeyDown(e);
    }
  },
  preventScrolling(e) {
    if (e.keyCode === 32) {
      e.preventDefault();
    }
  },
  toggleSpeed() {
    if (Runner.audioCues) {
      const speedChange = Runner.slowDown != this.slowSpeedCheckbox.checked;
      if (speedChange) {
        Runner.slowDown = this.slowSpeedCheckbox.checked;
        const updatedConfig = Runner.slowDown
          ? Runner.slowConfig
          : Runner.normalConfig;
        Runner.config = Object.assign(Runner.config, updatedConfig);
        this.currentSpeed = updatedConfig.SPEED;
        this.tRex.enableSlowConfig();
        this.horizon.adjustObstacleSpeed();
      }
      if (this.playing) {
        this.disableSpeedToggle(true);
      }
    }
  },
  showSpeedToggle(e) {
    const isFocusEvent = e && e.type == "focus";
    if (Runner.audioCues || isFocusEvent) {
      this.slowSpeedCheckboxLabel.classList.toggle(
        HIDDEN_CLASS,
        isFocusEvent ? false : !this.crashed
      );
    }
  },
  disableSpeedToggle(disable) {
    if (disable) {
      this.slowSpeedCheckbox.setAttribute("disabled", "disabled");
    } else {
      this.slowSpeedCheckbox.removeAttribute("disabled");
    }
  },
  startListening() {
    this.containerEl.addEventListener(
      Runner.events.KEYDOWN,
      this.handleCanvasKeyPress.bind(this)
    );
    if (!IS_MOBILE) {
      this.containerEl.addEventListener(
        Runner.events.FOCUS,
        this.showSpeedToggle.bind(this)
      );
    }
    this.canvas.addEventListener(
      Runner.events.KEYDOWN,
      this.preventScrolling.bind(this)
    );
    this.canvas.addEventListener(
      Runner.events.KEYUP,
      this.preventScrolling.bind(this)
    );
    document.addEventListener(Runner.events.KEYDOWN, this);
    document.addEventListener(Runner.events.KEYUP, this);
    this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
    document.addEventListener(Runner.events.POINTERDOWN, this);
    document.addEventListener(Runner.events.POINTERUP, this);
    if (this.isArcadeMode()) {
      window.addEventListener(Runner.events.GAMEPADCONNECTED, this);
    }
  },
  stopListening() {
    document.removeEventListener(Runner.events.KEYDOWN, this);
    document.removeEventListener(Runner.events.KEYUP, this);
    if (this.touchController) {
      this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
      this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
    }
    this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
    document.removeEventListener(Runner.events.POINTERDOWN, this);
    document.removeEventListener(Runner.events.POINTERUP, this);
    if (this.isArcadeMode()) {
      window.removeEventListener(Runner.events.GAMEPADCONNECTED, this);
    }
  },
  onKeyDown(e) {
    if (IS_MOBILE && this.playing) {
      e.preventDefault();
    }
    if (this.isCanvasInView()) {
      if (
        Runner.keycodes.JUMP[e.keyCode] &&
        e.target == this.slowSpeedCheckbox
      ) {
        return;
      }
      if (!this.crashed && !this.paused) {
        const isMobileMouseInput =
          (IS_MOBILE &&
            e.type === Runner.events.POINTERDOWN &&
            e.pointerType == "mouse" &&
            e.target == this.containerEl) ||
          (IS_IOS &&
            e.pointerType == "touch" &&
            document.activeElement == this.containerEl);
        if (
          Runner.keycodes.JUMP[e.keyCode] ||
          e.type === Runner.events.TOUCHSTART ||
          isMobileMouseInput ||
          (Runner.keycodes.DUCK[e.keyCode] && this.altGameModeActive)
        ) {
          e.preventDefault();
          if (!this.playing) {
            if (!this.touchController && e.type === Runner.events.TOUCHSTART) {
              this.createTouchController();
            }
            if (isMobileMouseInput) {
              this.handleCanvasKeyPress(e);
            }
            this.loadSounds();
            this.setPlayStatus(true);
            this.update();
            if (window.errorPageController) {
              errorPageController.trackEasterEgg();
            }
          }
          if (!this.tRex.jumping && !this.tRex.ducking) {
            if (Runner.audioCues) {
              this.generatedSoundFx.cancelFootSteps();
            } else {
              this.playSound(this.soundFx.BUTTON_PRESS);
            }
            this.tRex.startJump(this.currentSpeed);
          }
        } else if (
          !this.altGameModeActive &&
          this.playing &&
          Runner.keycodes.DUCK[e.keyCode]
        ) {
          e.preventDefault();
          if (this.tRex.jumping) {
            this.tRex.setSpeedDrop();
          } else if (!this.tRex.jumping && !this.tRex.ducking) {
            this.tRex.setDuck(true);
          }
        }
      }
    }
  },
  onKeyUp(e) {
    const keyCode = String(e.keyCode);
    const isjumpKey =
      Runner.keycodes.JUMP[keyCode] ||
      e.type === Runner.events.TOUCHEND ||
      e.type === Runner.events.POINTERUP;
    if (this.isRunning() && isjumpKey) {
      this.tRex.endJump();
    } else if (Runner.keycodes.DUCK[keyCode]) {
      this.tRex.speedDrop = false;
      this.tRex.setDuck(false);
    } else if (this.crashed) {
      const deltaTime = getTimeStamp() - this.time;
      if (
        this.isCanvasInView() &&
        (Runner.keycodes.RESTART[keyCode] ||
          this.isLeftClickOnCanvas(e) ||
          (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
            Runner.keycodes.JUMP[keyCode]))
      ) {
        this.handleGameOverClicks(e);
      }
    } else if (this.paused && isjumpKey) {
      this.tRex.reset();
      this.play();
    }
  },
  onGamepadConnected(e) {
    if (!this.pollingGamepads) {
      this.pollGamepadState();
    }
  },
  pollGamepadState() {
    const gamepads = navigator.getGamepads();
    this.pollActiveGamepad(gamepads);
    this.pollingGamepads = true;
    requestAnimationFrame(this.pollGamepadState.bind(this));
  },
  pollForActiveGamepad(gamepads) {
    for (let i = 0; i < gamepads.length; ++i) {
      if (
        gamepads[i] &&
        gamepads[i].buttons.length > 0 &&
        gamepads[i].buttons[0].pressed
      ) {
        this.gamepadIndex = i;
        this.pollActiveGamepad(gamepads);
        return;
      }
    }
  },
  pollActiveGamepad(gamepads) {
    if (this.gamepadIndex === undefined) {
      this.pollForActiveGamepad(gamepads);
      return;
    }
    const gamepad = gamepads[this.gamepadIndex];
    if (!gamepad) {
      this.gamepadIndex = undefined;
      this.pollForActiveGamepad(gamepads);
      return;
    }
    this.pollGamepadButton(gamepad, 0, 38);
    if (gamepad.buttons.length >= 2) {
      this.pollGamepadButton(gamepad, 1, 40);
    }
    if (gamepad.buttons.length >= 10) {
      this.pollGamepadButton(gamepad, 9, 13);
    }
    this.previousGamepad = gamepad;
  },
  pollGamepadButton(gamepad, buttonIndex, keyCode) {
    const state = gamepad.buttons[buttonIndex].pressed;
    let previousState = false;
    if (this.previousGamepad) {
      previousState = this.previousGamepad.buttons[buttonIndex].pressed;
    }
    if (state !== previousState) {
      const e = new KeyboardEvent(
        state ? Runner.events.KEYDOWN : Runner.events.KEYUP,
        { keyCode: keyCode }
      );
      document.dispatchEvent(e);
    }
  },
  handleGameOverClicks(e) {
    if (e.target != this.slowSpeedCheckbox) {
      e.preventDefault();
      if (this.distanceMeter.hasClickedOnHighScore(e) && this.highestScore) {
        if (this.distanceMeter.isHighScoreFlashing()) {
          this.saveHighScore(0, true);
          this.distanceMeter.resetHighScore();
          this.distanceMeter.setHighScore(
            window.localStorage.removeItem("chrome-dino")
          );
        } else {
          this.distanceMeter.startHighScoreFlashing();
        }
      } else {
        this.distanceMeter.cancelHighScoreFlashing();
        this.restart();
      }
    }
  },
  isLeftClickOnCanvas(e) {
    return (
      e.button != null &&
      e.button < 2 &&
      e.type === Runner.events.POINTERUP &&
      (e.target === this.canvas ||
        (IS_MOBILE && Runner.audioCues && e.target === this.containerEl))
    );
  },
  scheduleNextUpdate() {
    if (!this.updatePending) {
      this.updatePending = true;
      this.raqId = requestAnimationFrame(this.update.bind(this));
    }
  },
  isRunning() {
    return !!this.raqId;
  },
  initializeHighScore(highScore) {
    this.syncHighestScore = true;
    highScore = Math.ceil(highScore);
    if (highScore < this.highestScore) {
      if (window.errorPageController) {
        errorPageController.updateEasterEggHighScore(this.highestScore);
      }
      return;
    }
    this.highestScore = highScore;
    this.distanceMeter.setHighScore(this.highestScore);
  },
  saveHighScore(distanceRan, opt_resetScore) {
    this.highestScore = Math.ceil(distanceRan);
    this.distanceMeter.setHighScore(this.highestScore);
    if (this.syncHighestScore && window.errorPageController) {
      if (opt_resetScore) {
        errorPageController.resetEasterEggHighScore();
      } else {
        errorPageController.updateEasterEggHighScore(this.highestScore);
      }
    }
  },
  gameOver() {
    this.playSound(this.soundFx.HIT);
    vibrate(200);
    this.stop();
    this.crashed = true;
    this.distanceMeter.achievement = false;
    this.tRex.update(100, Trex.status.CRASHED);
    if (!this.gameOverPanel) {
      const origSpriteDef = IS_HIDPI
        ? Runner.spriteDefinitionByType.original.HDPI
        : Runner.spriteDefinitionByType.original.LDPI;
      if (this.canvas) {
        if (Runner.isAltGameModeEnabled) {
          this.gameOverPanel = new GameOverPanel(
            this.canvas,
            origSpriteDef.TEXT_SPRITE,
            origSpriteDef.RESTART,
            this.dimensions,
            origSpriteDef.ALT_GAME_END,
            this.altGameModeActive
          );
        } else {
          this.gameOverPanel = new GameOverPanel(
            this.canvas,
            origSpriteDef.TEXT_SPRITE,
            origSpriteDef.RESTART,
            this.dimensions
          );
        }
      }
    }
    this.gameOverPanel.draw(this.altGameModeActive, this.tRex);
    if (this.distanceRan > this.highestScore) {
      this.saveHighScore(this.distanceRan);
      window.localStorage.setItem("chrome-dino", this.distanceRan);
    }
    this.time = getTimeStamp();
    if (Runner.audioCues) {
      this.generatedSoundFx.stopAll();
      announcePhrase(
        getA11yString(A11Y_STRINGS.gameOver).replace(
          "$1",
          this.distanceMeter.getActualDistance(this.distanceRan).toString()
        ) +
          " " +
          getA11yString(A11Y_STRINGS.highScore).replace(
            "$1",
            this.distanceMeter.getActualDistance(this.highestScore).toString()
          )
      );
      this.containerEl.setAttribute(
        "title",
        getA11yString(A11Y_STRINGS.ariaLabel)
      );
    }
    this.showSpeedToggle();
    this.disableSpeedToggle(false);
  },
  stop() {
    this.setPlayStatus(false);
    this.paused = true;
    cancelAnimationFrame(this.raqId);
    this.raqId = 0;
    this.generatedSoundFx.stopAll();
  },
  play() {
    if (!this.crashed) {
      this.setPlayStatus(true);
      this.paused = false;
      this.tRex.update(0, Trex.status.RUNNING);
      this.time = getTimeStamp();
      this.update();
      this.generatedSoundFx.background();
    }
  },
  restart() {
    if (!this.raqId) {
      this.playCount++;
      this.runningTime = 0;
      this.setPlayStatus(true);
      this.toggleSpeed();
      this.paused = false;
      this.crashed = false;
      this.distanceRan = 0;
      this.setSpeed(this.config.SPEED);
      this.time = getTimeStamp();
      this.containerEl.classList.remove(Runner.classes.CRASHED);
      this.clearCanvas();
      this.distanceMeter.reset();
      this.horizon.reset();
      this.tRex.reset();
      this.playSound(this.soundFx.BUTTON_PRESS);
      this.invert(true);
      this.flashTimer = null;
      this.update();
      this.gameOverPanel.reset();
      this.generatedSoundFx.background();
      this.containerEl.setAttribute("title", getA11yString(A11Y_STRINGS.jump));
      announcePhrase(getA11yString(A11Y_STRINGS.started));
    }
  },
  setPlayStatus(isPlaying) {
    if (this.touchController) {
      this.touchController.classList.toggle(HIDDEN_CLASS, !isPlaying);
    }
    this.playing = isPlaying;
  },
  isArcadeMode() {
    return true;
  },
  setArcadeMode() {
    document.body.classList.add(Runner.classes.ARCADE_MODE);
    this.setArcadeModeContainerScale();
  },
  setArcadeModeContainerScale() {
    const windowHeight = window.innerHeight;
    const scaleHeight = windowHeight / this.dimensions.HEIGHT;
    const scaleWidth = window.innerWidth / this.dimensions.WIDTH;
    const scale = Math.max(1, Math.min(scaleHeight, scaleWidth));
    const scaledCanvasHeight = this.dimensions.HEIGHT * scale;
    const translateY =
      Math.ceil(
        Math.max(
          0,
          (windowHeight -
            scaledCanvasHeight -
            Runner.config.ARCADE_MODE_INITIAL_TOP_POSITION) *
            Runner.config.ARCADE_MODE_TOP_POSITION_PERCENT
        )
      ) * window.devicePixelRatio;
    const cssScale = IS_RTL ? -scale + "," + scale : scale;
    this.containerEl.style.transform =
      "scale(" + cssScale + ") translateY(" + translateY + "px)";
  },
  onVisibilityChange(e) {
    if (
      document.hidden ||
      document.webkitHidden ||
      e.type === "blur" ||
      document.visibilityState !== "visible"
    ) {
      this.stop();
    } else if (!this.crashed) {
      this.tRex.reset();
      this.play();
    }
  },
  playSound(soundBuffer) {
    if (soundBuffer) {
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = soundBuffer;
      sourceNode.connect(this.audioContext.destination);
      sourceNode.start(0);
    }
  },
  invert(reset) {
    const htmlEl = document.firstElementChild;
    if (reset) {
      htmlEl.classList.toggle(Runner.classes.INVERTED, false);
      this.invertTimer = 0;
      this.inverted = false;
    } else {
      this.inverted = htmlEl.classList.toggle(
        Runner.classes.INVERTED,
        this.invertTrigger
      );
    }
  },
};
Runner.updateCanvasScaling = function (canvas, opt_width, opt_height) {
  const context = canvas.getContext("2d");
  const devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
  const backingStoreRatio =
    Math.floor(context.webkitBackingStorePixelRatio) || 1;
  const ratio = devicePixelRatio / backingStoreRatio;
  if (devicePixelRatio !== backingStoreRatio) {
    const oldWidth = opt_width || canvas.width;
    const oldHeight = opt_height || canvas.height;
    canvas.width = oldWidth * ratio;
    canvas.height = oldHeight * ratio;
    canvas.style.width = oldWidth + "px";
    canvas.style.height = oldHeight + "px";
    context.scale(ratio, ratio);
    return true;
  } else if (devicePixelRatio === 1) {
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
  }
  return false;
};
Runner.isAltGameModeEnabled = function () {
  return loadTimeData && loadTimeData.valueExists("enableAltGameMode");
};
function GeneratedSoundFx() {
  this.audioCues = false;
  this.context = null;
  this.panner = null;
}
GeneratedSoundFx.prototype = {
  init() {
    this.audioCues = true;
    if (!this.context) {
      this.context = window.webkitAudioContext
        ? new webkitAudioContext()
        : new AudioContext();
      if (IS_IOS) {
        this.context.onstatechange = function () {
          if (this.context.state != "running") {
            this.context.resume();
          }
        }.bind(this);
        this.context.resume();
      }
      this.panner = this.context.createStereoPanner
        ? this.context.createStereoPanner()
        : null;
    }
  },
  stopAll() {
    this.cancelFootSteps();
  },
  playNote(frequency, startTime, duration, opt_vol, opt_pan) {
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const volume = this.context.createGain();
    osc1.type = "triangle";
    osc2.type = "triangle";
    volume.gain.value = 0.1;
    if (this.panner) {
      this.panner.pan.value = opt_pan || 0;
      osc1.connect(volume).connect(this.panner);
      osc2.connect(volume).connect(this.panner);
      this.panner.connect(this.context.destination);
    } else {
      osc1.connect(volume);
      osc2.connect(volume);
      volume.connect(this.context.destination);
    }
    osc1.frequency.value = frequency + 1;
    osc2.frequency.value = frequency - 2;
    volume.gain.setValueAtTime(opt_vol || 0.01, startTime + duration - 0.05);
    volume.gain.linearRampToValueAtTime(0.00001, startTime + duration);
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  },
  background() {
    if (this.audioCues) {
      const now = this.context.currentTime;
      this.playNote(493.883, now, 0.116);
      this.playNote(659.255, now + 0.116, 0.232);
      this.loopFootSteps();
    }
  },
  loopFootSteps() {
    if (this.audioCues && !this.bgSoundIntervalId) {
      this.bgSoundIntervalId = setInterval(
        function () {
          this.playNote(73.42, this.context.currentTime, 0.05, 0.16);
          this.playNote(69.3, this.context.currentTime + 0.116, 0.116, 0.16);
        }.bind(this),
        280
      );
    }
  },
  cancelFootSteps() {
    if (this.audioCues && this.bgSoundIntervalId) {
      clearInterval(this.bgSoundIntervalId);
      this.bgSoundIntervalId = null;
      this.playNote(103.83, this.context.currentTime, 0.232, 0.02);
      this.playNote(116.54, this.context.currentTime + 0.116, 0.232, 0.02);
    }
  },
  collect() {
    if (this.audioCues) {
      this.cancelFootSteps();
      const now = this.context.currentTime;
      this.playNote(830.61, now, 0.116);
      this.playNote(1318.51, now + 0.116, 0.232);
    }
  },
  jump() {
    if (this.audioCues) {
      const now = this.context.currentTime;
      this.playNote(659.25, now, 0.116, 0.3, -0.6);
      this.playNote(880, now + 0.116, 0.232, 0.3, -0.6);
    }
  },
};
function speakPhrase(phrase) {
  if ("speechSynthesis" in window) {
    const msg = new SpeechSynthesisUtterance(phrase);
    const voices = window.speechSynthesis.getVoices();
    msg.text = phrase;
    speechSynthesis.speak(msg);
  }
}
function announcePhrase(phrase) {
  if (Runner.a11yStatusEl) {
    Runner.a11yStatusEl.textContent = "";
    Runner.a11yStatusEl.textContent = phrase;
  }
}
function getA11yString(stringName) {
  return loadTimeData && loadTimeData.valueExists(stringName)
    ? loadTimeData.getString(stringName)
    : "";
}
function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function vibrate(duration) {
  if (IS_MOBILE && window.navigator.vibrate) {
    window.navigator.vibrate(duration);
  }
}
function createCanvas(container, width, height, opt_classname) {
  const canvas = document.createElement("canvas");
  canvas.className = opt_classname
    ? Runner.classes.CANVAS + " " + opt_classname
    : Runner.classes.CANVAS;
  canvas.width = width;
  canvas.height = height;
  container.appendChild(canvas);
  return canvas;
}
function decodeBase64ToArrayBuffer(base64String) {
  const len = (base64String.length / 4) * 3;
  const str = atob(base64String);
  const arrayBuffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}
function getTimeStamp() {
  return IS_IOS ? new Date().getTime() : performance.now();
}
function GameOverPanel(
  canvas,
  textImgPos,
  restartImgPos,
  dimensions,
  opt_altGameEndImgPos,
  opt_altGameActive
) {
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext("2d");
  this.canvasDimensions = dimensions;
  this.textImgPos = textImgPos;
  this.restartImgPos = restartImgPos;
  this.altGameEndImgPos = opt_altGameEndImgPos;
  this.altGameModeActive = opt_altGameActive;
  this.frameTimeStamp = 0;
  this.animTimer = 0;
  this.currentFrame = 0;
  this.gameOverRafId = null;
  this.flashTimer = 0;
  this.flashCounter = 0;
  this.originalText = true;
}
GameOverPanel.RESTART_ANIM_DURATION = 875;
GameOverPanel.LOGO_PAUSE_DURATION = 875;
GameOverPanel.FLASH_ITERATIONS = 5;
GameOverPanel.animConfig = {
  frames: [0, 36, 72, 108, 144, 180, 216, 252],
  msPerFrame: GameOverPanel.RESTART_ANIM_DURATION / 8,
};
GameOverPanel.dimensions = {
  TEXT_X: 0,
  TEXT_Y: 13,
  TEXT_WIDTH: 191,
  TEXT_HEIGHT: 11,
  RESTART_WIDTH: 36,
  RESTART_HEIGHT: 32,
};
GameOverPanel.prototype = {
  updateDimensions(width, opt_height) {
    this.canvasDimensions.WIDTH = width;
    if (opt_height) {
      this.canvasDimensions.HEIGHT = opt_height;
    }
    this.currentFrame = GameOverPanel.animConfig.frames.length - 1;
  },
  drawGameOverText(dimensions, opt_useAltText) {
    const centerX = this.canvasDimensions.WIDTH / 2;
    let textSourceX = dimensions.TEXT_X;
    let textSourceY = dimensions.TEXT_Y;
    let textSourceWidth = dimensions.TEXT_WIDTH;
    let textSourceHeight = dimensions.TEXT_HEIGHT;
    const textTargetX = Math.round(centerX - dimensions.TEXT_WIDTH / 2);
    const textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
    const textTargetWidth = dimensions.TEXT_WIDTH;
    const textTargetHeight = dimensions.TEXT_HEIGHT;
    if (IS_HIDPI) {
      textSourceY *= 2;
      textSourceX *= 2;
      textSourceWidth *= 2;
      textSourceHeight *= 2;
    }
    if (!opt_useAltText) {
      textSourceX += this.textImgPos.x;
      textSourceY += this.textImgPos.y;
    }
    const spriteSource = opt_useAltText
      ? Runner.altCommonImageSprite
      : Runner.origImageSprite;
    this.canvasCtx.save();
    if (IS_RTL) {
      this.canvasCtx.translate(this.canvasDimensions.WIDTH, 0);
      this.canvasCtx.scale(-1, 1);
    }
    this.canvasCtx.drawImage(
      spriteSource,
      textSourceX,
      textSourceY,
      textSourceWidth,
      textSourceHeight,
      textTargetX,
      textTargetY,
      textTargetWidth,
      textTargetHeight
    );
    this.canvasCtx.restore();
  },
  drawAltGameElements(tRex) {
    if (this.altGameModeActive && Runner.spriteDefinition.ALT_GAME_END_CONFIG) {
      const altGameEndConfig = Runner.spriteDefinition.ALT_GAME_END_CONFIG;
      let altGameEndSourceWidth = altGameEndConfig.WIDTH;
      let altGameEndSourceHeight = altGameEndConfig.HEIGHT;
      const altGameEndTargetX = tRex.xPos + altGameEndConfig.X_OFFSET;
      const altGameEndTargetY = tRex.yPos + altGameEndConfig.Y_OFFSET;
      if (IS_HIDPI) {
        altGameEndSourceWidth *= 2;
        altGameEndSourceHeight *= 2;
      }
      this.canvasCtx.drawImage(
        Runner.altCommonImageSprite,
        this.altGameEndImgPos.x,
        this.altGameEndImgPos.y,
        altGameEndSourceWidth,
        altGameEndSourceHeight,
        altGameEndTargetX,
        altGameEndTargetY,
        altGameEndConfig.WIDTH,
        altGameEndConfig.HEIGHT
      );
    }
  },
  drawRestartButton() {
    const dimensions = GameOverPanel.dimensions;
    let framePosX = GameOverPanel.animConfig.frames[this.currentFrame];
    let restartSourceWidth = dimensions.RESTART_WIDTH;
    let restartSourceHeight = dimensions.RESTART_HEIGHT;
    const restartTargetX =
      this.canvasDimensions.WIDTH / 2 - dimensions.RESTART_WIDTH / 2;
    const restartTargetY = this.canvasDimensions.HEIGHT / 2;
    if (IS_HIDPI) {
      restartSourceWidth *= 2;
      restartSourceHeight *= 2;
      framePosX *= 2;
    }
    this.canvasCtx.save();
    if (IS_RTL) {
      this.canvasCtx.translate(this.canvasDimensions.WIDTH, 0);
      this.canvasCtx.scale(-1, 1);
    }
    this.canvasCtx.drawImage(
      Runner.origImageSprite,
      this.restartImgPos.x + framePosX,
      this.restartImgPos.y,
      restartSourceWidth,
      restartSourceHeight,
      restartTargetX,
      restartTargetY,
      dimensions.RESTART_WIDTH,
      dimensions.RESTART_HEIGHT
    );
    this.canvasCtx.restore();
  },
  draw(opt_altGameModeActive, opt_tRex) {
    if (opt_altGameModeActive) {
      this.altGameModeActive = opt_altGameModeActive;
    }
    this.drawGameOverText(GameOverPanel.dimensions, false);
    this.drawRestartButton();
    this.drawAltGameElements(opt_tRex);
    this.update();
  },
  update() {
    const now = getTimeStamp();
    const deltaTime = now - (this.frameTimeStamp || now);
    this.frameTimeStamp = now;
    this.animTimer += deltaTime;
    this.flashTimer += deltaTime;
    if (
      this.currentFrame == 0 &&
      this.animTimer > GameOverPanel.LOGO_PAUSE_DURATION
    ) {
      this.animTimer = 0;
      this.currentFrame++;
      this.drawRestartButton();
    } else if (
      this.currentFrame > 0 &&
      this.currentFrame < GameOverPanel.animConfig.frames.length
    ) {
      if (this.animTimer >= GameOverPanel.animConfig.msPerFrame) {
        this.currentFrame++;
        this.drawRestartButton();
      }
    } else if (
      !this.altGameModeActive &&
      this.currentFrame == GameOverPanel.animConfig.frames.length
    ) {
      this.reset();
      return;
    }
    if (
      this.altGameModeActive &&
      Runner.spriteDefinitionByType.original.ALT_GAME_OVER_TEXT_CONFIG
    ) {
      const altTextConfig =
        Runner.spriteDefinitionByType.original.ALT_GAME_OVER_TEXT_CONFIG;
      if (
        this.flashCounter < GameOverPanel.FLASH_ITERATIONS &&
        this.flashTimer > altTextConfig.FLASH_DURATION
      ) {
        this.flashTimer = 0;
        this.originalText = !this.originalText;
        this.clearGameOverTextBounds();
        if (this.originalText) {
          this.drawGameOverText(GameOverPanel.dimensions, false);
          this.flashCounter++;
        } else {
          this.drawGameOverText(altTextConfig, true);
        }
      } else if (this.flashCounter >= GameOverPanel.FLASH_ITERATIONS) {
        this.reset();
        return;
      }
    }
    this.gameOverRafId = requestAnimationFrame(this.update.bind(this));
  },
  clearGameOverTextBounds() {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(
      Math.round(
        this.canvasDimensions.WIDTH / 2 -
          GameOverPanel.dimensions.TEXT_WIDTH / 2
      ),
      Math.round((this.canvasDimensions.HEIGHT - 25) / 3),
      GameOverPanel.dimensions.TEXT_WIDTH,
      GameOverPanel.dimensions.TEXT_HEIGHT + 4
    );
    this.canvasCtx.restore();
  },
  reset() {
    if (this.gameOverRafId) {
      cancelAnimationFrame(this.gameOverRafId);
      this.gameOverRafId = null;
    }
    this.animTimer = 0;
    this.frameTimeStamp = 0;
    this.currentFrame = 0;
    this.flashTimer = 0;
    this.flashCounter = 0;
    this.originalText = true;
  },
};
function checkForCollision(obstacle, tRex, opt_canvasCtx) {
  const obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;
  const tRexBox = new CollisionBox(
    tRex.xPos + 1,
    tRex.yPos + 1,
    tRex.config.WIDTH - 2,
    tRex.config.HEIGHT - 2
  );
  const obstacleBox = new CollisionBox(
    obstacle.xPos + 1,
    obstacle.yPos + 1,
    obstacle.typeConfig.width * obstacle.size - 2,
    obstacle.typeConfig.height - 2
  );
  if (opt_canvasCtx) {
    drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
  }
  if (boxCompare(tRexBox, obstacleBox)) {
    const collisionBoxes = obstacle.collisionBoxes;
    let tRexCollisionBoxes = [];
    if (Runner.isAltGameModeEnabled()) {
      tRexCollisionBoxes = Runner.spriteDefinition.TREX.COLLISION_BOXES;
    } else {
      tRexCollisionBoxes = tRex.ducking
        ? Trex.collisionBoxes.DUCKING
        : Trex.collisionBoxes.RUNNING;
    }
    for (let t = 0; t < tRexCollisionBoxes.length; t++) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        const adjTrexBox = createAdjustedCollisionBox(
          tRexCollisionBoxes[t],
          tRexBox
        );
        const adjObstacleBox = createAdjustedCollisionBox(
          collisionBoxes[i],
          obstacleBox
        );
        const crashed = boxCompare(adjTrexBox, adjObstacleBox);
        if (opt_canvasCtx) {
          drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
        }
        if (crashed) {
          return [adjTrexBox, adjObstacleBox];
        }
      }
    }
  }
}
function createAdjustedCollisionBox(box, adjustment) {
  return new CollisionBox(
    box.x + adjustment.x,
    box.y + adjustment.y,
    box.width,
    box.height
  );
}
function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
  canvasCtx.save();
  canvasCtx.strokeStyle = "#f00";
  canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);
  canvasCtx.strokeStyle = "#0f0";
  canvasCtx.strokeRect(
    obstacleBox.x,
    obstacleBox.y,
    obstacleBox.width,
    obstacleBox.height
  );
  canvasCtx.restore();
}
function boxCompare(tRexBox, obstacleBox) {
  let crashed = false;
  const tRexBoxX = tRexBox.x;
  const tRexBoxY = tRexBox.y;
  const obstacleBoxX = obstacleBox.x;
  const obstacleBoxY = obstacleBox.y;
  if (
    tRexBox.x < obstacleBoxX + obstacleBox.width &&
    tRexBox.x + tRexBox.width > obstacleBoxX &&
    tRexBox.y < obstacleBox.y + obstacleBox.height &&
    tRexBox.height + tRexBox.y > obstacleBox.y
  ) {
    crashed = true;
  }
  return crashed;
}
function CollisionBox(x, y, w, h) {
  this.x = x;
  this.y = y;
  this.width = w;
  this.height = h;
}
function Obstacle(
  canvasCtx,
  type,
  spriteImgPos,
  dimensions,
  gapCoefficient,
  speed,
  opt_xOffset,
  opt_isAltGameMode
) {
  this.canvasCtx = canvasCtx;
  this.spritePos = spriteImgPos;
  this.typeConfig = type;
  this.gapCoefficient = Runner.slowDown ? gapCoefficient * 2 : gapCoefficient;
  this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
  this.dimensions = dimensions;
  this.remove = false;
  this.xPos = dimensions.WIDTH + (opt_xOffset || 0);
  this.yPos = 0;
  this.width = 0;
  this.collisionBoxes = [];
  this.gap = 0;
  this.speedOffset = 0;
  this.altGameModeActive = opt_isAltGameMode;
  this.imageSprite =
    this.typeConfig.type == "COLLECTABLE"
      ? Runner.altCommonImageSprite
      : this.altGameModeActive
      ? Runner.altGameImageSprite
      : Runner.imageSprite;
  this.currentFrame = 0;
  this.timer = 0;
  this.init(speed);
}
Obstacle.MAX_GAP_COEFFICIENT = 1.5;
Obstacle.MAX_OBSTACLE_LENGTH = 3;
Obstacle.prototype = {
  init(speed) {
    this.cloneCollisionBoxes();
    if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
      this.size = 1;
    }
    this.width = this.typeConfig.width * this.size;
    if (Array.isArray(this.typeConfig.yPos)) {
      const yPosConfig = IS_MOBILE
        ? this.typeConfig.yPosMobile
        : this.typeConfig.yPos;
      this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)];
    } else {
      this.yPos = this.typeConfig.yPos;
    }
    this.draw();
    if (this.size > 1) {
      this.collisionBoxes[1].width =
        this.width -
        this.collisionBoxes[0].width -
        this.collisionBoxes[2].width;
      this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
    }
    if (this.typeConfig.speedOffset) {
      this.speedOffset =
        Math.random() > 0.5
          ? this.typeConfig.speedOffset
          : -this.typeConfig.speedOffset;
    }
    this.gap = this.getGap(this.gapCoefficient, speed);
    if (Runner.audioCues) {
      this.gap *= 2;
    }
  },
  draw() {
    let sourceWidth = this.typeConfig.width;
    let sourceHeight = this.typeConfig.height;
    if (IS_HIDPI) {
      sourceWidth = sourceWidth * 2;
      sourceHeight = sourceHeight * 2;
    }
    let sourceX =
      sourceWidth * this.size * (0.5 * (this.size - 1)) + this.spritePos.x;
    if (this.currentFrame > 0) {
      sourceX += sourceWidth * this.currentFrame;
    }
    this.canvasCtx.drawImage(
      this.imageSprite,
      sourceX,
      this.spritePos.y,
      sourceWidth * this.size,
      sourceHeight,
      this.xPos,
      this.yPos,
      this.typeConfig.width * this.size,
      this.typeConfig.height
    );
  },
  update(deltaTime, speed) {
    if (!this.remove) {
      if (this.typeConfig.speedOffset) {
        speed += this.speedOffset;
      }
      this.xPos -= Math.floor(((speed * FPS) / 1000) * deltaTime);
      if (this.typeConfig.numFrames) {
        this.timer += deltaTime;
        if (this.timer >= this.typeConfig.frameRate) {
          this.currentFrame =
            this.currentFrame === this.typeConfig.numFrames - 1
              ? 0
              : this.currentFrame + 1;
          this.timer = 0;
        }
      }
      this.draw();
      if (!this.isVisible()) {
        this.remove = true;
      }
    }
  },
  getGap(gapCoefficient, speed) {
    const minGap = Math.round(
      this.width * speed + this.typeConfig.minGap * gapCoefficient
    );
    const maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
    return getRandomNum(minGap, maxGap);
  },
  isVisible() {
    return this.xPos + this.width > 0;
  },
  cloneCollisionBoxes() {
    const collisionBoxes = this.typeConfig.collisionBoxes;
    for (let i = collisionBoxes.length - 1; i >= 0; i--) {
      this.collisionBoxes[i] = new CollisionBox(
        collisionBoxes[i].x,
        collisionBoxes[i].y,
        collisionBoxes[i].width,
        collisionBoxes[i].height
      );
    }
  },
};
function Trex(canvas, spritePos) {
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext("2d");
  this.spritePos = spritePos;
  this.xPos = 0;
  this.yPos = 0;
  this.xInitialPos = 0;
  this.groundYPos = 0;
  this.currentFrame = 0;
  this.currentAnimFrames = [];
  this.blinkDelay = 0;
  this.blinkCount = 0;
  this.animStartTime = 0;
  this.timer = 0;
  this.msPerFrame = 1000 / FPS;
  this.config = Object.assign(Trex.config, Trex.normalJumpConfig);
  this.status = Trex.status.WAITING;
  this.jumping = false;
  this.ducking = false;
  this.jumpVelocity = 0;
  this.reachedMinHeight = false;
  this.speedDrop = false;
  this.jumpCount = 0;
  this.jumpspotX = 0;
  this.altGameModeEnabled = false;
  this.flashing = false;
  this.init();
}
Trex.config = {
  DROP_VELOCITY: -5,
  FLASH_OFF: 175,
  FLASH_ON: 100,
  HEIGHT: 47,
  HEIGHT_DUCK: 25,
  INTRO_DURATION: 1500,
  SPEED_DROP_COEFFICIENT: 3,
  SPRITE_WIDTH: 262,
  START_X_POS: 50,
  WIDTH: 44,
  WIDTH_DUCK: 59,
};
Trex.slowJumpConfig = {
  GRAVITY: 0.25,
  MAX_JUMP_HEIGHT: 50,
  MIN_JUMP_HEIGHT: 45,
  INITIAL_JUMP_VELOCITY: -20,
};
Trex.normalJumpConfig = {
  GRAVITY: 0.6,
  MAX_JUMP_HEIGHT: 30,
  MIN_JUMP_HEIGHT: 30,
  INITIAL_JUMP_VELOCITY: -10,
};
Trex.collisionBoxes = {
  DUCKING: [new CollisionBox(1, 18, 55, 25)],
  RUNNING: [
    new CollisionBox(22, 0, 17, 16),
    new CollisionBox(1, 18, 30, 9),
    new CollisionBox(10, 35, 14, 8),
    new CollisionBox(1, 24, 29, 5),
    new CollisionBox(5, 30, 21, 4),
    new CollisionBox(9, 34, 15, 4),
  ],
};
Trex.status = {
  CRASHED: "CRASHED",
  DUCKING: "DUCKING",
  JUMPING: "JUMPING",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
};
Trex.BLINK_TIMING = 7000;
Trex.animFrames = {
  WAITING: { frames: [44, 0], msPerFrame: 1000 / 3 },
  RUNNING: { frames: [88, 132], msPerFrame: 1000 / 12 },
  CRASHED: { frames: [220], msPerFrame: 1000 / 60 },
  JUMPING: { frames: [0], msPerFrame: 1000 / 60 },
  DUCKING: { frames: [264, 323], msPerFrame: 1000 / 8 },
};
Trex.prototype = {
  init() {
    this.groundYPos =
      Runner.defaultDimensions.HEIGHT -
      this.config.HEIGHT -
      Runner.config.BOTTOM_PAD;
    this.yPos = this.groundYPos;
    this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
    this.draw(0, 0);
    this.update(0, Trex.status.WAITING);
  },
  enableSlowConfig: function () {
    const jumpConfig = Runner.slowDown
      ? Trex.slowJumpConfig
      : Trex.normalJumpConfig;
    Trex.config = Object.assign(Trex.config, jumpConfig);
    this.adjustAltGameConfigForSlowSpeed();
  },
  enableAltGameMode: function (spritePos) {
    this.altGameModeEnabled = true;
    this.spritePos = spritePos;
    const spriteDefinition = Runner.spriteDefinition["TREX"];
    Trex.animFrames.RUNNING.frames = [
      spriteDefinition.RUNNING_1.x,
      spriteDefinition.RUNNING_2.x,
    ];
    Trex.animFrames.CRASHED.frames = [spriteDefinition.CRASHED.x];
    if (typeof spriteDefinition.JUMPING.x == "object") {
      Trex.animFrames.JUMPING.frames = spriteDefinition.JUMPING.x;
    } else {
      Trex.animFrames.JUMPING.frames = [spriteDefinition.JUMPING.x];
    }
    Trex.animFrames.DUCKING.frames = [
      spriteDefinition.RUNNING_1.x,
      spriteDefinition.RUNNING_2.x,
    ];
    Trex.config.GRAVITY = spriteDefinition.GRAVITY || Trex.config.GRAVITY;
    (Trex.config.HEIGHT = spriteDefinition.RUNNING_1.h),
      (Trex.config.INITIAL_JUMP_VELOCITY =
        spriteDefinition.INITIAL_JUMP_VELOCITY);
    Trex.config.MAX_JUMP_HEIGHT = spriteDefinition.MAX_JUMP_HEIGHT;
    Trex.config.MIN_JUMP_HEIGHT = spriteDefinition.MIN_JUMP_HEIGHT;
    Trex.config.WIDTH = spriteDefinition.RUNNING_1.w;
    Trex.config.WIDTH_JUMP = spriteDefinition.JUMPING.w;
    Trex.config.INVERT_JUMP = spriteDefinition.INVERT_JUMP;
    this.adjustAltGameConfigForSlowSpeed(spriteDefinition.GRAVITY);
    this.config = Trex.config;
    this.groundYPos =
      Runner.defaultDimensions.HEIGHT -
      this.config.HEIGHT -
      Runner.spriteDefinition["BOTTOM_PAD"];
    this.yPos = this.groundYPos;
    this.reset();
  },
  adjustAltGameConfigForSlowSpeed: function (opt_gravityValue) {
    if (Runner.slowDown) {
      if (opt_gravityValue) {
        Trex.config.GRAVITY = opt_gravityValue / 1.5;
      }
      Trex.config.MIN_JUMP_HEIGHT *= 1.5;
      Trex.config.MAX_JUMP_HEIGHT *= 1.5;
      Trex.config.INITIAL_JUMP_VELOCITY =
        Trex.config.INITIAL_JUMP_VELOCITY * 1.5;
    }
  },
  setFlashing: function (status) {
    this.flashing = status;
  },
  setJumpVelocity(setting) {
    this.config.INITIAL_JUMP_VELOCITY = -setting;
    this.config.DROP_VELOCITY = -setting / 2;
  },
  update(deltaTime, opt_status) {
    this.timer += deltaTime;
    if (opt_status) {
      this.status = opt_status;
      this.currentFrame = 0;
      this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
      this.currentAnimFrames = Trex.animFrames[opt_status].frames;
      if (opt_status === Trex.status.WAITING) {
        this.animStartTime = getTimeStamp();
        this.setBlinkDelay();
      }
    }
    if (this.playingIntro && this.xPos < this.config.START_X_POS) {
      this.xPos += Math.round(
        (this.config.START_X_POS / this.config.INTRO_DURATION) * deltaTime
      );
      this.xInitialPos = this.xPos;
    }
    if (this.status === Trex.status.WAITING) {
      this.blink(getTimeStamp());
    } else {
      this.draw(this.currentAnimFrames[this.currentFrame], 0);
    }
    if (!this.flashing && this.timer >= this.msPerFrame) {
      this.currentFrame =
        this.currentFrame == this.currentAnimFrames.length - 1
          ? 0
          : this.currentFrame + 1;
      this.timer = 0;
    }
    if (!this.altGameModeEnabled) {
      if (this.speedDrop && this.yPos === this.groundYPos) {
        this.speedDrop = false;
        this.setDuck(true);
      }
    }
  },
  draw(x, y) {
    let sourceX = x;
    let sourceY = y;
    let sourceWidth =
      this.ducking && this.status !== Trex.status.CRASHED
        ? this.config.WIDTH_DUCK
        : this.config.WIDTH;
    let sourceHeight = this.config.HEIGHT;
    const outputHeight = sourceHeight;
    let jumpOffset = Runner.spriteDefinition.TREX.JUMPING.xOffset;
    if (
      this.altGameModeEnabled &&
      this.jumping &&
      this.status !== Trex.status.CRASHED
    ) {
      sourceWidth = this.config.WIDTH_JUMP;
    }
    if (IS_HIDPI) {
      sourceX *= 2;
      sourceY *= 2;
      sourceWidth *= 2;
      sourceHeight *= 2;
      jumpOffset *= 2;
    }
    sourceX += this.spritePos.x;
    sourceY += this.spritePos.y;
    if (this.flashing) {
      if (this.timer < this.config.FLASH_ON) {
        this.canvasCtx.globalAlpha = 0.5;
      } else if (this.timer > this.config.FLASH_OFF) {
        this.timer = 0;
      }
    }
    if (
      !this.altGameModeEnabled &&
      this.ducking &&
      this.status !== Trex.status.CRASHED
    ) {
      this.canvasCtx.drawImage(
        Runner.imageSprite,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        this.xPos,
        this.yPos,
        this.config.WIDTH_DUCK,
        outputHeight
      );
    } else if (
      this.altGameModeEnabled &&
      this.jumping &&
      this.status !== Trex.status.CRASHED
    ) {
      this.canvasCtx.drawImage(
        Runner.imageSprite,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        this.xPos - jumpOffset,
        this.yPos,
        this.config.WIDTH_JUMP,
        outputHeight
      );
    } else {
      if (this.ducking && this.status === Trex.status.CRASHED) {
        this.xPos++;
      }
      this.canvasCtx.drawImage(
        Runner.imageSprite,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        this.xPos,
        this.yPos,
        this.config.WIDTH,
        outputHeight
      );
    }
    this.canvasCtx.globalAlpha = 1;
  },
  setBlinkDelay() {
    this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
  },
  blink(time) {
    const deltaTime = time - this.animStartTime;
    if (deltaTime >= this.blinkDelay) {
      this.draw(this.currentAnimFrames[this.currentFrame], 0);
      if (this.currentFrame === 1) {
        this.setBlinkDelay();
        this.animStartTime = time;
        this.blinkCount++;
      }
    }
  },
  startJump(speed) {
    if (!this.jumping) {
      this.update(0, Trex.status.JUMPING);
      this.jumpVelocity = this.config.INITIAL_JUMP_VELOCITY - speed / 10;
      this.jumping = true;
      this.reachedMinHeight = false;
      this.speedDrop = false;
      if (this.config.INVERT_JUMP) {
        this.minJumpHeight = this.groundYPos + this.config.MIN_JUMP_HEIGHT;
      }
    }
  },
  endJump() {
    if (
      this.reachedMinHeight &&
      this.jumpVelocity < this.config.DROP_VELOCITY
    ) {
      this.jumpVelocity = this.config.DROP_VELOCITY;
    }
  },
  updateJump(deltaTime) {
    const msPerFrame = Trex.animFrames[this.status].msPerFrame;
    const framesElapsed = deltaTime / msPerFrame;
    if (this.speedDrop) {
      this.yPos += Math.round(
        this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * framesElapsed
      );
    } else if (this.config.INVERT_JUMP) {
      this.yPos -= Math.round(this.jumpVelocity * framesElapsed);
    } else {
      this.yPos += Math.round(this.jumpVelocity * framesElapsed);
    }
    this.jumpVelocity += this.config.GRAVITY * framesElapsed;
    if (
      (this.config.INVERT_JUMP && this.yPos > this.minJumpHeight) ||
      (!this.config.INVERT_JUMP && this.yPos < this.minJumpHeight) ||
      this.speedDrop
    ) {
      this.reachedMinHeight = true;
    }
    if (
      (this.config.INVERT_JUMP && this.yPos > -this.config.MAX_JUMP_HEIGHT) ||
      (!this.config.INVERT_JUMP && this.yPos < this.config.MAX_JUMP_HEIGHT) ||
      this.speedDrop
    ) {
      this.endJump();
    }
    if (
      (this.config.INVERT_JUMP && this.yPos) < this.groundYPos ||
      (!this.config.INVERT_JUMP && this.yPos) > this.groundYPos
    ) {
      this.reset();
      this.jumpCount++;
      if (Runner.audioCues) {
        Runner.generatedSoundFx.loopFootSteps();
      }
    }
  },
  setSpeedDrop() {
    this.speedDrop = true;
    this.jumpVelocity = 1;
  },
  setDuck(isDucking) {
    if (isDucking && this.status !== Trex.status.DUCKING) {
      this.update(0, Trex.status.DUCKING);
      this.ducking = true;
    } else if (this.status === Trex.status.DUCKING) {
      this.update(0, Trex.status.RUNNING);
      this.ducking = false;
    }
  },
  reset() {
    this.xPos = this.xInitialPos;
    this.yPos = this.groundYPos;
    this.jumpVelocity = 0;
    this.jumping = false;
    this.ducking = false;
    this.update(0, Trex.status.RUNNING);
    this.midair = false;
    this.speedDrop = false;
    this.jumpCount = 0;
  },
};
function DistanceMeter(canvas, spritePos, canvasWidth) {
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext("2d");
  this.image = Runner.imageSprite;
  this.spritePos = spritePos;
  this.x = 0;
  this.y = 5;
  this.currentDistance = 0;
  this.maxScore = 0;
  this.highScore = "0";
  this.container = null;
  this.digits = [];
  this.achievement = false;
  this.defaultString = "";
  this.flashTimer = 0;
  this.flashIterations = 0;
  this.invertTrigger = false;
  this.flashingRafId = null;
  this.highScoreBounds = {};
  this.highScoreFlashing = false;
  this.config = DistanceMeter.config;
  this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
  this.canvasWidth = canvasWidth;
  this.init(canvasWidth);
}
DistanceMeter.dimensions = { WIDTH: 10, HEIGHT: 13, DEST_WIDTH: 11 };
DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];
DistanceMeter.config = {
  MAX_DISTANCE_UNITS: 5,
  ACHIEVEMENT_DISTANCE: 100,
  COEFFICIENT: 0.025,
  FLASH_DURATION: 1000 / 4,
  FLASH_ITERATIONS: 3,
  HIGH_SCORE_HIT_AREA_PADDING: 4,
};
DistanceMeter.prototype = {
  init(width) {
    let maxDistanceStr = "";
    this.calcXPos(width);
    this.maxScore = this.maxScoreUnits;
    for (let i = 0; i < this.maxScoreUnits; i++) {
      this.draw(i, 0);
      this.defaultString += "0";
      maxDistanceStr += "9";
    }
    this.maxScore = parseInt(maxDistanceStr, 10);
  },
  calcXPos(canvasWidth) {
    this.x =
      canvasWidth -
      DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1);
  },
  draw(digitPos, value, opt_highScore) {
    let sourceWidth = DistanceMeter.dimensions.WIDTH;
    let sourceHeight = DistanceMeter.dimensions.HEIGHT;
    let sourceX = DistanceMeter.dimensions.WIDTH * value;
    let sourceY = 0;
    const targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
    const targetY = this.y;
    const targetWidth = DistanceMeter.dimensions.WIDTH;
    const targetHeight = DistanceMeter.dimensions.HEIGHT;
    if (IS_HIDPI) {
      sourceWidth *= 2;
      sourceHeight *= 2;
      sourceX *= 2;
    }
    sourceX += this.spritePos.x;
    sourceY += this.spritePos.y;
    this.canvasCtx.save();
    if (IS_RTL) {
      if (opt_highScore) {
        this.canvasCtx.translate(
          this.canvasWidth -
            DistanceMeter.dimensions.WIDTH * (this.maxScoreUnits + 3),
          this.y
        );
      } else {
        this.canvasCtx.translate(
          this.canvasWidth - DistanceMeter.dimensions.WIDTH,
          this.y
        );
      }
      this.canvasCtx.scale(-1, 1);
    } else {
      const highScoreX =
        this.x - this.maxScoreUnits * 2 * DistanceMeter.dimensions.WIDTH;
      if (opt_highScore) {
        this.canvasCtx.translate(highScoreX, this.y);
      } else {
        this.canvasCtx.translate(this.x, this.y);
      }
    }
    this.canvasCtx.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetX,
      targetY,
      targetWidth,
      targetHeight
    );
    this.canvasCtx.restore();
  },
  getActualDistance(distance) {
    return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
  },
  update(deltaTime, distance) {
    let paint = true;
    let playSound = false;
    if (!this.achievement) {
      distance = this.getActualDistance(distance);
      if (
        distance > this.maxScore &&
        this.maxScoreUnits == this.config.MAX_DISTANCE_UNITS
      ) {
        this.maxScoreUnits++;
        this.maxScore = parseInt(this.maxScore + "9", 10);
      } else {
        this.distance = 0;
      }
      if (distance > 0) {
        if (distance % this.config.ACHIEVEMENT_DISTANCE === 0) {
          this.achievement = true;
          this.flashTimer = 0;
          playSound = true;
        }
        const distanceStr = (this.defaultString + distance).substr(
          -this.maxScoreUnits
        );
        this.digits = distanceStr.split("");
      } else {
        this.digits = this.defaultString.split("");
      }
    } else {
      if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
        this.flashTimer += deltaTime;
        if (this.flashTimer < this.config.FLASH_DURATION) {
          paint = false;
        } else if (this.flashTimer > this.config.FLASH_DURATION * 2) {
          this.flashTimer = 0;
          this.flashIterations++;
        }
      } else {
        this.achievement = false;
        this.flashIterations = 0;
        this.flashTimer = 0;
      }
    }
    if (paint) {
      for (let i = this.digits.length - 1; i >= 0; i--) {
        this.draw(i, parseInt(this.digits[i], 10));
      }
    }
    this.drawHighScore();
    return playSound;
  },
  drawHighScore() {
    if (parseInt(this.highScore, 10) > 0) {
      this.canvasCtx.save();
      this.canvasCtx.globalAlpha = 0.8;
      for (let i = this.highScore.length - 1; i >= 0; i--) {
        this.draw(i, parseInt(this.highScore[i], 10), true);
      }
      this.canvasCtx.restore();
    }
  },
  setHighScore(distance) {
    distance = this.getActualDistance(distance);
    const highScoreStr = (this.defaultString + distance).substr(
      -this.maxScoreUnits
    );
    this.highScore = ["10", "11", ""].concat(highScoreStr.split(""));
  },
  hasClickedOnHighScore(e) {
    let x = 0;
    let y = 0;
    if (e.touches) {
      const canvasBounds = this.canvas.getBoundingClientRect();
      x = e.touches[0].clientX - canvasBounds.left;
      y = e.touches[0].clientY - canvasBounds.top;
    } else {
      x = e.offsetX;
      y = e.offsetY;
    }
    this.highScoreBounds = this.getHighScoreBounds();
    return (
      x >= this.highScoreBounds.x &&
      x <= this.highScoreBounds.x + this.highScoreBounds.width &&
      y >= this.highScoreBounds.y &&
      y <= this.highScoreBounds.y + this.highScoreBounds.height
    );
  },
  getHighScoreBounds() {
    return {
      x:
        this.x -
        this.maxScoreUnits * 2 * DistanceMeter.dimensions.WIDTH -
        DistanceMeter.config.HIGH_SCORE_HIT_AREA_PADDING,
      y: this.y,
      width:
        DistanceMeter.dimensions.WIDTH * (this.highScore.length + 1) +
        DistanceMeter.config.HIGH_SCORE_HIT_AREA_PADDING,
      height:
        DistanceMeter.dimensions.HEIGHT +
        DistanceMeter.config.HIGH_SCORE_HIT_AREA_PADDING * 2,
    };
  },
  flashHighScore() {
    const now = getTimeStamp();
    const deltaTime = now - (this.frameTimeStamp || now);
    let paint = true;
    this.frameTimeStamp = now;
    if (this.flashIterations > this.config.FLASH_ITERATIONS * 2) {
      this.cancelHighScoreFlashing();
      return;
    }
    this.flashTimer += deltaTime;
    if (this.flashTimer < this.config.FLASH_DURATION) {
      paint = false;
    } else if (this.flashTimer > this.config.FLASH_DURATION * 2) {
      this.flashTimer = 0;
      this.flashIterations++;
    }
    if (paint) {
      this.drawHighScore();
    } else {
      this.clearHighScoreBounds();
    }
    this.flashingRafId = requestAnimationFrame(this.flashHighScore.bind(this));
  },
  clearHighScoreBounds() {
    this.canvasCtx.save();
    this.canvasCtx.fillStyle = "#fff";
    this.canvasCtx.rect(
      this.highScoreBounds.x,
      this.highScoreBounds.y,
      this.highScoreBounds.width,
      this.highScoreBounds.height
    );
    this.canvasCtx.fill();
    this.canvasCtx.restore();
  },
  startHighScoreFlashing() {
    this.highScoreFlashing = true;
    this.flashHighScore();
  },
  isHighScoreFlashing() {
    return this.highScoreFlashing;
  },
  cancelHighScoreFlashing() {
    if (this.flashingRafId) {
      cancelAnimationFrame(this.flashingRafId);
    }
    this.flashIterations = 0;
    this.flashTimer = 0;
    this.highScoreFlashing = false;
    this.clearHighScoreBounds();
    this.drawHighScore();
  },
  resetHighScore() {
    this.setHighScore(0);
    this.cancelHighScoreFlashing();
  },
  reset() {
    this.update(0, 0);
    this.achievement = false;
  },
};
function Cloud(canvas, spritePos, containerWidth) {
  this.canvas = canvas;
  this.canvasCtx = this.canvas.getContext("2d");
  this.spritePos = spritePos;
  this.containerWidth = containerWidth;
  this.xPos = containerWidth;
  this.yPos = 0;
  this.remove = false;
  this.gap = getRandomNum(
    Cloud.config.MIN_CLOUD_GAP,
    Cloud.config.MAX_CLOUD_GAP
  );
  this.init();
}
Cloud.config = {
  HEIGHT: 14,
  MAX_CLOUD_GAP: 400,
  MAX_SKY_LEVEL: 30,
  MIN_CLOUD_GAP: 100,
  MIN_SKY_LEVEL: 71,
  WIDTH: 46,
};
Cloud.prototype = {
  init() {
    this.yPos = getRandomNum(
      Cloud.config.MAX_SKY_LEVEL,
      Cloud.config.MIN_SKY_LEVEL
    );
    this.draw();
  },
  draw() {
    this.canvasCtx.save();
    let sourceWidth = Cloud.config.WIDTH;
    let sourceHeight = Cloud.config.HEIGHT;
    const outputWidth = sourceWidth;
    const outputHeight = sourceHeight;
    if (IS_HIDPI) {
      sourceWidth = sourceWidth * 2;
      sourceHeight = sourceHeight * 2;
    }
    this.canvasCtx.drawImage(
      Runner.imageSprite,
      this.spritePos.x,
      this.spritePos.y,
      sourceWidth,
      sourceHeight,
      this.xPos,
      this.yPos,
      outputWidth,
      outputHeight
    );
    this.canvasCtx.restore();
  },
  update(speed) {
    if (!this.remove) {
      this.xPos -= Math.ceil(speed);
      this.draw();
      if (!this.isVisible()) {
        this.remove = true;
      }
    }
  },
  isVisible() {
    return this.xPos + Cloud.config.WIDTH > 0;
  },
};
function BackgroundEl(canvas, spritePos, containerWidth, type) {
  this.canvas = canvas;
  this.canvasCtx = this.canvas.getContext("2d");
  this.spritePos = spritePos;
  this.containerWidth = containerWidth;
  this.xPos = containerWidth;
  this.yPos = 0;
  this.remove = false;
  this.type = type;
  this.gap = getRandomNum(
    BackgroundEl.config.MIN_GAP,
    BackgroundEl.config.MAX_GAP
  );
  this.animTimer = 0;
  this.switchFrames = false;
  this.spriteConfig = {};
  this.init();
}
BackgroundEl.config = {
  MAX_BG_ELS: 0,
  MAX_GAP: 0,
  MIN_GAP: 0,
  POS: 0,
  SPEED: 0,
  Y_POS: 0,
  MS_PER_FRAME: 0,
};
BackgroundEl.prototype = {
  init() {
    this.spriteConfig = Runner.spriteDefinition.BACKGROUND_EL[this.type];
    if (this.spriteConfig.FIXED) {
      this.xPos = this.spriteConfig.FIXED_X_POS;
    }
    this.yPos =
      BackgroundEl.config.Y_POS -
      this.spriteConfig.HEIGHT +
      this.spriteConfig.OFFSET;
    this.draw();
  },
  draw() {
    this.canvasCtx.save();
    let sourceWidth = this.spriteConfig.WIDTH;
    let sourceHeight = this.spriteConfig.HEIGHT;
    let sourceX = this.spriteConfig.X_POS;
    const outputWidth = sourceWidth;
    const outputHeight = sourceHeight;
    if (IS_HIDPI) {
      sourceWidth *= 2;
      sourceHeight *= 2;
      sourceX *= 2;
    }
    this.canvasCtx.drawImage(
      Runner.imageSprite,
      sourceX,
      this.spritePos.y,
      sourceWidth,
      sourceHeight,
      this.xPos,
      this.yPos,
      outputWidth,
      outputHeight
    );
    this.canvasCtx.restore();
  },
  update(speed) {
    if (!this.remove) {
      if (this.spriteConfig.FIXED) {
        this.animTimer += speed;
        if (this.animTimer > BackgroundEl.config.MS_PER_FRAME) {
          this.animTimer = 0;
          this.switchFrames = !this.switchFrames;
        }
        if (
          this.spriteConfig.FIXED_Y_POS_1 &&
          this.spriteConfig.FIXED_Y_POS_2
        ) {
          this.yPos = this.switchFrames
            ? this.spriteConfig.FIXED_Y_POS_1
            : this.spriteConfig.FIXED_Y_POS_2;
        }
      } else {
        this.xPos -= BackgroundEl.config.SPEED;
      }
      this.draw();
      if (!this.isVisible()) {
        this.remove = true;
      }
    }
  },
  isVisible() {
    return this.xPos + this.spriteConfig.WIDTH > 0;
  },
};
function NightMode(canvas, spritePos, containerWidth) {
  this.spritePos = spritePos;
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext("2d");
  this.xPos = containerWidth - 50;
  this.yPos = 30;
  this.currentPhase = 0;
  this.opacity = 0;
  this.containerWidth = containerWidth;
  this.stars = [];
  this.drawStars = false;
  this.placeStars();
}
NightMode.config = {
  FADE_SPEED: 0.035,
  HEIGHT: 40,
  MOON_SPEED: 0.25,
  NUM_STARS: 2,
  STAR_SIZE: 9,
  STAR_SPEED: 0.3,
  STAR_MAX_Y: 70,
  WIDTH: 20,
};
NightMode.phases = [140, 120, 100, 60, 40, 20, 0];
NightMode.prototype = {
  update(activated) {
    if (activated && this.opacity === 0) {
      this.currentPhase++;
      if (this.currentPhase >= NightMode.phases.length) {
        this.currentPhase = 0;
      }
    }
    if (activated && (this.opacity < 1 || this.opacity === 0)) {
      this.opacity += NightMode.config.FADE_SPEED;
    } else if (this.opacity > 0) {
      this.opacity -= NightMode.config.FADE_SPEED;
    }
    if (this.opacity > 0) {
      this.xPos = this.updateXPos(this.xPos, NightMode.config.MOON_SPEED);
      if (this.drawStars) {
        for (let i = 0; i < NightMode.config.NUM_STARS; i++) {
          this.stars[i].x = this.updateXPos(
            this.stars[i].x,
            NightMode.config.STAR_SPEED
          );
        }
      }
      this.draw();
    } else {
      this.opacity = 0;
      this.placeStars();
    }
    this.drawStars = true;
  },
  updateXPos(currentPos, speed) {
    if (currentPos < -NightMode.config.WIDTH) {
      currentPos = this.containerWidth;
    } else {
      currentPos -= speed;
    }
    return currentPos;
  },
  draw() {
    let moonSourceWidth =
      this.currentPhase === 3
        ? NightMode.config.WIDTH * 2
        : NightMode.config.WIDTH;
    let moonSourceHeight = NightMode.config.HEIGHT;
    let moonSourceX = this.spritePos.x + NightMode.phases[this.currentPhase];
    const moonOutputWidth = moonSourceWidth;
    let starSize = NightMode.config.STAR_SIZE;
    let starSourceX = Runner.spriteDefinitionByType.original.LDPI.STAR.x;
    if (IS_HIDPI) {
      moonSourceWidth *= 2;
      moonSourceHeight *= 2;
      moonSourceX = this.spritePos.x + NightMode.phases[this.currentPhase] * 2;
      starSize *= 2;
      starSourceX = Runner.spriteDefinitionByType.original.HDPI.STAR.x;
    }
    this.canvasCtx.save();
    this.canvasCtx.globalAlpha = this.opacity;
    if (this.drawStars) {
      for (let i = 0; i < NightMode.config.NUM_STARS; i++) {
        this.canvasCtx.drawImage(
          Runner.origImageSprite,
          starSourceX,
          this.stars[i].sourceY,
          starSize,
          starSize,
          Math.round(this.stars[i].x),
          this.stars[i].y,
          NightMode.config.STAR_SIZE,
          NightMode.config.STAR_SIZE
        );
      }
    }
    this.canvasCtx.drawImage(
      Runner.origImageSprite,
      moonSourceX,
      this.spritePos.y,
      moonSourceWidth,
      moonSourceHeight,
      Math.round(this.xPos),
      this.yPos,
      moonOutputWidth,
      NightMode.config.HEIGHT
    );
    this.canvasCtx.globalAlpha = 1;
    this.canvasCtx.restore();
  },
  placeStars() {
    const segmentSize = Math.round(
      this.containerWidth / NightMode.config.NUM_STARS
    );
    for (let i = 0; i < NightMode.config.NUM_STARS; i++) {
      this.stars[i] = {};
      this.stars[i].x = getRandomNum(segmentSize * i, segmentSize * (i + 1));
      this.stars[i].y = getRandomNum(0, NightMode.config.STAR_MAX_Y);
      if (IS_HIDPI) {
        this.stars[i].sourceY =
          Runner.spriteDefinitionByType.original.HDPI.STAR.y +
          NightMode.config.STAR_SIZE * 2 * i;
      } else {
        this.stars[i].sourceY =
          Runner.spriteDefinitionByType.original.LDPI.STAR.y +
          NightMode.config.STAR_SIZE * i;
      }
    }
  },
  reset() {
    this.currentPhase = 0;
    this.opacity = 0;
    this.update(false);
  },
};
function HorizonLine(canvas, lineConfig) {
  let sourceX = lineConfig.SOURCE_X;
  let sourceY = lineConfig.SOURCE_Y;
  if (IS_HIDPI) {
    sourceX *= 2;
    sourceY *= 2;
  }
  this.spritePos = { x: sourceX, y: sourceY };
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext("2d");
  this.sourceDimensions = {};
  this.dimensions = lineConfig;
  this.sourceXPos = [
    this.spritePos.x,
    this.spritePos.x + this.dimensions.WIDTH,
  ];
  this.xPos = [];
  this.yPos = 0;
  this.bumpThreshold = 0.5;
  this.setSourceDimensions(lineConfig);
  this.draw();
}
HorizonLine.dimensions = { WIDTH: 600, HEIGHT: 12, YPOS: 127 };
HorizonLine.prototype = {
  setSourceDimensions(newDimensions) {
    for (const dimension in newDimensions) {
      if (dimension !== "SOURCE_X" && dimension !== "SOURCE_Y") {
        if (IS_HIDPI) {
          if (dimension !== "YPOS") {
            this.sourceDimensions[dimension] = newDimensions[dimension] * 2;
          }
        } else {
          this.sourceDimensions[dimension] = newDimensions[dimension];
        }
        this.dimensions[dimension] = newDimensions[dimension];
      }
    }
    this.xPos = [0, newDimensions.WIDTH];
    this.yPos = newDimensions.YPOS;
  },
  getRandomType() {
    return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
  },
  draw() {
    this.canvasCtx.drawImage(
      Runner.imageSprite,
      this.sourceXPos[0],
      this.spritePos.y,
      this.sourceDimensions.WIDTH,
      this.sourceDimensions.HEIGHT,
      this.xPos[0],
      this.yPos,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT
    );
    this.canvasCtx.drawImage(
      Runner.imageSprite,
      this.sourceXPos[1],
      this.spritePos.y,
      this.sourceDimensions.WIDTH,
      this.sourceDimensions.HEIGHT,
      this.xPos[1],
      this.yPos,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT
    );
  },
  updateXPos(pos, increment) {
    const line1 = pos;
    const line2 = pos === 0 ? 1 : 0;
    this.xPos[line1] -= increment;
    this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;
    if (this.xPos[line1] <= -this.dimensions.WIDTH) {
      this.xPos[line1] += this.dimensions.WIDTH * 2;
      this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
      this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
    }
  },
  update(deltaTime, speed) {
    const increment = Math.floor(speed * (FPS / 1000) * deltaTime);
    if (this.xPos[0] <= 0) {
      this.updateXPos(0, increment);
    } else {
      this.updateXPos(1, increment);
    }
    this.draw();
  },
  reset() {
    this.xPos[0] = 0;
    this.xPos[1] = this.dimensions.WIDTH;
  },
};
function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
  this.canvas = canvas;
  this.canvasCtx = this.canvas.getContext("2d");
  this.config = Horizon.config;
  this.dimensions = dimensions;
  this.gapCoefficient = gapCoefficient;
  this.obstacles = [];
  this.obstacleHistory = [];
  this.horizonOffsets = [0, 0];
  this.cloudFrequency = this.config.CLOUD_FREQUENCY;
  this.spritePos = spritePos;
  this.nightMode = null;
  this.altGameModeActive = false;
  this.clouds = [];
  this.cloudSpeed = this.config.BG_CLOUD_SPEED;
  this.backgroundEls = [];
  this.lastEl = null;
  this.backgroundSpeed = this.config.BG_CLOUD_SPEED;
  this.horizonLine = null;
  this.horizonLines = [];
  this.init();
}
Horizon.config = {
  BG_CLOUD_SPEED: 0.2,
  BUMPY_THRESHOLD: 0.3,
  CLOUD_FREQUENCY: 0.5,
  HORIZON_HEIGHT: 16,
  MAX_CLOUDS: 6,
};
Horizon.prototype = {
  init() {
    Obstacle.types = Runner.spriteDefinitionByType.original.OBSTACLES;
    this.addCloud();
    for (let i = 0; i < Runner.spriteDefinition.LINES.length; i++) {
      this.horizonLines.push(
        new HorizonLine(this.canvas, Runner.spriteDefinition.LINES[i])
      );
    }
    this.nightMode = new NightMode(
      this.canvas,
      this.spritePos.MOON,
      this.dimensions.WIDTH
    );
  },
  adjustObstacleSpeed: function () {
    for (let i = 0; i < Obstacle.types.length; i++) {
      if (Runner.slowDown) {
        Obstacle.types[i].multipleSpeed = Obstacle.types[i].multipleSpeed / 2;
        Obstacle.types[i].minGap *= 1.5;
        Obstacle.types[i].minSpeed = Obstacle.types[i].minSpeed / 2;
        if (typeof Obstacle.types[i].yPos == "object") {
          Obstacle.types[i].yPos = Obstacle.types[i].yPos[0];
          Obstacle.types[i].yPosMobile = Obstacle.types[i].yPos[0];
        }
      }
    }
  },
  enableAltGameMode: function (spritePos) {
    this.clouds = [];
    this.backgroundEls = [];
    this.altGameModeActive = true;
    this.spritePos = spritePos;
    Obstacle.types = Runner.spriteDefinition.OBSTACLES;
    this.adjustObstacleSpeed();
    Obstacle.MAX_GAP_COEFFICIENT = Runner.spriteDefinition.MAX_GAP_COEFFICIENT;
    Obstacle.MAX_OBSTACLE_LENGTH = Runner.spriteDefinition.MAX_OBSTACLE_LENGTH;
    BackgroundEl.config = Runner.spriteDefinition.BACKGROUND_EL_CONFIG;
    this.horizonLines = [];
    for (let i = 0; i < Runner.spriteDefinition.LINES.length; i++) {
      this.horizonLines.push(
        new HorizonLine(this.canvas, Runner.spriteDefinition.LINES[i])
      );
    }
    this.reset();
  },
  update(deltaTime, currentSpeed, updateObstacles, showNightMode) {
    this.runningTime += deltaTime;
    if (this.altGameModeActive) {
      this.updateBackgroundEls(deltaTime, currentSpeed);
    }
    for (let i = 0; i < this.horizonLines.length; i++) {
      this.horizonLines[i].update(deltaTime, currentSpeed);
    }
    if (!this.altGameModeActive || Runner.spriteDefinition.HAS_CLOUDS) {
      this.nightMode.update(showNightMode);
      this.updateClouds(deltaTime, currentSpeed);
    }
    if (updateObstacles) {
      this.updateObstacles(deltaTime, currentSpeed);
    }
  },
  updateBackgroundEl(elSpeed, bgElArray, maxBgEl, bgElAddFunction, frequency) {
    const numElements = bgElArray.length;
    if (numElements) {
      for (let i = numElements - 1; i >= 0; i--) {
        bgElArray[i].update(elSpeed);
      }
      const lastEl = bgElArray[numElements - 1];
      if (
        numElements < maxBgEl &&
        this.dimensions.WIDTH - lastEl.xPos > lastEl.gap &&
        frequency > Math.random()
      ) {
        bgElAddFunction();
      }
    } else {
      bgElAddFunction();
    }
  },
  updateClouds(deltaTime, speed) {
    const elSpeed = (this.cloudSpeed / 1000) * deltaTime * speed;
    this.updateBackgroundEl(
      elSpeed,
      this.clouds,
      this.config.MAX_CLOUDS,
      this.addCloud.bind(this),
      this.cloudFrequency
    );
    this.clouds = this.clouds.filter((obj) => !obj.remove);
  },
  updateBackgroundEls(deltaTime, speed) {
    this.updateBackgroundEl(
      deltaTime,
      this.backgroundEls,
      BackgroundEl.config.MAX_BG_ELS,
      this.addBackgroundEl.bind(this),
      this.cloudFrequency
    );
    this.backgroundEls = this.backgroundEls.filter((obj) => !obj.remove);
  },
  updateObstacles(deltaTime, currentSpeed) {
    const updatedObstacles = this.obstacles.slice(0);
    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];
      obstacle.update(deltaTime, currentSpeed);
      if (obstacle.remove) {
        updatedObstacles.shift();
      }
    }
    this.obstacles = updatedObstacles;
    if (this.obstacles.length > 0) {
      const lastObstacle = this.obstacles[this.obstacles.length - 1];
      if (
        lastObstacle &&
        !lastObstacle.followingObstacleCreated &&
        lastObstacle.isVisible() &&
        lastObstacle.xPos + lastObstacle.width + lastObstacle.gap <
          this.dimensions.WIDTH
      ) {
        this.addNewObstacle(currentSpeed);
        lastObstacle.followingObstacleCreated = true;
      }
    } else {
      this.addNewObstacle(currentSpeed);
    }
  },
  removeFirstObstacle() {
    this.obstacles.shift();
  },
  addNewObstacle(currentSpeed) {
    const obstacleCount =
      Obstacle.types[Obstacle.types.length - 1].type != "COLLECTABLE" ||
      (Runner.isAltGameModeEnabled() && !this.altGameModeActive) ||
      this.altGameModeActive
        ? Obstacle.types.length - 1
        : Obstacle.types.length - 2;
    const obstacleTypeIndex =
      obstacleCount > 0 ? getRandomNum(0, obstacleCount) : 0;
    const obstacleType = Obstacle.types[obstacleTypeIndex];
    if (
      (obstacleCount > 0 && this.duplicateObstacleCheck(obstacleType.type)) ||
      currentSpeed < obstacleType.minSpeed
    ) {
      this.addNewObstacle(currentSpeed);
    } else {
      const obstacleSpritePos = this.spritePos[obstacleType.type];
      this.obstacles.push(
        new Obstacle(
          this.canvasCtx,
          obstacleType,
          obstacleSpritePos,
          this.dimensions,
          this.gapCoefficient,
          currentSpeed,
          obstacleType.width,
          this.altGameModeActive
        )
      );
      this.obstacleHistory.unshift(obstacleType.type);
      if (this.obstacleHistory.length > 1) {
        this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION);
      }
    }
  },
  duplicateObstacleCheck(nextObstacleType) {
    let duplicateCount = 0;
    for (let i = 0; i < this.obstacleHistory.length; i++) {
      duplicateCount =
        this.obstacleHistory[i] === nextObstacleType ? duplicateCount + 1 : 0;
    }
    return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION;
  },
  reset() {
    this.obstacles = [];
    for (let l = 0; l < this.horizonLines.length; l++) {
      this.horizonLines[l].reset();
    }
    this.nightMode.reset();
  },
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  },
  addCloud() {
    this.clouds.push(
      new Cloud(this.canvas, this.spritePos.CLOUD, this.dimensions.WIDTH)
    );
  },
  addBackgroundEl() {
    const backgroundElTypes = Object.keys(
      Runner.spriteDefinition.BACKGROUND_EL
    );
    if (backgroundElTypes.length > 0) {
      let index = getRandomNum(0, backgroundElTypes.length - 1);
      let type = backgroundElTypes[index];
      while (type == this.lastEl && backgroundElTypes.length > 1) {
        index = getRandomNum(0, backgroundElTypes.length - 1);
        type = backgroundElTypes[index];
      }
      this.lastEl = type;
      this.backgroundEls.push(
        new BackgroundEl(
          this.canvas,
          this.spritePos.BACKGROUND_EL,
          this.dimensions.WIDTH,
          type
        )
      );
    }
  },
};
