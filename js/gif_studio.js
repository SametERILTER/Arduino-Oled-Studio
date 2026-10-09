/**
 * OLED Studio - GIF Animation Studio & Converter
 * Pure client-side GIF parser, monochrome quantizer (Floyd-Steinberg / Threshold),
 * live OLED player preview, flash memory estimator, and C++ code generator for Arduino/ESP32.
 */

(function () {
  'use strict';

  // --- GIF Studio State ---
  const gifStudio = {
    isOpen: false,
    filename: 'animation.gif',
    rawFrames: [], // { canvas, width, height, delayMs }
    originalW: 0,
    originalH: 0,

    // Settings
    targetW: 64,
    targetH: 64,
    keepAspect: true,
    frameSkip: 1, // 1 (all), 2, 3, 4
    maxFrames: 12, // number or 'unlimited'
    ditherMode: 'dither', // 'dither' or 'threshold'
    threshold: 128,
    inverted: false,
    speedMult: 1.0,

    // Processed frames for OLED
    processedFrames: [], // { w, h, data: Array(w*h), delayMs }

    // Playback state
    isPlaying: true,
    currentFrameIndex: 0,
    animTimer: null,
    lastFrameTimestamp: 0,

    // Code generator options
    codeLibrary: 'adafruit', // 'adafruit' or 'u8g2'
    codeScope: 'full', // 'full' or 'modular'

    // Target Hardware Board for Memory Estimation (Arduino Uno default)
    targetBoard: 'uno'
  };

  const BOARD_FLASH_SPECS = {
    uno: { name: 'Arduino Uno / Nano (32 KB)', flashBytes: 32256, usableBytes: 28672 },
    mega: { name: 'Arduino Mega 2560 (256 KB)', flashBytes: 262144, usableBytes: 253952 },
    pico: { name: 'Raspberry Pi Pico (2 MB)', flashBytes: 2097152, usableBytes: 2000000 },
    esp8266: { name: 'ESP8266 / NodeMCU (4 MB)', flashBytes: 4194304, usableBytes: 1048576 },
    esp32: { name: 'ESP32 (4 MB)', flashBytes: 4194304, usableBytes: 1310720 },
    leonardo: { name: 'Arduino Leonardo (32 KB)', flashBytes: 32256, usableBytes: 28672 },
    attiny85: { name: 'ATtiny85 (8 KB)', flashBytes: 8192, usableBytes: 6012 }
  };

  // Canvas references
  let playerCanvas = null;
  let playerCtx = null;
  let codeDrawerOpen = false;

  // --- Initialize GIF Studio ---
  function init() {
    playerCanvas = document.getElementById('gifPlayerCanvas');
    if (playerCanvas) {
      playerCtx = playerCanvas.getContext('2d');
    }

    setupEventListeners();
    updateMemoryMeter();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(() => {
        updateMemoryMeter();
        updateScrubberLabel();
        if (codeDrawerOpen) {
          updateCodeView();
        }
      });
    }
    // 1. Left Sidebar Button & File Input
    const btnUploadGif = document.getElementById('btnUploadGif');
    const inputGifFile = document.getElementById('inputGifFile');

    if (btnUploadGif) {
      btnUploadGif.addEventListener('click', () => {
        if (typeof window.openAnimStudio === 'function') {
          window.openAnimStudio('gif');
        }
      });
    }

    if (inputGifFile) {
      inputGifFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
        inputGifFile.value = '';
      });
    }

    // 2. Drop Zone and Choose Buttons inside Animation Studio
    const btnChooseGifFile = document.getElementById('btnChooseGifFile');
    if (btnChooseGifFile && inputGifFile) {
      btnChooseGifFile.addEventListener('click', (e) => {
        e.stopPropagation();
        inputGifFile.click();
      });
    }

    const btnChangeGifFile = document.getElementById('btnChangeGifFile');
    if (btnChangeGifFile && inputGifFile) {
      btnChangeGifFile.addEventListener('click', (e) => {
        e.stopPropagation();
        inputGifFile.click();
      });
    }

    const gifDropZone = document.getElementById('gifDropZone');
    if (gifDropZone && inputGifFile) {
      gifDropZone.addEventListener('click', (e) => {
        if (e.target !== btnChooseGifFile && (!btnChooseGifFile || !btnChooseGifFile.contains(e.target))) {
          inputGifFile.click();
        }
      });

      gifDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gifDropZone.classList.add('dragover');
      });

      gifDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gifDropZone.classList.remove('dragover');
      });

      gifDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gifDropZone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))) {
            handleFile(file);
          }
        }
      });
    }

    // Also forward any .gif file selected in the regular image input
    const inputImageBitmap = document.getElementById('inputImageBitmap');
    if (inputImageBitmap) {
      inputImageBitmap.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))) {
          e.stopImmediatePropagation();
          handleFile(file);
          inputImageBitmap.value = '';
        }
      }, true); // Capture phase to intercept before static single-frame loader
    }

    // Drag and Drop on window & preview box
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))) {
          handleFile(file);
        }
      }
    });

    const gifScreenStage = document.getElementById('gifScreenStage');
    if (gifScreenStage) {
      gifScreenStage.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      gifScreenStage.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))) {
            handleFile(file);
          }
        }
      });
    }

    // Playback Controls
    const btnPlayPause = document.getElementById('btnGifPlayPause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', togglePlayPause);
    }

    const btnPrev = document.getElementById('btnGifPrevFrame');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => stepFrame(-1));
    }

    const btnNext = document.getElementById('btnGifNextFrame');
    if (btnNext) {
      btnNext.addEventListener('click', () => stepFrame(1));
    }

    const scrubber = document.getElementById('gifFrameScrubber');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10);
        if (!isNaN(idx)) {
          gifStudio.currentFrameIndex = idx;
          gifStudio.isPlaying = false;
          updatePlayPauseIcon();
          renderCurrentPlayerFrame();
          updateScrubberLabel();
        }
      });
    }

    // Speed chips
    document.querySelectorAll('.gif-speed-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gif-speed-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gifStudio.speedMult = parseFloat(btn.dataset.speed) || 1.0;
      });
    });

    // Dimension Presets
    document.querySelectorAll('.gif-size-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gif-size-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.size;
        applySizePreset(preset);
      });
    });

    // Custom width / height inputs
    const inputW = document.getElementById('gifInputWidth');
    const inputH = document.getElementById('gifInputHeight');
    const chkKeepAspect = document.getElementById('gifChkKeepAspect');

    if (inputW) {
      inputW.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val > 0) {
          val = Math.min(128, Math.max(8, val));
          gifStudio.targetW = val;
          if (gifStudio.keepAspect && gifStudio.originalW > 0) {
            gifStudio.targetH = Math.min(64, Math.max(8, Math.round(val * (gifStudio.originalH / gifStudio.originalW))));
            if (inputH) inputH.value = gifStudio.targetH;
          }
          reprocessAndRefresh();
        }
      });
    }

    if (inputH) {
      inputH.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val > 0) {
          val = Math.min(64, Math.max(8, val));
          gifStudio.targetH = val;
          if (gifStudio.keepAspect && gifStudio.originalH > 0) {
            gifStudio.targetW = Math.min(128, Math.max(8, Math.round(val * (gifStudio.originalW / gifStudio.originalH))));
            if (inputW) inputW.value = gifStudio.targetW;
          }
          reprocessAndRefresh();
        }
      });
    }

    if (chkKeepAspect) {
      chkKeepAspect.addEventListener('change', (e) => {
        gifStudio.keepAspect = e.target.checked;
      });
    }

    // Frame Skipping & Max Frames
    const selectSkip = document.getElementById('gifSelectFrameSkip');
    if (selectSkip) {
      selectSkip.addEventListener('change', (e) => {
        gifStudio.frameSkip = parseInt(e.target.value, 10) || 1;
        reprocessAndRefresh();
      });
    }

    const selectMax = document.getElementById('gifSelectMaxFrames');
    if (selectMax) {
      selectMax.addEventListener('change', (e) => {
        const v = e.target.value;
        gifStudio.maxFrames = (v === 'unlimited') ? 'unlimited' : (parseInt(v, 10) || 12);
        reprocessAndRefresh();
      });
    }

    // Dither Mode
    const selectDither = document.getElementById('gifSelectDitherMode');
    if (selectDither) {
      selectDither.addEventListener('change', (e) => {
        gifStudio.ditherMode = e.target.value;
        reprocessAndRefresh();
      });
    }

    // Threshold Slider
    const rangeThreshold = document.getElementById('gifRangeThreshold');
    const valThreshold = document.getElementById('gifValThreshold');
    if (rangeThreshold) {
      rangeThreshold.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        gifStudio.threshold = val;
        if (valThreshold) valThreshold.textContent = val;
        reprocessAndRefresh();
      });
    }

    // Invert Toggle
    const chkInvert = document.getElementById('gifChkInvert');
    if (chkInvert) {
      chkInvert.addEventListener('change', (e) => {
        gifStudio.inverted = e.target.checked;
        reprocessAndRefresh();
      });
    }

    // Target Hardware Board Selector
    const selectBoard = document.getElementById('gifSelectBoard');
    if (selectBoard) {
      selectBoard.addEventListener('change', (e) => {
        gifStudio.targetBoard = e.target.value;
        updateMemoryMeter();
      });
    }

    // Code Drawer Toggle & Selectors
    const btnToggleCode = document.getElementById('btnToggleGifCodeDrawer');
    if (btnToggleCode) {
      btnToggleCode.addEventListener('click', toggleCodeDrawer);
    }

    const libSelect = document.getElementById('gifCodeLibSelect');
    if (libSelect) {
      libSelect.addEventListener('change', (e) => {
        gifStudio.codeLibrary = e.target.value;
        updateCodeView();
      });
    }

    const scopeSelect = document.getElementById('gifCodeScopeSelect');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', (e) => {
        gifStudio.codeScope = e.target.value;
        updateCodeView();
      });
    }

    const btnCopyCode = document.getElementById('btnCopyGifCode');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', copyGifCode);
    }

    const btnDownloadIno = document.getElementById('btnDownloadGifIno');
    if (btnDownloadIno) {
      btnDownloadIno.addEventListener('click', downloadGifIno);
    }

    // Actions: Add to Canvas, Export as Screens
    const btnAddCanvas = document.getElementById('btnGifInsertCanvas');
    if (btnAddCanvas) {
      btnAddCanvas.addEventListener('click', insertAnimationToCanvas);
    }

    const btnAddScreens = document.getElementById('btnGifInsertScreens');
    if (btnAddScreens) {
      btnAddScreens.addEventListener('click', exportFramesToScreens);
    }
  }

  // --- Read & Parse GIF File ---
  function handleFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const arrayBuffer = e.target.result;
        loadGifFromArrayBuffer(arrayBuffer, file.name);
      } catch (err) {
        console.error('Error parsing GIF:', err);
        alert((typeof t === 'function' ? t('gif_error_invalid') : 'Geçersiz veya bozuk GIF dosyası.') + ' ' + (err.message || ''));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function loadGifFromArrayBuffer(buffer, filename) {
    if (typeof window.GifReader === 'undefined') {
      throw new Error('GifReader library not loaded.');
    }

    const uint8 = new Uint8Array(buffer);
    const gifReader = new window.GifReader(uint8);

    const numFrames = gifReader.numFrames();
    if (numFrames <= 0) {
      throw new Error('No frames found in GIF.');
    }

    gifStudio.filename = filename || 'animation.gif';
    gifStudio.originalW = gifReader.width;
    gifStudio.originalH = gifReader.height;
    gifStudio.rawFrames = [];

    // Decode and composit frames respecting disposal methods
    const fullW = gifReader.width;
    const fullH = gifReader.height;

    // We use offscreen canvas to properly accumulate and dispose frames
    const canvas = document.createElement('canvas');
    canvas.width = fullW;
    canvas.height = fullH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let prevCanvasData = null;

    for (let i = 0; i < numFrames; i++) {
      const frameInfo = gifReader.frameInfo(i);
      let delayMs = (frameInfo.delay || 10) * 10;
      if (delayMs < 20) delayMs = 100; // Fix corrupt or 0-delay GIFs to standard 100ms

      // Save previous canvas state if disposal requires restore to previous (disposal = 3)
      if (frameInfo.disposal === 3) {
        prevCanvasData = ctx.getImageData(0, 0, fullW, fullH);
      }

      // Read current subframe pixels
      const frameImageData = ctx.createImageData(fullW, fullH);
      gifReader.decodeAndBlitFrameRGBA(i, frameImageData.data);

      // Create a temporary canvas for this subframe
      const subCanvas = document.createElement('canvas');
      subCanvas.width = fullW;
      subCanvas.height = fullH;
      const subCtx = subCanvas.getContext('2d');
      subCtx.putImageData(frameImageData, 0, 0);

      // Draw onto accumulated canvas
      ctx.drawImage(subCanvas, 0, 0);

      // Snapshot this composite frame
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = fullW;
      snapshotCanvas.height = fullH;
      const snapCtx = snapshotCanvas.getContext('2d');
      snapCtx.drawImage(canvas, 0, 0);

      gifStudio.rawFrames.push({
        canvas: snapshotCanvas,
        width: fullW,
        height: fullH,
        delayMs: delayMs
      });

      // Handle disposal method for NEXT frame
      if (frameInfo.disposal === 2) {
        // Restore to background (clear frame rect)
        ctx.clearRect(frameInfo.x, frameInfo.y, frameInfo.width, frameInfo.height);
      } else if (frameInfo.disposal === 3 && prevCanvasData) {
        // Restore to previous
        ctx.putImageData(prevCanvasData, 0, 0);
      }
    }

    // Set intelligent default sizes based on original aspect and size
    autoConfigureDefaults();

    // Open Modal and Process
    openGifModal();
  }

  function autoConfigureDefaults() {
    const origW = gifStudio.originalW;
    const origH = gifStudio.originalH;
    const totalFrames = gifStudio.rawFrames.length;

    // Target dimensions
    if (origW <= 32 && origH <= 32) {
      gifStudio.targetW = 32;
      gifStudio.targetH = 32;
    } else if (origW <= 48 && origH <= 48) {
      gifStudio.targetW = 48;
      gifStudio.targetH = 48;
    } else if (origW === origH) {
      gifStudio.targetW = 48;
      gifStudio.targetH = 48;
    } else {
      // Wide or banner
      const ratio = Math.min(128 / origW, 64 / origH);
      gifStudio.targetW = Math.min(128, Math.max(16, Math.round(origW * ratio)));
      gifStudio.targetH = Math.min(64, Math.max(16, Math.round(origH * ratio)));
    }

    // Default frame skipping to safeguard Uno flash
    if (totalFrames > 24) {
      gifStudio.frameSkip = 3;
      gifStudio.maxFrames = 12;
    } else if (totalFrames > 14) {
      gifStudio.frameSkip = 2;
      gifStudio.maxFrames = 12;
    } else {
      gifStudio.frameSkip = 1;
      gifStudio.maxFrames = 'unlimited';
    }

    // Sync input controls with these defaults
    syncSettingsToInputs();
  }

  function syncSettingsToInputs() {
    const inputW = document.getElementById('gifInputWidth');
    const inputH = document.getElementById('gifInputHeight');
    if (inputW) inputW.value = gifStudio.targetW;
    if (inputH) inputH.value = gifStudio.targetH;

    const selectSkip = document.getElementById('gifSelectFrameSkip');
    if (selectSkip) selectSkip.value = String(gifStudio.frameSkip);

    const selectMax = document.getElementById('gifSelectMaxFrames');
    if (selectMax) selectMax.value = String(gifStudio.maxFrames);

    const rangeThreshold = document.getElementById('gifRangeThreshold');
    const valThreshold = document.getElementById('gifValThreshold');
    if (rangeThreshold) rangeThreshold.value = gifStudio.threshold;
    if (valThreshold) valThreshold.textContent = gifStudio.threshold;

    const chkInvert = document.getElementById('gifChkInvert');
    if (chkInvert) chkInvert.checked = gifStudio.inverted;

    // Highlight chip if matching preset
    updateSizeChipsActive();
  }

  function updateSizeChipsActive() {
    document.querySelectorAll('.gif-size-chip').forEach(btn => {
      const p = btn.dataset.size;
      const isMatch = (
        (p === '128x64' && gifStudio.targetW === 128 && gifStudio.targetH === 64) ||
        (p === '64x64' && gifStudio.targetW === 64 && gifStudio.targetH === 64) ||
        (p === '48x48' && gifStudio.targetW === 48 && gifStudio.targetH === 48) ||
        (p === '32x32' && gifStudio.targetW === 32 && gifStudio.targetH === 32) ||
        (p === '16x16' && gifStudio.targetW === 16 && gifStudio.targetH === 16)
      );
      btn.classList.toggle('active', isMatch);
    });
  }

  function applySizePreset(preset) {
    if (preset === '128x64') {
      gifStudio.targetW = 128;
      gifStudio.targetH = 64;
    } else if (preset === '64x64') {
      gifStudio.targetW = 64;
      gifStudio.targetH = 64;
    } else if (preset === '48x48') {
      gifStudio.targetW = 48;
      gifStudio.targetH = 48;
    } else if (preset === '32x32') {
      gifStudio.targetW = 32;
      gifStudio.targetH = 32;
    } else if (preset === '16x16') {
      gifStudio.targetW = 16;
      gifStudio.targetH = 16;
    }

    const inputW = document.getElementById('gifInputWidth');
    const inputH = document.getElementById('gifInputHeight');
    if (inputW) inputW.value = gifStudio.targetW;
    if (inputH) inputH.value = gifStudio.targetH;

    reprocessAndRefresh();
  }

  // --- Process & Quantize Frames ---
  function processFrames() {
    if (gifStudio.rawFrames.length === 0) {
      gifStudio.processedFrames = [];
      return;
    }

    const targetW = gifStudio.targetW;
    const targetH = gifStudio.targetH;
    const skip = gifStudio.frameSkip || 1;
    const maxLimit = gifStudio.maxFrames === 'unlimited' ? Infinity : (gifStudio.maxFrames || 12);

    // 1. Filter frames based on skip and max limit
    const sampledRawFrames = [];
    for (let i = 0; i < gifStudio.rawFrames.length; i += skip) {
      sampledRawFrames.push(gifStudio.rawFrames[i]);
      if (sampledRawFrames.length >= maxLimit) break;
    }

    // Scaling offscreen canvas
    const scaleCanvas = document.createElement('canvas');
    scaleCanvas.width = targetW;
    scaleCanvas.height = targetH;
    const scaleCtx = scaleCanvas.getContext('2d', { willReadFrequently: true });
    scaleCtx.imageSmoothingEnabled = true;
    scaleCtx.imageSmoothingQuality = 'high';

    const processed = [];

    sampledRawFrames.forEach((rawFrame, idx) => {
      scaleCtx.clearRect(0, 0, targetW, targetH);
      scaleCtx.drawImage(rawFrame.canvas, 0, 0, targetW, targetH);

      const imgData = scaleCtx.getImageData(0, 0, targetW, targetH);
      const rgba = imgData.data;

      // 1-bit quantization (Threshold or Floyd-Steinberg Dithering)
      const bitData = quantizeRgba(rgba, targetW, targetH, gifStudio.ditherMode, gifStudio.threshold, gifStudio.inverted);

      // Compensate frame delay if frames were skipped
      const adjustedDelay = rawFrame.delayMs * skip;

      processed.push({
        index: idx,
        w: targetW,
        h: targetH,
        delayMs: adjustedDelay,
        data: bitData
      });
    });

    gifStudio.processedFrames = processed;

    // Update scrubber bounds
    const scrubber = document.getElementById('gifFrameScrubber');
    if (scrubber) {
      scrubber.min = '0';
      scrubber.max = String(Math.max(0, processed.length - 1));
      if (gifStudio.currentFrameIndex >= processed.length) {
        gifStudio.currentFrameIndex = 0;
      }
      scrubber.value = String(gifStudio.currentFrameIndex);
    }

    updateScrubberLabel();
    updateMemoryMeter();
  }

  function quantizeRgba(rgba, w, h, mode, threshold, inverted) {
    const out = new Array(w * h);
    const alphaThresh = 40;

    if (mode === 'dither') {
      // Floyd-Steinberg error diffusion
      const lumBuf = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const a = rgba[i * 4 + 3];
        if (a < alphaThresh) {
          lumBuf[i] = 0;
        } else {
          const r = rgba[i * 4];
          const g = rgba[i * 4 + 1];
          const b = rgba[i * 4 + 2];
          lumBuf[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
      }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const oldVal = lumBuf[idx];
          const a = rgba[idx * 4 + 3];

          if (a < alphaThresh) {
            out[idx] = 0;
            continue;
          }

          const newVal = oldVal >= threshold ? 255 : 0;
          const err = oldVal - newVal;
          const bit = (newVal === 255) ? 1 : 0;
          out[idx] = inverted ? (1 - bit) : bit;

          if (x + 1 < w) lumBuf[idx + 1] += err * (7 / 16);
          if (y + 1 < h) {
            if (x > 0) lumBuf[idx + w - 1] += err * (3 / 16);
            lumBuf[idx + w] += err * (5 / 16);
            if (x + 1 < w) lumBuf[idx + w + 1] += err * (1 / 16);
          }
        }
      }
    } else {
      // Fixed threshold
      for (let i = 0; i < w * h; i++) {
        const a = rgba[i * 4 + 3];
        if (a < alphaThresh) {
          out[i] = 0;
          continue;
        }
        const r = rgba[i * 4];
        const g = rgba[i * 4 + 1];
        const b = rgba[i * 4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const bit = (lum >= threshold) ? 1 : 0;
        out[i] = inverted ? (1 - bit) : bit;
      }
    }

    return out;
  }

  function reprocessAndRefresh() {
    processFrames();
    renderCurrentPlayerFrame();
    updateMemoryMeter();
    updateScrubber();
    updateCodeView();
  }

  // --- Live OLED Player ---
  function startPlayback() {
    gifStudio.isPlaying = true;
    gifStudio.lastFrameTimestamp = performance.now();
    updatePlayPauseIcon();
    scheduleNextFrame();
  }

  function pausePlayback() {
    gifStudio.isPlaying = false;
    if (gifStudio.animTimer) {
      clearTimeout(gifStudio.animTimer);
      gifStudio.animTimer = null;
    }
    updatePlayPauseIcon();
  }

  function togglePlayPause() {
    if (gifStudio.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function updatePlayPauseIcon() {
    const btn = document.getElementById('btnGifPlayPause');
    if (!btn) return;
    const isPlaying = gifStudio.isPlaying;
    btn.innerHTML = isPlaying
      ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>`;
  }

  function scheduleNextFrame() {
    if (!gifStudio.isPlaying || gifStudio.processedFrames.length === 0) return;

    const current = gifStudio.processedFrames[gifStudio.currentFrameIndex];
    const delay = Math.max(20, Math.round((current ? current.delayMs : 100) / gifStudio.speedMult));

    gifStudio.animTimer = setTimeout(() => {
      if (!gifStudio.isPlaying) return;
      gifStudio.currentFrameIndex = (gifStudio.currentFrameIndex + 1) % gifStudio.processedFrames.length;
      renderCurrentPlayerFrame();
      updateScrubber();
      scheduleNextFrame();
    }, delay);
  }

  function stepFrame(delta) {
    pausePlayback();
    const count = gifStudio.processedFrames.length;
    if (count === 0) return;
    gifStudio.currentFrameIndex = (gifStudio.currentFrameIndex + delta + count) % count;
    renderCurrentPlayerFrame();
    updateScrubber();
  }

  function updateScrubber() {
    const scrubber = document.getElementById('gifFrameScrubber');
    if (scrubber) {
      scrubber.value = String(gifStudio.currentFrameIndex);
    }
    updateScrubberLabel();
  }

  function updateScrubberLabel() {
    const label = document.getElementById('gifScrubberLabel');
    if (!label) return;
    const current = gifStudio.currentFrameIndex + 1;
    const total = gifStudio.processedFrames.length;
    const currentFrame = gifStudio.processedFrames[gifStudio.currentFrameIndex];
    const sec = currentFrame ? (currentFrame.delayMs / 1000).toFixed(2) : '0.10';
    label.textContent = `${current} / ${total} (${sec}s)`;

    const countSummary = document.getElementById('gifFramesSummaryBadge');
    if (countSummary) {
      const unit = typeof t === 'function' && typeof getLang === 'function' && getLang() === 'tr' ? 'Kare' : 'Frames';
      const rawCount = gifStudio.rawFrames ? gifStudio.rawFrames.length : 0;
      countSummary.textContent = `${total} / ${rawCount} ${unit}`;
    }
  }

  function renderCurrentPlayerFrame() {
    if (!playerCanvas || !playerCtx) return;

    // Pitch-black OLED glass background
    playerCtx.fillStyle = '#030708';
    playerCtx.fillRect(0, 0, playerCanvas.width, playerCanvas.height);

    if (gifStudio.processedFrames.length === 0) return;

    const frame = gifStudio.processedFrames[gifStudio.currentFrameIndex];
    if (!frame) return;

    // Center animation on the 128x64 display preview
    const offsetX = Math.round((playerCanvas.width - frame.w) / 2);
    const offsetY = Math.round((playerCanvas.height - frame.h) / 2);

    // Get current OLED color from main app theme
    let oledHex = '#ffffff';
    if (typeof state !== 'undefined' && state.oledColor && typeof COLOR_MAP !== 'undefined' && COLOR_MAP[state.oledColor]) {
      oledHex = COLOR_MAP[state.oledColor].pixel;
    }

    playerCtx.fillStyle = oledHex;

    const data = frame.data;
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (data[y * frame.w + x] === 1) {
          playerCtx.fillRect(offsetX + x, offsetY + y, 1, 1);
        }
      }
    }
  }

  // --- Flash Memory Meter ---
  function updateMemoryMeter() {
    const count = gifStudio.processedFrames.length;
    const w = gifStudio.targetW;
    const h = gifStudio.targetH;

    // Row-padded byte calculation for Adafruit / U8g2 bitmaps
    const bytesPerRow = Math.ceil(w / 8);
    const bytesPerFrame = bytesPerRow * h;
    const totalBytes = bytesPerFrame * count;

    const boardKey = gifStudio.targetBoard || 'uno';
    const boardSpec = BOARD_FLASH_SPECS[boardKey] || BOARD_FLASH_SPECS.uno;
    const usable = boardSpec.usableBytes;
    const pct = count > 0 ? Math.min(100, (totalBytes / usable) * 100) : 0;

    const txtTotal = document.getElementById('gifMemTotalText');
    const txtBoardTitle = document.getElementById('gifMemBoardTitleText');
    const txtPercent = document.getElementById('gifMemUnoText');
    const progressBar = document.getElementById('gifMemUnoBar');
    const statusBadge = document.getElementById('gifMemUnoBadge');

    if (txtTotal) {
      txtTotal.textContent = totalBytes >= 1024
        ? `${(totalBytes / 1024).toFixed(1)} KB (${totalBytes.toLocaleString()} B)`
        : `${totalBytes} B`;
    }

    if (txtBoardTitle) {
      txtBoardTitle.textContent = boardSpec.name;
    }

    if (txtPercent) {
      txtPercent.textContent = count > 0
        ? (typeof getLang === 'function' && getLang() === 'en' ? `${pct.toFixed(1)}% Flash` : `%${pct.toFixed(1)} Flash`)
        : '-%';
    }

    if (progressBar) {
      progressBar.style.width = count > 0 ? `${Math.min(100, Math.max(2, pct))}%` : '0%';
      progressBar.className = 'mem-progress-bar-fill';
      if (pct > 75) progressBar.classList.add('danger');
      else if (pct > 40) progressBar.classList.add('warn');
      else progressBar.classList.add('safe');
    }

    if (statusBadge) {
      if (pct > 75) {
        statusBadge.className = 'mem-status-badge badge-danger';
        statusBadge.setAttribute('data-i18n', 'gif_mem_danger');
        statusBadge.textContent = (typeof t === 'function' ? t('gif_mem_danger') : 'Bellek Aşımı Riski!');
      } else if (pct > 40) {
        statusBadge.className = 'mem-status-badge badge-warn';
        statusBadge.setAttribute('data-i18n', 'gif_mem_warn');
        statusBadge.textContent = (typeof t === 'function' ? t('gif_mem_warn') : 'Dikkat: Yüksek');
      } else {
        statusBadge.className = 'mem-status-badge badge-safe';
        statusBadge.setAttribute('data-i18n', 'gif_mem_safe');
        statusBadge.textContent = (typeof t === 'function' ? t('gif_mem_safe') : 'Güvenli');
      }
    }
  }

  // --- Modal Open & Close (Animation Studio Integration) ---
  function openGifModal() {
    if (typeof window.openAnimStudio === 'function') {
      window.openAnimStudio('gif');
    }
    onGifStudioActivated();
  }

  function closeGifModal() {
    if (typeof window.closeAnimStudio === 'function') {
      window.closeAnimStudio();
    }
    onGifStudioDeactivated();
  }

  function onGifStudioActivated() {
    gifStudio.isOpen = true;
    const dropZone = document.getElementById('gifDropZone');
    const screenStage = document.getElementById('gifScreenStage');

    if (gifStudio.rawFrames && gifStudio.rawFrames.length > 0) {
      if (dropZone) dropZone.style.display = 'none';
      if (screenStage) screenStage.style.display = 'flex';
      reprocessAndRefresh();
      startPlayback();
    } else {
      if (dropZone) dropZone.style.display = 'flex';
      if (screenStage) screenStage.style.display = 'none';
      updateMemoryMeter();
    }

    if (typeof window.updateAnimStudioCode === 'function') {
      window.updateAnimStudioCode();
    }
  }

  function onGifStudioDeactivated() {
    gifStudio.isOpen = false;
    pausePlayback();
  }

  // --- Arduino C++ Code Generation ---
  function generateGifCode(lib, scope) {
    const isU8g2 = (lib || gifStudio.codeLibrary) === 'u8g2';
    const isModular = (scope || gifStudio.codeScope) === 'modular';
    const frames = gifStudio.processedFrames;
    const frameCount = frames.length;
    const w = gifStudio.targetW;
    const h = gifStudio.targetH;
    const rowBytes = Math.ceil(w / 8);

    if (frameCount === 0) {
      return (typeof t === 'function' && typeof getLang === 'function' && getLang() === 'en')
        ? '// No GIF file loaded yet.\n// Please upload a .gif file to preview animation and generate code.'
        : '// Henüz bir GIF dosyası yüklenmedi.\n// Lütfen animasyonu görmek ve kodunu almak için bir .gif dosyası yükleyin.';
    }

    // Generate PROGMEM byte arrays for each frame
    let frameArrays = [];
    let framePointers = [];
    let delays = [];

    frames.forEach((f, idx) => {
      const varName = `gif_frame_${idx}`;
      const bytes = [];

      for (let r = 0; r < h; r++) {
        for (let cb = 0; cb < rowBytes; cb++) {
          let b = 0;
          for (let bit = 0; bit < 8; bit++) {
            const c = cb * 8 + bit;
            if (c < w) {
              if (f.data[r * w + c]) {
                if (isU8g2) {
                  // XBM format for u8g2.drawXBMP (LSB first)
                  b |= (1 << bit);
                } else {
                  // Adafruit drawBitmap (MSB first)
                  b |= (1 << (7 - bit));
                }
              }
            }
          }
          bytes.push('0x' + b.toString(16).padStart(2, '0').toUpperCase());
        }
      }

      frameArrays.push(`// Frame ${idx + 1}/${frameCount} (${w}x${h})
static const unsigned char PROGMEM ${varName}[] = {
  ${chunkArray(bytes, 16).join(',\n  ')}
};`);
      framePointers.push(`  ${varName}`);
      delays.push(f.delayMs);
    });

    const posX = Math.max(0, Math.round((128 - w) / 2));
    const posY = Math.max(0, Math.round((64 - h) / 2));
    const avgDelay = Math.round(delays.reduce((a, b) => a + b, 0) / frameCount);

    if (!isU8g2) {
      // Adafruit SSD1306
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - GIF Animation Header (Modular)
// Target Hardware: Arduino Uno / Nano / ESP32 / ESP8266
// Display Library: Adafruit SSD1306 & Adafruit GFX
// Dimensions: ${w}x${h} pixels | Frames: ${frameCount} | Avg Speed: ${avgDelay}ms
// ==========================================================================

#ifndef GIF_ANIMATION_H
#define GIF_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define GIF_WIDTH   ${w}
#define GIF_HEIGHT  ${h}
#define GIF_FRAMES  ${frameCount}
#define GIF_POS_X   ${posX}
#define GIF_POS_Y   ${posY}

// --- PROGMEM BITMAP FRAMES ---
${frameArrays.join('\n\n')}

// Pointer array in Flash
static const unsigned char* const gif_frame_ptrs[] PROGMEM = {
${framePointers.join(',\n')}
};

// Delays per frame in ms
static const uint16_t gif_frame_delays[GIF_FRAMES] = { ${delays.join(', ')} };

// Animation Controller State
static int _gifCurrFrame = 0;
static unsigned long _gifLastTime = 0;

inline void updateAndDrawGif(Adafruit_SSD1306 &disp) {
  unsigned long now = millis();
  uint16_t currentDelay = gif_frame_delays[_gifCurrFrame];

  if (now - _gifLastTime >= currentDelay) {
    _gifLastTime = now;
    _gifCurrFrame = (_gifCurrFrame + 1) % GIF_FRAMES;
  }

  // Draw current frame from PROGMEM
  disp.drawBitmap(GIF_POS_X, GIF_POS_Y, 
                  (const unsigned char*)pgm_read_ptr(&(gif_frame_ptrs[_gifCurrFrame])), 
                  GIF_WIDTH, GIF_HEIGHT, SSD1306_WHITE);
}

#endif // GIF_ANIMATION_H
`;
      } else {
        // Full Arduino Sketch (.ino)
        return `// ==========================================================================
// OLED Studio - Standalone Animated GIF Player (.ino)
// Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C 0x3C)
// Dimensions: ${w}x${h} px | Total Frames: ${frameCount}
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

#define GIF_WIDTH   ${w}
#define GIF_HEIGHT  ${h}
#define GIF_FRAMES  ${frameCount}
#define GIF_POS_X   ${posX}
#define GIF_POS_Y   ${posY}

// ==========================================================================
// PROGMEM FRAME DATA
// ==========================================================================
${frameArrays.join('\n\n')}

static const unsigned char* const gif_frame_ptrs[] PROGMEM = {
${framePointers.join(',\n')}
};

static const uint16_t gif_frame_delays[GIF_FRAMES] = { ${delays.join(', ')} };

int currentFrame = 0;
unsigned long lastFrameTime = 0;

void setup() {
  Wire.begin();
  Wire.setClock(400000); // 400kHz Fast I2C

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    for(;;); // Display failed
  }

  display.clearDisplay();
  display.display();
}

void loop() {
  unsigned long now = millis();

  if (now - lastFrameTime >= gif_frame_delays[currentFrame]) {
    lastFrameTime = now;
    currentFrame = (currentFrame + 1) % GIF_FRAMES;

    display.clearDisplay();
    // Non-blocking PROGMEM bitmap render
    display.drawBitmap(GIF_POS_X, GIF_POS_Y, 
                       (const unsigned char*)pgm_read_ptr(&(gif_frame_ptrs[currentFrame])), 
                       GIF_WIDTH, GIF_HEIGHT, SSD1306_WHITE);
    display.display();
  }
}
`;
      }
    } else {
      // U8g2 Library (using drawXBMP)
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - GIF Animation Header (U8g2 Modular)
// Library: U8g2 (Full Buffer or Picture Loop)
// Dimensions: ${w}x${h} px | Frames: ${frameCount}
// ==========================================================================

#ifndef GIF_ANIMATION_U8G2_H
#define GIF_ANIMATION_U8G2_H

#include <Arduino.h>
#include <U8g2lib.h>

#define GIF_WIDTH   ${w}
#define GIF_HEIGHT  ${h}
#define GIF_FRAMES  ${frameCount}
#define GIF_POS_X   ${posX}
#define GIF_POS_Y   ${posY}

${frameArrays.join('\n\n')}

static const unsigned char* const gif_frame_ptrs[] PROGMEM = {
${framePointers.join(',\n')}
};

static const uint16_t gif_frame_delays[GIF_FRAMES] = { ${delays.join(', ')} };

static int _gifCurrFrame = 0;
static unsigned long _gifLastTime = 0;

inline void updateAndDrawGifU8g2(U8G2 &disp) {
  unsigned long now = millis();
  if (now - _gifLastTime >= gif_frame_delays[_gifCurrFrame]) {
    _gifLastTime = now;
    _gifCurrFrame = (_gifCurrFrame + 1) % GIF_FRAMES;
  }

  disp.drawXBMP(GIF_POS_X, GIF_POS_Y, GIF_WIDTH, GIF_HEIGHT,
                (const uint8_t*)pgm_read_ptr(&(gif_frame_ptrs[_gifCurrFrame])));
}

#endif // GIF_ANIMATION_U8G2_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Standalone Animated GIF Player (U8g2 .ino)
// Library: U8g2 (Wire I2C 0x3C)
// Dimensions: ${w}x${h} px | Frames: ${frameCount}
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

// Change display driver constructor if using SH1106 or SPI
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

#define GIF_WIDTH   ${w}
#define GIF_HEIGHT  ${h}
#define GIF_FRAMES  ${frameCount}
#define GIF_POS_X   ${posX}
#define GIF_POS_Y   ${posY}

${frameArrays.join('\n\n')}

static const unsigned char* const gif_frame_ptrs[] PROGMEM = {
${framePointers.join(',\n')}
};

static const uint16_t gif_frame_delays[GIF_FRAMES] = { ${delays.join(', ')} };

int currentFrame = 0;
unsigned long lastFrameTime = 0;

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
}

void loop() {
  unsigned long now = millis();

  if (now - lastFrameTime >= gif_frame_delays[currentFrame]) {
    lastFrameTime = now;
    currentFrame = (currentFrame + 1) % GIF_FRAMES;

    u8g2.clearBuffer();
    u8g2.drawXBMP(GIF_POS_X, GIF_POS_Y, GIF_WIDTH, GIF_HEIGHT,
                  (const uint8_t*)pgm_read_ptr(&(gif_frame_ptrs[currentFrame])));
    u8g2.sendBuffer();
  }
}
`;
      }
    }
  }

  function chunkArray(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size).join(', '));
    }
    return res;
  }

  function updateCodeView() {
    if (typeof window.updateAnimStudioCode === 'function') {
      window.updateAnimStudioCode();
    }
    const codeEl = document.getElementById('gifCodeSnippet');
    if (codeEl) codeEl.textContent = generateGifCode();
  }

  function copyGifCode() {
    const code = generateGifCode();
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('btnCopyGifCode');
      if (btn) {
        const originalText = btn.innerHTML;
        const copiedLabel = typeof t === 'function' ? t('copied') : 'Kopyalandı!';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg> ${copiedLabel}`;
        setTimeout(() => { btn.innerHTML = originalText; }, 1800);
      }
    });
  }

  function downloadGifIno() {
    const code = generateGifCode();
    const isHeader = gifStudio.codeScope === 'modular';
    const ext = isHeader ? '.h' : '.ino';
    const cleanName = gifStudio.filename.replace(/\.gif$/i, '').replace(/[^a-zA-Z0-9_]/g, '_');
    const filename = `${cleanName}_oled${ext}`;

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Insert into Project Canvas & Screens ---
  function insertAnimationToCanvas() {
    if (gifStudio.processedFrames.length === 0) return;
    if (typeof state === 'undefined' || !state.objects) return;

    if (typeof pushHistory === 'function') pushHistory();

    const w = gifStudio.targetW;
    const h = gifStudio.targetH;
    const posX = Math.round((SCREEN_WIDTH - w) / 2);
    const posY = Math.round((SCREEN_HEIGHT - h) / 2);

    // Create a special animated bitmap object
    const newAnimObj = {
      id: (typeof generateId === 'function' ? generateId() : ('obj_' + Date.now())),
      type: 'bitmap',
      isAnimation: true,
      name: gifStudio.filename.substring(0, 12),
      x: posX,
      y: posY,
      w: w,
      h: h,
      origW: w,
      origH: h,
      threshold: gifStudio.threshold,
      inverted: gifStudio.inverted,
      ditherMode: gifStudio.ditherMode,
      visible: true,
      currentFrame: 0,
      frames: gifStudio.processedFrames.map(f => ({
        data: [...f.data],
        delayMs: f.delayMs
      })),
      // Set initial data to first frame
      data: [...gifStudio.processedFrames[0].data]
    };

    state.objects.push(newAnimObj);
    if (typeof selectObject === 'function') selectObject(newAnimObj.id);
    if (typeof setActiveTool === 'function') setActiveTool('select');
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateArduinoCode === 'function') updateArduinoCode();

    closeGifModal();
  }

  function exportFramesToScreens() {
    if (gifStudio.processedFrames.length === 0) return;
    if (typeof state === 'undefined' || !state.screens) return;

    if (typeof pushHistory === 'function') pushHistory();

    const w = gifStudio.targetW;
    const h = gifStudio.targetH;
    const posX = Math.round((SCREEN_WIDTH - w) / 2);
    const posY = Math.round((SCREEN_HEIGHT - h) / 2);
    const baseName = gifStudio.filename.replace(/\.gif$/i, '');

    gifStudio.processedFrames.forEach((frame, idx) => {
      const screenId = 'screen_' + (typeof generateId === 'function' ? generateId() : (Date.now() + '_' + idx));
      const bmpObj = {
        id: (typeof generateId === 'function' ? generateId() : ('bmp_' + Date.now() + '_' + idx)),
        type: 'bitmap',
        name: `F${idx + 1}`,
        x: posX,
        y: posY,
        w: w,
        h: h,
        origW: w,
        origH: h,
        threshold: gifStudio.threshold,
        inverted: gifStudio.inverted,
        ditherMode: gifStudio.ditherMode,
        data: [...frame.data],
        visible: true
      };

      state.screens.push({
        id: screenId,
        name: `${baseName}_${idx + 1}`,
        objects: [bmpObj],
        pixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
        erasedPixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
        undoStack: [],
        redoStack: []
      });
    });

    if (typeof renderScreenTabs === 'function') renderScreenTabs();
    if (typeof switchScreen === 'function') switchScreen(state.screens[state.screens.length - 1].id);
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateArduinoCode === 'function') updateArduinoCode();

    closeGifModal();
  }

  // --- Bootstrap ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global methods
  window.openGifModal = openGifModal;
  window.closeGifModal = closeGifModal;
  window.loadGifFile = handleFile;
  window.generateGifCode = generateGifCode;
  window.getGifFilename = function () { return (gifStudio.filename || 'animation').replace(/\.gif$/i, ''); };
  window.onGifStudioActivated = onGifStudioActivated;
  window.onGifStudioDeactivated = onGifStudioDeactivated;
})();
