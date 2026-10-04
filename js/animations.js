/**
 * OLED Studio - Procedural Animation & Effect Generator
 * Generates ultra-lightweight procedural C++ code for Arduino Uno, Nano, and ESP32.
 * Includes both Pre-made Templates and Custom Keyframe Motion Builder.
 */

(function () {
  'use strict';

  // --- Modes: 'presets' or 'custom' ---
  let studioMode = 'custom';

  // --- Common Animation State ---
  let animActive = false;
  let animFrameId = null;
  let currentTemplate = 'robot_eyes'; // 'robot_eyes', 'radar_scan', 'sine_wave', 'starfield', 'progress_bar'
  let isPlaying = true;
  let codeLibrary = 'adafruit'; // 'adafruit' or 'u8g2'
  let codeScope = 'full'; // 'full' or 'modular'
  let lastTimestamp = 0;
  let currentOledColor = '#ffffff';

  // Code drawer state (collapsed by default)
  let isCodeDrawerOpen = false;

  // Canvas & Context
  let animCanvas = null;
  let animCtx = null;
  const CANVAS_WIDTH = 128;
  const CANVAS_HEIGHT = 64;

  // Dragging state on canvas (when paused in Custom Mode)
  let isDragging = false;
  let dragTarget = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let shapeInitialX = 0;
  let shapeInitialY = 0;
  let shapeInitialX2 = 0;
  let shapeInitialY2 = 0;

  // --- Custom Studio Data Model ---
  const customStudio = {
    activeKeyframe: 'kA', // 'kA' (Start) or 'kB' (End)
    selectedId: 1,
    holdDuration: 0.5, // hold duration in seconds at each keyframe
    moveDuration: 0.6, // transition movement duration in seconds
    speed: 5,
    customTime: 0,
    nextId: 2,
    objects: [
      {
        id: 1,
        name: 'Kutu 1',
        type: 'round_rect',
        kA: { x: 28, y: 16, w: 28, h: 28, r: 6, spacing: 0, text: '' },
        kB: { x: 72, y: 16, w: 28, h: 28, r: 6, spacing: 0, text: '' }
      }
    ]
  };

  // --- Pre-made Template Parameters ---
  const params = {
    robot_eyes: {
      eyeWidth: 36,
      eyeHeight: 36,
      eyeSpace: 10,
      cornerRadius: 10,
      speed: 5,
      autoDemo: true,
      currentEmotion: 'idle',
      emotionTimer: 0,
      animPhase: 0,
      blinkProgress: 0,
      currOffX: 0,
      currOffY: 0,
      targetOffX: 0,
      targetOffY: 0,
      targetH: 36,
      targetW: 36,
      currH: 36,
      currW: 36
    },
    radar_scan: {
      radius: 26,
      speed: 4,
      showCrosshairs: true,
      showBlips: true,
      angle: 0,
      blips: [
        { angle: 0.8, dist: 16, life: 1 },
        { angle: 2.3, dist: 22, life: 0.6 },
        { angle: 4.1, dist: 12, life: 0.3 }
      ]
    },
    sine_wave: {
      mode: 'line',
      amplitude: 16,
      frequency: 3,
      speed: 5,
      phase: 0
    },
    starfield: {
      count: 36,
      speed: 4,
      stars: []
    },
    progress_bar: {
      style: 'striped',
      width: 100,
      height: 14,
      progress: 68,
      speed: 4,
      stripeOffset: 0
    }
  };

  function initStars() {
    params.starfield.stars = [];
    const count = params.starfield.count;
    for (let i = 0; i < count; i++) {
      params.starfield.stars.push({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        z: Math.random() * 100 + 1,
        prevZ: 100
      });
    }
  }

  function calculateSafeRadius(r, w, h) {
    let maxR = Math.floor(Math.min(w, h) / 2) - 1;
    if (maxR < 0) maxR = 0;
    return Math.max(0, Math.min(r, maxR));
  }

  // --- Custom Studio Easing & Interpolation ---

  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function getInterpolationProgress(time, holdDuration, moveDuration) {
    const tHold = Math.max(0, typeof holdDuration === 'number' ? holdDuration : 1.0);
    const tMove = typeof moveDuration === 'number' ? moveDuration : 0.35;
    const totalCycle = 2 * (tHold + tMove);
    if (totalCycle <= 0.001) return 0;

    const cycleTime = time % totalCycle;

    // Phase 1: Hold at Start Frame
    if (cycleTime < tHold) {
      return 0.0;
    }
    // Phase 2: Move from Start to End (Smoothstep)
    if (cycleTime < tHold + tMove) {
      const u = (cycleTime - tHold) / tMove;
      return u * u * (3 - 2 * u);
    }
    // Phase 3: Hold at End Frame
    if (cycleTime < 2 * tHold + tMove) {
      return 1.0;
    }
    // Phase 4: Move from End to Start (Smoothstep)
    const u = (cycleTime - (2 * tHold + tMove)) / tMove;
    return 1 - (u * u * (3 - 2 * u));
  }

  function getInterpolatedObjectState(obj, t) {
    const kA = obj.kA;
    const kB = obj.kB;
    return {
      x: lerp(kA.x, kB.x, t),
      y: lerp(kA.y, kB.y, t),
      x2: lerp(kA.x2 !== undefined ? kA.x2 : (kA.x + (kA.w || 20)), kB.x2 !== undefined ? kB.x2 : (kB.x + (kB.w || 20)), t),
      y2: lerp(kA.y2 !== undefined ? kA.y2 : (kA.y + (kA.h || 0)), kB.y2 !== undefined ? kB.y2 : (kB.y + (kB.h || 0)), t),
      w: lerp(kA.w || 0, kB.w || 0, t),
      h: lerp(kA.h || 0, kB.h || 0, t),
      r: lerp(kA.r || 0, kB.r || 0, t),
      spacing: lerp(kA.spacing || 12, kB.spacing || 12, t),
      text: kA.text || 'OLED'
    };
  }

  // --- Custom Animation Renderer ---

  function renderCustomAnimation(ctx, dt) {
    if (isPlaying) {
      customStudio.customTime += dt;
    }

    const t = isPlaying
      ? getInterpolationProgress(customStudio.customTime, customStudio.holdDuration, customStudio.moveDuration)
      : (customStudio.activeKeyframe === 'kA' ? 0 : 1);

    ctx.fillStyle = currentOledColor;
    ctx.strokeStyle = currentOledColor;
    ctx.lineWidth = 1;

    customStudio.objects.forEach(obj => {
      const state = isPlaying ? getInterpolatedObjectState(obj, t) : obj[customStudio.activeKeyframe];

      if (obj.type === 'round_rect') {
        const safeR = calculateSafeRadius(state.r, state.w, state.h);
        drawRoundRect(ctx, state.x, state.y, state.w, state.h, safeR);
      } else if (obj.type === 'circle') {
        const radius = Math.max(1, Math.round(Math.min(state.w, state.h) / 2));
        ctx.beginPath();
        ctx.arc(state.x + radius, state.y + radius, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(state.x, state.y);
        ctx.lineTo(state.x2, state.y2);
        ctx.stroke();
      } else if (obj.type === 'eyes') {
        const safeR = calculateSafeRadius(state.r, state.w, state.h);
        const rightX = state.x + state.w + (state.spacing || 14);
        drawRoundRect(ctx, state.x, state.y, state.w, state.h, safeR);
        drawRoundRect(ctx, rightX, state.y, state.w, state.h, safeR);
      } else if (obj.type === 'text') {
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(state.text || 'OLED', state.x, state.y + 12);
      }

      // If paused and this object is selected, draw subtle selection box
      if (!isPlaying && obj.id === customStudio.selectedId) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        if (obj.type === 'line') {
          const minX = Math.min(state.x, state.x2);
          const minY = Math.min(state.y, state.y2);
          const maxX = Math.max(state.x, state.x2);
          const maxY = Math.max(state.y, state.y2);
          ctx.strokeRect(minX - 3, minY - 3, Math.max(8, (maxX - minX) + 6), Math.max(8, (maxY - minY) + 6));
        } else {
          const boundW = obj.type === 'eyes' ? (state.w * 2 + (state.spacing || 14)) : state.w;
          ctx.strokeRect(state.x - 2, state.y - 2, boundW + 4, state.h + 4);
        }
        ctx.restore();
      }
    });
  }

  // --- Pre-made Template Renderers ---

  function renderRobotEyes(ctx, dt) {
    const p = params.robot_eyes;
    p.animPhase += dt * (p.speed * 0.8);

    if (p.autoDemo) {
      p.emotionTimer += dt;
      if (p.emotionTimer > 3.2) {
        p.emotionTimer = 0;
        const emotions = ['blink', 'look_left', 'look_right', 'happy', 'idle', 'saccade'];
        const nextEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        triggerEyeEmotion(nextEmotion);
      }
    }

    let happyMask = false;

    if (p.currentEmotion === 'blink') {
      p.blinkProgress += dt / 0.18; // smooth natural 180ms blink
      if (p.blinkProgress >= 1) {
        p.blinkProgress = 0;
        p.currentEmotion = 'idle';
        p.targetH = p.eyeHeight;
        p.targetW = p.eyeWidth;
      } else {
        const sinBlink = Math.sin(p.blinkProgress * Math.PI);
        p.targetH = Math.max(2, p.eyeHeight * (1 - sinBlink * 0.94));
        p.targetW = p.eyeWidth + sinBlink * 2;
      }
    } else if (p.currentEmotion === 'look_left') {
      p.targetOffX = -8;
      p.targetOffY = 0;
      p.targetH = p.eyeHeight;
      p.targetW = p.eyeWidth;
    } else if (p.currentEmotion === 'look_right') {
      p.targetOffX = 8;
      p.targetOffY = 0;
      p.targetH = p.eyeHeight;
      p.targetW = p.eyeWidth;
    } else if (p.currentEmotion === 'happy') {
      p.targetOffX = 0;
      p.targetOffY = -2;
      p.targetH = p.eyeHeight;
      p.targetW = p.eyeWidth;
      happyMask = true;
    } else if (p.currentEmotion === 'sleep') {
      p.targetOffX = 0;
      p.targetOffY = 4;
      p.targetH = 3;
      p.targetW = p.eyeWidth;
    } else if (p.currentEmotion === 'saccade') {
      p.targetOffX = Math.round(Math.sin(p.animPhase * 5) * 5);
      p.targetOffY = Math.round(Math.cos(p.animPhase * 4) * 3);
      p.targetH = p.eyeHeight;
      p.targetW = p.eyeWidth;
      if (p.emotionTimer > 1.2) {
        p.currentEmotion = 'idle';
        p.emotionTimer = 0;
      }
    } else {
      // idle
      p.targetOffX = 0;
      p.targetOffY = 0;
      p.targetH = p.eyeHeight;
      p.targetW = p.eyeWidth;
    }

    // Smooth physics interpolation: eliminates all visual stuttering and instant jumps
    const smoothPos = Math.min(1.0, dt * 14);
    p.currOffX += (p.targetOffX - p.currOffX) * smoothPos;
    p.currOffY += (p.targetOffY - p.currOffY) * smoothPos;

    const smoothDim = Math.min(1.0, dt * 25);
    p.currH += (p.targetH - p.currH) * smoothDim;
    p.currW += (p.targetW - p.currW) * smoothDim;

    const currentW = Math.round(p.currW);
    const currentH = Math.round(p.currH);
    const currentR = Math.min(p.cornerRadius, Math.floor(currentH / 2));

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const leftX = Math.round(centerX - (p.eyeSpace / 2) - currentW + p.currOffX);
    const rightX = Math.round(centerX + (p.eyeSpace / 2) + p.currOffX);
    const eyeY = Math.round(centerY - (currentH / 2) + p.currOffY);

    ctx.fillStyle = currentOledColor;

    const safeR = calculateSafeRadius(currentR, currentW, currentH);
    drawRoundRect(ctx, leftX, eyeY, currentW, currentH, safeR);
    drawRoundRect(ctx, rightX, eyeY, currentW, currentH, safeR);

    if (happyMask) {
      ctx.fillStyle = '#030708';
      ctx.beginPath();
      ctx.moveTo(leftX - 2, eyeY + currentH + 2);
      ctx.lineTo(leftX + currentW + 2, eyeY + currentH + 2);
      ctx.lineTo(leftX + currentW / 2, eyeY + (currentH * 0.35));
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rightX - 2, eyeY + currentH + 2);
      ctx.lineTo(rightX + currentW + 2, eyeY + currentH + 2);
      ctx.lineTo(rightX + currentW / 2, eyeY + (currentH * 0.35));
      ctx.closePath();
      ctx.fill();
    }
  }

  function renderRadarScan(ctx, dt) {
    const p = params.radar_scan;
    p.angle = (p.angle + dt * p.speed * 2.2) % (Math.PI * 2);

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.strokeStyle = currentOledColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(centerX, centerY, p.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.round(p.radius * 0.6), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.round(p.radius * 0.25), 0, Math.PI * 2);
    ctx.stroke();

    if (p.showCrosshairs) {
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(centerX - p.radius - 4, centerY);
      ctx.lineTo(centerX + p.radius + 4, centerY);
      ctx.moveTo(centerX, centerY - p.radius - 4);
      ctx.lineTo(centerX, centerY + p.radius + 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const sweepX = centerX + Math.cos(p.angle) * p.radius;
    const sweepY = centerY + Math.sin(p.angle) * p.radius;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sweepX, sweepY);
    ctx.stroke();

    if (p.showBlips) {
      p.blips.forEach(b => {
        const bx = centerX + Math.cos(b.angle) * b.dist;
        const by = centerY + Math.sin(b.angle) * b.dist;
        const diff = Math.abs((p.angle - b.angle + Math.PI * 2) % (Math.PI * 2));
        if (diff < 0.2) b.life = 1.0;
        else b.life = Math.max(0.1, b.life - dt * 0.4);

        ctx.globalAlpha = b.life;
        ctx.fillRect(Math.round(bx - 1), Math.round(by - 1), 3, 3);
      });
      ctx.globalAlpha = 1.0;
    }
  }

  function renderSineWave(ctx, dt) {
    const p = params.sine_wave;
    p.phase += dt * p.speed * 3.5;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.strokeStyle = currentOledColor;
    ctx.fillStyle = currentOledColor;
    ctx.lineWidth = 1;

    if (p.mode === 'line') {
      ctx.beginPath();
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const y = centerY + Math.sin((x * p.frequency * 0.05) + p.phase) * p.amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(CANVAS_WIDTH, centerY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const numBars = 16;
      const barWidth = 5;
      const gap = 3;
      const totalWidth = numBars * (barWidth + gap) - gap;
      const startX = Math.round((CANVAS_WIDTH - totalWidth) / 2);

      for (let i = 0; i < numBars; i++) {
        const barPhase = p.phase + (i * 0.5);
        const dynamicH = Math.abs(Math.sin(barPhase) * p.amplitude * 1.5) + 3;
        const bx = startX + i * (barWidth + gap);
        const by = CANVAS_HEIGHT - 8 - dynamicH;
        ctx.fillRect(bx, by, barWidth, dynamicH);
      }
      ctx.fillRect(startX - 4, CANVAS_HEIGHT - 6, totalWidth + 8, 2);
    }
  }

  function renderStarfield(ctx, dt) {
    const p = params.starfield;
    const speed = p.speed * 18 * dt;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.fillStyle = currentOledColor;

    for (let i = 0; i < p.stars.length; i++) {
      const star = p.stars[i];
      star.prevZ = star.z;
      star.z -= speed;

      if (star.z <= 0) {
        star.z = 100;
        star.prevZ = 100;
        star.x = (Math.random() - 0.5) * 200;
        star.y = (Math.random() - 0.5) * 200;
      }

      const k = 40 / star.z;
      const sx = Math.round(star.x * k + centerX);
      const sy = Math.round(star.y * k + centerY);
      const prevK = 40 / star.prevZ;
      const px = Math.round(star.x * prevK + centerX);
      const py = Math.round(star.y * prevK + centerY);

      if (sx >= 0 && sx < CANVAS_WIDTH && sy >= 0 && sy < CANVAS_HEIGHT) {
        const size = star.z < 35 ? 2 : 1;
        ctx.fillRect(sx, sy, size, size);
        if (size > 1 && (px !== sx || py !== sy)) {
          ctx.beginPath();
          ctx.strokeStyle = currentOledColor;
          ctx.lineWidth = 1;
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }
    }
  }

  function renderProgressBar(ctx, dt) {
    const p = params.progress_bar;
    p.stripeOffset = (p.stripeOffset + dt * p.speed * 12) % 10;
    const startX = Math.round((CANVAS_WIDTH - p.width) / 2);
    const startY = Math.round((CANVAS_HEIGHT - p.height) / 2) - 4;

    ctx.strokeStyle = currentOledColor;
    ctx.fillStyle = currentOledColor;
    ctx.lineWidth = 1;

    drawRoundRectStroke(ctx, startX, startY, p.width, p.height, 4);

    const fillWidth = Math.max(0, Math.round((p.width - 4) * (p.progress / 100)));
    const fillInnerX = startX + 2;
    const fillInnerY = startY + 2;
    const fillInnerH = p.height - 4;

    if (p.style === 'striped') {
      ctx.save();
      ctx.beginPath();
      drawRoundRectPath(ctx, fillInnerX, fillInnerY, fillWidth, fillInnerH, 2);
      ctx.clip();
      ctx.fillRect(fillInnerX, fillInnerY, fillWidth, fillInnerH);

      ctx.fillStyle = '#030708';
      for (let sx = -20; sx < p.width + 20; sx += 8) {
        const xPos = fillInnerX + sx + p.stripeOffset;
        ctx.beginPath();
        ctx.moveTo(xPos, fillInnerY);
        ctx.lineTo(xPos + 4, fillInnerY);
        ctx.lineTo(xPos, fillInnerY + fillInnerH);
        ctx.lineTo(xPos - 4, fillInnerY + fillInnerH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      drawRoundRect(ctx, fillInnerX, fillInnerY, fillWidth, fillInnerH, 2);
    }

    ctx.fillStyle = currentOledColor;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(p.progress)}%`, CANVAS_WIDTH / 2, startY + p.height + 14);
  }

  // Draw helpers
  function drawRoundRect(ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    drawRoundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
  }

  function drawRoundRectStroke(ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    drawRoundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  function drawRoundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // --- Main Animation Loop ---

  function animLoop(timestamp) {
    if (!animActive) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // Pitch-black OLED background
    animCtx.fillStyle = '#030708';
    animCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (studioMode === 'custom') {
      renderCustomAnimation(animCtx, dt);
    } else {
      if (isPlaying) {
        switch (currentTemplate) {
          case 'robot_eyes': renderRobotEyes(animCtx, dt); break;
          case 'radar_scan': renderRadarScan(animCtx, dt); break;
          case 'sine_wave': renderSineWave(animCtx, dt); break;
          case 'starfield': renderStarfield(animCtx, dt); break;
          case 'progress_bar': renderProgressBar(animCtx, dt); break;
        }
      }
    }

    animFrameId = requestAnimationFrame(animLoop);
  }

  function triggerEyeEmotion(emotion) {
    const p = params.robot_eyes;
    p.currentEmotion = emotion;
    p.emotionTimer = 0;
    if (emotion === 'blink') p.blinkProgress = 0;
    updateEmotionButtonsActiveState();
  }

  function updateEmotionButtonsActiveState() {
    const buttons = document.querySelectorAll('.anim-emotion-btn');
    buttons.forEach(btn => {
      const emo = btn.getAttribute('data-emotion');
      btn.classList.toggle('active', emo === params.robot_eyes.currentEmotion);
    });
  }

  // --- Code Drawer Toggle ---

  function toggleCodeDrawer(open) {
    const drawer = document.getElementById('animCodeDrawer');
    if (!drawer) return;
    if (typeof open === 'boolean') {
      isCodeDrawerOpen = open;
    } else {
      isCodeDrawerOpen = !isCodeDrawerOpen;
    }
    drawer.classList.toggle('open', isCodeDrawerOpen);

    const toggleBtn = document.getElementById('btnToggleAnimCodeDrawer');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isCodeDrawerOpen);
    }
  }

  // --- C++ Code Generators ---

  function generateCode() {
    if (studioMode === 'custom') {
      return generateCustomAnimationCode();
    }
    switch (currentTemplate) {
      case 'robot_eyes': return generateRobotEyesCode();
      case 'radar_scan': return generateRadarScanCode();
      case 'sine_wave': return generateSineWaveCode();
      case 'starfield': return generateStarfieldCode();
      case 'progress_bar': return generateProgressBarCode();
      default: return '// No code available';
    }
  }

  function generateCustomAnimationCode() {
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';
    const isAction = codeScope === 'action';
    const holdSec = (customStudio.holdDuration !== undefined ? customStudio.holdDuration : 0.5);
    const moveSec = (customStudio.moveDuration !== undefined ? customStudio.moveDuration : 0.6);
    const holdMs = Math.round(holdSec * 1000);
    const moveMs = Math.round(moveSec * 1000);

    if (isAction) {
      return generateActionAnimationCode(isU8g2, holdMs, moveMs);
    }

    let drawCalls = '';
    if (customStudio.objects.length > 0) {
      customStudio.objects.forEach((obj, idx) => {
        const kA = obj.kA;
        const kB = obj.kB;
        const idStr = idx + 1;

        if (obj.type === 'round_rect') {
          drawCalls += `  int x${idStr} = LERP(${kA.x}, ${kB.x}, t);
  int y${idStr} = LERP(${kA.y}, ${kB.y}, t);
  int w${idStr} = LERP(${kA.w}, ${kB.w}, t);
  int h${idStr} = LERP(${kA.h}, ${kB.h}, t);
  int r${idStr} = LERP(${kA.r}, ${kB.r}, t);
  ${isU8g2 ? `disp.drawRBox(x${idStr}, y${idStr}, w${idStr}, h${idStr}, r${idStr});` : `disp.fillRoundRect(x${idStr}, y${idStr}, w${idStr}, h${idStr}, r${idStr}, SSD1306_WHITE);`}
`;
        } else if (obj.type === 'circle') {
          drawCalls += `  int cx${idStr} = LERP(${kA.x}, ${kB.x}, t);
  int cy${idStr} = LERP(${kA.y}, ${kB.y}, t);
  int rad${idStr} = LERP(${Math.round(kA.w / 2)}, ${Math.round(kB.w / 2)}, t);
  ${isU8g2 ? `disp.drawDisc(cx${idStr} + rad${idStr}, cy${idStr} + rad${idStr}, rad${idStr});` : `disp.fillCircle(cx${idStr} + rad${idStr}, cy${idStr} + rad${idStr}, rad${idStr}, SSD1306_WHITE);`}
`;
        } else if (obj.type === 'line') {
          const x2A = kA.x2 !== undefined ? kA.x2 : (kA.x + (kA.w || 20));
          const y2A = kA.y2 !== undefined ? kA.y2 : (kA.y + (kA.h || 0));
          const x2B = kB.x2 !== undefined ? kB.x2 : (kB.x + (kB.w || 20));
          const y2B = kB.y2 !== undefined ? kB.y2 : (kB.y + (kB.h || 0));
          drawCalls += `  int x1_${idStr} = LERP(${kA.x}, ${kB.x}, t);
  int y1_${idStr} = LERP(${kA.y}, ${kB.y}, t);
  int x2_${idStr} = LERP(${x2A}, ${x2B}, t);
  int y2_${idStr} = LERP(${y2A}, ${y2B}, t);
  ${isU8g2 ? `disp.drawLine(x1_${idStr}, y1_${idStr}, x2_${idStr}, y2_${idStr});` : `disp.drawLine(x1_${idStr}, y1_${idStr}, x2_${idStr}, y2_${idStr}, SSD1306_WHITE);`}
`;
        } else if (obj.type === 'eyes') {
          drawCalls += `  int ex${idStr} = LERP(${kA.x}, ${kB.x}, t);
  int ey${idStr} = LERP(${kA.y}, ${kB.y}, t);
  int ew${idStr} = LERP(${kA.w}, ${kB.w}, t);
  int eh${idStr} = LERP(${kA.h}, ${kB.h}, t);
  int er${idStr} = LERP(${kA.r}, ${kB.r}, t);
  int sp${idStr} = LERP(${kA.spacing || 14}, ${kB.spacing || 14}, t);
  ${isU8g2
    ? `disp.drawRBox(ex${idStr}, ey${idStr}, ew${idStr}, eh${idStr}, er${idStr});\n  disp.drawRBox(ex${idStr} + ew${idStr} + sp${idStr}, ey${idStr}, ew${idStr}, eh${idStr}, er${idStr});`
    : `disp.fillRoundRect(ex${idStr}, ey${idStr}, ew${idStr}, eh${idStr}, er${idStr}, SSD1306_WHITE);\n  disp.fillRoundRect(ex${idStr} + ew${idStr} + sp${idStr}, ey${idStr}, ew${idStr}, eh${idStr}, er${idStr}, SSD1306_WHITE);`
  }
`;
        } else if (obj.type === 'text') {
          const textVal = kA.text || 'OLED';
          drawCalls += `  int tx${idStr} = LERP(${kA.x}, ${kB.x}, t);
  int ty${idStr} = LERP(${kA.y}, ${kB.y}, t);
  ${isU8g2
    ? `disp.drawStr(tx${idStr}, ty${idStr} + 12, "${textVal}");`
    : `disp.setTextSize(1);\n  disp.setTextColor(SSD1306_WHITE);\n  disp.setCursor(tx${idStr}, ty${idStr});\n  disp.print("${textVal}");`
  }
`;
        }
      });
    }

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Keyframe Motion Animation (Modular)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// Timing: Hold ${holdSec.toFixed(1)}s, Transition ${moveMs}ms
//
// Integration:
//   1. In setup(): 
//        Wire.setClock(400000);
//        display.ssd1306_command(SSD1306_SETDISPLAYCLOCKDIV);
//        display.ssd1306_command(0xF0);
//   2. In loop():  updateAndDrawAnimation(display);
// ==========================================================================

#ifndef CUSTOM_ANIMATION_H
#define CUSTOM_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define LERP(a, b, t) ((int)((a) + ((b) - (a)) * (t) + ((b) >= (a) ? 0.5f : -0.5f)))

const unsigned long HOLD_MS  = ${holdMs}UL;
const unsigned long MOVE_MS  = ${moveMs}UL;
const unsigned long CYCLE_MS = 2UL * (HOLD_MS + MOVE_MS);

inline float smoothstep(float u) {
  return u * u * (3.0f - 2.0f * u);
}

float getAnimationProgress() {
  unsigned long now = millis() % CYCLE_MS;
  if (now < HOLD_MS) {
    return 0.0f;
  } else if (now < HOLD_MS + MOVE_MS) {
    float u = (float)(now - HOLD_MS) / (float)MOVE_MS;
    return smoothstep(u);
  } else if (now < 2UL * HOLD_MS + MOVE_MS) {
    return 1.0f;
  } else {
    float u = (float)(now - (2UL * HOLD_MS + MOVE_MS)) / (float)MOVE_MS;
    return 1.0f - smoothstep(u);
  }
}

void drawCustomAnimation(Adafruit_SSD1306 &disp, float t) {
${drawCalls}}

void updateAndDrawAnimation(Adafruit_SSD1306 &disp) {
  float progress = getAnimationProgress();
  drawCustomAnimation(disp, progress);
}

#endif // CUSTOM_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Keyframe Motion Animation (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// Timing: Hold ${holdSec.toFixed(1)}s, Transition ${moveMs}ms
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

#define LERP(a, b, t) ((int)((a) + ((b) - (a)) * (t) + ((b) >= (a) ? 0.5f : -0.5f)))

const unsigned long HOLD_MS  = ${holdMs}UL;
const unsigned long MOVE_MS  = ${moveMs}UL;
const unsigned long CYCLE_MS = 2UL * (HOLD_MS + MOVE_MS);

inline float smoothstep(float u) {
  return u * u * (3.0f - 2.0f * u);
}

float getAnimationProgress() {
  unsigned long now = millis() % CYCLE_MS;
  if (now < HOLD_MS) {
    return 0.0f;
  } else if (now < HOLD_MS + MOVE_MS) {
    float u = (float)(now - HOLD_MS) / (float)MOVE_MS;
    return smoothstep(u);
  } else if (now < 2UL * HOLD_MS + MOVE_MS) {
    return 1.0f;
  } else {
    float u = (float)(now - (2UL * HOLD_MS + MOVE_MS)) / (float)MOVE_MS;
    return 1.0f - smoothstep(u);
  }
}

void drawCustomAnimation(Adafruit_SSD1306 &disp, float t) {
${drawCalls}}

void updateAndDrawAnimation(Adafruit_SSD1306 &disp) {
  float progress = getAnimationProgress();
  drawCustomAnimation(disp, progress);
}

void setup() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    for (;;);
  }
  Wire.setClock(400000);
  display.ssd1306_command(SSD1306_SETDISPLAYCLOCKDIV);
  display.ssd1306_command(0xF0);
}

void loop() {
  static unsigned long lastFrame = 0;
  unsigned long now = millis();
  if (now - lastFrame >= 20) {
    lastFrame = now;
    display.clearDisplay();
    updateAndDrawAnimation(display);
    display.display();
  }
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Keyframe Motion Animation (Modular)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (Hardware I2C)
// Timing: Hold ${holdSec.toFixed(1)}s, Transition ${moveMs}ms
//
// Integration:
//   1. In setup(): u8g2.setBusClock(400000);
//   2. In loop():  updateAndDrawAnimation(u8g2);
// ==========================================================================

#ifndef CUSTOM_ANIMATION_H
#define CUSTOM_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

#define LERP(a, b, t) ((int)((a) + ((b) - (a)) * (t) + ((b) >= (a) ? 0.5f : -0.5f)))

const unsigned long HOLD_MS  = ${holdMs}UL;
const unsigned long MOVE_MS  = ${moveMs}UL;
const unsigned long CYCLE_MS = 2UL * (HOLD_MS + MOVE_MS);

inline float smoothstep(float u) {
  return u * u * (3.0f - 2.0f * u);
}

float getAnimationProgress() {
  unsigned long now = millis() % CYCLE_MS;
  if (now < HOLD_MS) {
    return 0.0f;
  } else if (now < HOLD_MS + MOVE_MS) {
    float u = (float)(now - HOLD_MS) / (float)MOVE_MS;
    return smoothstep(u);
  } else if (now < 2UL * HOLD_MS + MOVE_MS) {
    return 1.0f;
  } else {
    float u = (float)(now - (2UL * HOLD_MS + MOVE_MS)) / (float)MOVE_MS;
    return 1.0f - smoothstep(u);
  }
}

void drawCustomAnimation(U8G2 &disp, float t) {
${drawCalls}}

void updateAndDrawAnimation(U8G2 &disp) {
  float progress = getAnimationProgress();
  drawCustomAnimation(disp, progress);
}

#endif // CUSTOM_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Keyframe Motion Animation (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (Hardware I2C)
// Timing: Hold ${holdSec.toFixed(1)}s, Transition ${moveMs}ms
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

#define LERP(a, b, t) ((int)((a) + ((b) - (a)) * (t) + ((b) >= (a) ? 0.5f : -0.5f)))

const unsigned long HOLD_MS  = ${holdMs}UL;
const unsigned long MOVE_MS  = ${moveMs}UL;
const unsigned long CYCLE_MS = 2UL * (HOLD_MS + MOVE_MS);

inline float smoothstep(float u) {
  return u * u * (3.0f - 2.0f * u);
}

float getAnimationProgress() {
  unsigned long now = millis() % CYCLE_MS;
  if (now < HOLD_MS) {
    return 0.0f;
  } else if (now < HOLD_MS + MOVE_MS) {
    float u = (float)(now - HOLD_MS) / (float)MOVE_MS;
    return smoothstep(u);
  } else if (now < 2UL * HOLD_MS + MOVE_MS) {
    return 1.0f;
  } else {
    float u = (float)(now - (2UL * HOLD_MS + MOVE_MS)) / (float)MOVE_MS;
    return 1.0f - smoothstep(u);
  }
}

void drawCustomAnimation(U8G2 &disp, float t) {
${drawCalls}}

void updateAndDrawAnimation(U8G2 &disp) {
  float progress = getAnimationProgress();
  drawCustomAnimation(disp, progress);
}

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
  u8g2.setFont(u8g2_font_6x10_tf);
}

void loop() {
  static unsigned long lastFrame = 0;
  unsigned long now = millis();
  if (now - lastFrame >= 20) {
    lastFrame = now;
    u8g2.clearBuffer();
    updateAndDrawAnimation(u8g2);
    u8g2.sendBuffer();
  }
}
`;
      }
    }
  }

  function generateActionAnimationCode(isU8g2, holdMs, moveMs) {
    const shapes = customStudio.objects;
    const numShapes = Math.max(1, shapes.length);

    const frameALines = [];
    const frameBLines = [];
    let drawCalls = '';

    if (shapes.length === 0) {
      frameALines.push('  { 28, 16, 28, 28, 6, 0, 0, 14 }');
      frameBLines.push('  { 72, 16, 28, 28, 6, 0, 0, 14 }');
      drawCalls = isU8g2 
        ? '  u8g2.drawRBox(current_shapes[0].x, current_shapes[0].y, current_shapes[0].w, current_shapes[0].h, current_shapes[0].r);\n'
        : '  display.fillRoundRect(current_shapes[0].x, current_shapes[0].y, current_shapes[0].w, current_shapes[0].h, current_shapes[0].r, SSD1306_WHITE);\n';
    } else {
      shapes.forEach((obj, idx) => {
        const kA = obj.kA;
        const kB = obj.kB;
        const x2A = kA.x2 !== undefined ? kA.x2 : (kA.x + (kA.w || 20));
        const y2A = kA.y2 !== undefined ? kA.y2 : (kA.y + (kA.h || 0));
        const x2B = kB.x2 !== undefined ? kB.x2 : (kB.x + (kB.w || 20));
        const y2B = kB.y2 !== undefined ? kB.y2 : (kB.y + (kB.h || 0));
        const spA = kA.spacing !== undefined ? kA.spacing : 14;
        const spB = kB.spacing !== undefined ? kB.spacing : 14;

        frameALines.push(`  { ${kA.x}, ${kA.y}, ${kA.w || 0}, ${kA.h || 0}, ${kA.r || 0}, ${x2A}, ${y2A}, ${spA} }`);
        frameBLines.push(`  { ${kB.x}, ${kB.y}, ${kB.w || 0}, ${kB.h || 0}, ${kB.r || 0}, ${x2B}, ${y2B}, ${spB} }`);

        if (obj.type === 'round_rect') {
          drawCalls += isU8g2
            ? `  u8g2.drawRBox(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r);\n`
            : `  display.fillRoundRect(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r, SSD1306_WHITE);\n`;
        } else if (obj.type === 'circle') {
          drawCalls += isU8g2
            ? `  u8g2.drawDisc(current_shapes[${idx}].x + current_shapes[${idx}].w / 2, current_shapes[${idx}].y + current_shapes[${idx}].w / 2, current_shapes[${idx}].w / 2);\n`
            : `  display.fillCircle(current_shapes[${idx}].x + current_shapes[${idx}].w / 2, current_shapes[${idx}].y + current_shapes[${idx}].w / 2, current_shapes[${idx}].w / 2, SSD1306_WHITE);\n`;
        } else if (obj.type === 'line') {
          drawCalls += isU8g2
            ? `  u8g2.drawLine(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].x2, current_shapes[${idx}].y2);\n`
            : `  display.drawLine(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].x2, current_shapes[${idx}].y2, SSD1306_WHITE);\n`;
        } else if (obj.type === 'eyes') {
          drawCalls += isU8g2
            ? `  u8g2.drawRBox(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r);\n  u8g2.drawRBox(current_shapes[${idx}].x + current_shapes[${idx}].w + current_shapes[${idx}].spacing, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r);\n`
            : `  display.fillRoundRect(current_shapes[${idx}].x, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r, SSD1306_WHITE);\n  display.fillRoundRect(current_shapes[${idx}].x + current_shapes[${idx}].w + current_shapes[${idx}].spacing, current_shapes[${idx}].y, current_shapes[${idx}].w, current_shapes[${idx}].h, current_shapes[${idx}].r, SSD1306_WHITE);\n`;
        } else if (obj.type === 'text') {
          const txt = kA.text || 'OLED';
          drawCalls += isU8g2
            ? `  u8g2.drawStr(current_shapes[${idx}].x, current_shapes[${idx}].y + 12, "${txt}");\n`
            : `  display.setTextSize(1);\n  display.setTextColor(SSD1306_WHITE);\n  display.setCursor(current_shapes[${idx}].x, current_shapes[${idx}].y);\n  display.print("${txt}");\n`;
        }
      });
    }

    const steps = 18;
    const stepDelay = Math.max(8, Math.round(moveMs / steps));

    if (!isU8g2) {
      return `// ==========================================================================
// OLED Studio - Action / Function-Based Animation Engine
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
//
// Usage:
//   - move_to_end();       // Animate shapes from Keyframe A to Keyframe B
//   - move_to_start();     // Animate shapes back to Keyframe A
//   - play_cycle(${holdMs});     // Animate A -> B -> A with hold pause
//   - launch_animation(i); // Trigger by Enum (RESET, MOVE_TO_END, MOVE_TO_START, CYCLE)
//   - Serial Command:      Send "A1" for MOVE_TO_END, "A2" for MOVE_TO_START, "A3" for CYCLE
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

struct AnimShape {
  int x, y, w, h, r;
  int x2, y2;
  int spacing;
};

const int NUM_SHAPES = ${numShapes};
const AnimShape FRAME_A[NUM_SHAPES] = {
${frameALines.join(',\n')}
};
const AnimShape FRAME_B[NUM_SHAPES] = {
${frameBLines.join(',\n')}
};

AnimShape current_shapes[NUM_SHAPES];

enum Animation {
  RESET,
  MOVE_TO_END,
  MOVE_TO_START,
  CYCLE,
  MAX_ANIMATIONS
};

void draw_frame() {
  display.clearDisplay();
${drawCalls}  display.display();
}

void reset_to_start() {
  for (int i = 0; i < NUM_SHAPES; i++) current_shapes[i] = FRAME_A[i];
  draw_frame();
}

void reset_to_end() {
  for (int i = 0; i < NUM_SHAPES; i++) current_shapes[i] = FRAME_B[i];
  draw_frame();
}

void transition_to(const AnimShape target[NUM_SHAPES], int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  AnimShape start[NUM_SHAPES];
  for (int i = 0; i < NUM_SHAPES; i++) start[i] = current_shapes[i];

  for (int step = 1; step <= steps; step++) {
    float u = (float)step / (float)steps;
    float t = u * u * (3.0f - 2.0f * u);
    for (int i = 0; i < NUM_SHAPES; i++) {
      current_shapes[i].x = (int)(start[i].x + (target[i].x - start[i].x) * t + 0.5f);
      current_shapes[i].y = (int)(start[i].y + (target[i].y - start[i].y) * t + 0.5f);
      current_shapes[i].w = (int)(start[i].w + (target[i].w - start[i].w) * t + 0.5f);
      current_shapes[i].h = (int)(start[i].h + (target[i].h - start[i].h) * t + 0.5f);
      current_shapes[i].r = (int)(start[i].r + (target[i].r - start[i].r) * t + 0.5f);
      current_shapes[i].x2 = (int)(start[i].x2 + (target[i].x2 - start[i].x2) * t + 0.5f);
      current_shapes[i].y2 = (int)(start[i].y2 + (target[i].y2 - start[i].y2) * t + 0.5f);
      current_shapes[i].spacing = (int)(start[i].spacing + (target[i].spacing - start[i].spacing) * t + 0.5f);
    }
    draw_frame();
    delay(step_delay_ms);
  }
}

void move_to_end(int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  transition_to(FRAME_B, steps, step_delay_ms);
}

void move_to_start(int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  transition_to(FRAME_A, steps, step_delay_ms);
}

void play_cycle(int hold_ms = ${holdMs}, int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  move_to_end(steps, step_delay_ms);
  delay(hold_ms);
  move_to_start(steps, step_delay_ms);
}

void launch_animation(int anim_index) {
  switch (anim_index) {
    case RESET:         reset_to_start(); break;
    case MOVE_TO_END:   move_to_end(); break;
    case MOVE_TO_START: move_to_start(); break;
    case CYCLE:         play_cycle(); break;
    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    for (;;);
  }
  Wire.setClock(400000);
  display.ssd1306_command(SSD1306_SETDISPLAYCLOCKDIV);
  display.ssd1306_command(0xF0);

  reset_to_start();
  Serial.println("READY");
}

void loop() {
  if (Serial.available() > 0) {
    char firstChar = Serial.peek();
    if (firstChar == 'A' || firstChar == 'a') {
      Serial.read();
      int anim_id = Serial.parseInt();
      if (anim_id < MAX_ANIMATIONS) {
        launch_animation(anim_id);
      }
    } else {
      Serial.read();
    }
  }
}
`;
    } else {
      return `// ==========================================================================
// OLED Studio - Action / Function-Based Animation Engine
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (Hardware I2C)
//
// Usage:
//   - move_to_end();       // Animate shapes from Keyframe A to Keyframe B
//   - move_to_start();     // Animate shapes back to Keyframe A
//   - play_cycle(${holdMs});     // Animate A -> B -> A with hold pause
//   - launch_animation(i); // Trigger by Enum (RESET, MOVE_TO_END, MOVE_TO_START, CYCLE)
//   - Serial Command:      Send "A1" for MOVE_TO_END, "A2" for MOVE_TO_START, "A3" for CYCLE
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

struct AnimShape {
  int x, y, w, h, r;
  int x2, y2;
  int spacing;
};

const int NUM_SHAPES = ${numShapes};
const AnimShape FRAME_A[NUM_SHAPES] = {
${frameALines.join(',\n')}
};
const AnimShape FRAME_B[NUM_SHAPES] = {
${frameBLines.join(',\n')}
};

AnimShape current_shapes[NUM_SHAPES];

enum Animation {
  RESET,
  MOVE_TO_END,
  MOVE_TO_START,
  CYCLE,
  MAX_ANIMATIONS
};

void draw_frame() {
  u8g2.clearBuffer();
${drawCalls}  u8g2.sendBuffer();
}

void reset_to_start() {
  for (int i = 0; i < NUM_SHAPES; i++) current_shapes[i] = FRAME_A[i];
  draw_frame();
}

void reset_to_end() {
  for (int i = 0; i < NUM_SHAPES; i++) current_shapes[i] = FRAME_B[i];
  draw_frame();
}

void transition_to(const AnimShape target[NUM_SHAPES], int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  AnimShape start[NUM_SHAPES];
  for (int i = 0; i < NUM_SHAPES; i++) start[i] = current_shapes[i];

  for (int step = 1; step <= steps; step++) {
    float u = (float)step / (float)steps;
    float t = u * u * (3.0f - 2.0f * u);
    for (int i = 0; i < NUM_SHAPES; i++) {
      current_shapes[i].x = (int)(start[i].x + (target[i].x - start[i].x) * t + 0.5f);
      current_shapes[i].y = (int)(start[i].y + (target[i].y - start[i].y) * t + 0.5f);
      current_shapes[i].w = (int)(start[i].w + (target[i].w - start[i].w) * t + 0.5f);
      current_shapes[i].h = (int)(start[i].h + (target[i].h - start[i].h) * t + 0.5f);
      current_shapes[i].r = (int)(start[i].r + (target[i].r - start[i].r) * t + 0.5f);
      current_shapes[i].x2 = (int)(start[i].x2 + (target[i].x2 - start[i].x2) * t + 0.5f);
      current_shapes[i].y2 = (int)(start[i].y2 + (target[i].y2 - start[i].y2) * t + 0.5f);
      current_shapes[i].spacing = (int)(start[i].spacing + (target[i].spacing - start[i].spacing) * t + 0.5f);
    }
    draw_frame();
    delay(step_delay_ms);
  }
}

void move_to_end(int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  transition_to(FRAME_B, steps, step_delay_ms);
}

void move_to_start(int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  transition_to(FRAME_A, steps, step_delay_ms);
}

void play_cycle(int hold_ms = ${holdMs}, int steps = ${steps}, int step_delay_ms = ${stepDelay}) {
  move_to_end(steps, step_delay_ms);
  delay(hold_ms);
  move_to_start(steps, step_delay_ms);
}

void launch_animation(int anim_index) {
  switch (anim_index) {
    case RESET:         reset_to_start(); break;
    case MOVE_TO_END:   move_to_end(); break;
    case MOVE_TO_START: move_to_start(); break;
    case CYCLE:         play_cycle(); break;
    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  u8g2.begin();
  u8g2.setBusClock(400000);
  u8g2.setFont(u8g2_font_6x10_tf);

  reset_to_start();
  Serial.println("READY");
}

void loop() {
  if (Serial.available() > 0) {
    char firstChar = Serial.peek();
    if (firstChar == 'A' || firstChar == 'a') {
      Serial.read();
      int anim_id = Serial.parseInt();
      if (anim_id < MAX_ANIMATIONS) {
        launch_animation(anim_id);
      }
    } else {
      Serial.read();
    }
  }
}
`;
    }
  }

  function generateRobotEyesCode() {
    const p = params.robot_eyes;
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Robot Eyes (Modular Header)
// Library: Adafruit SSD1306 (Wire I2C)
//
// Integration:
//   1. In setup(): robotEyes.begin(); Wire.setClock(400000);
//   2. In loop():  robotEyes.update(); robotEyes.draw(display);
// ==========================================================================

#ifndef ROBOT_EYES_ANIMATION_H
#define ROBOT_EYES_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

class RobotEyesController {
public:
  const int eyeW = ${p.eyeWidth};
  const int eyeH = ${p.eyeHeight};
  const int eyeSpace = ${p.eyeSpace};
  const int cornerR = ${p.cornerRadius};

  int posX, posY;
  int currentH;
  bool isBlinking;
  unsigned long lastActionTime;
  unsigned long blinkStartTime;

  void begin(int screenW = 128, int screenH = 64) {
    posX = (screenW - (eyeW * 2 + eyeSpace)) / 2;
    posY = (screenH - eyeH) / 2;
    currentH = eyeH;
    isBlinking = false;
    lastActionTime = millis();
  }

  void update() {
    unsigned long now = millis();
    if (!isBlinking && (now - lastActionTime > 2600)) {
      isBlinking = true;
      blinkStartTime = now;
      lastActionTime = now;
    }
    if (isBlinking) {
      unsigned long elapsed = now - blinkStartTime;
      const unsigned long BLINK_DUR = 200;
      if (elapsed >= BLINK_DUR) {
        isBlinking = false;
        currentH = eyeH;
      } else {
        float progress = (float)elapsed / BLINK_DUR;
        float squash = 4.0f * progress * (1.0f - progress);
        currentH = max(2, (int)(eyeH * (1.0 - squash * 0.94)));
      }
    }
  }

  void draw(Adafruit_SSD1306 &disp) {
    int eyeY = posY + (eyeH - currentH) / 2;
    int safeR = min(cornerR, currentH / 2);
    disp.fillRoundRect(posX, eyeY, eyeW, currentH, safeR, SSD1306_WHITE);
    disp.fillRoundRect(posX + eyeW + eyeSpace, eyeY, eyeW, currentH, safeR, SSD1306_WHITE);
  }
};

RobotEyesController robotEyes;

#endif // ROBOT_EYES_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Robot Eyes (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

class RobotEyesController {
public:
  const int eyeW = ${p.eyeWidth};
  const int eyeH = ${p.eyeHeight};
  const int eyeSpace = ${p.eyeSpace};
  const int cornerR = ${p.cornerRadius};

  int posX, posY;
  int currentH;
  bool isBlinking;
  unsigned long lastActionTime;
  unsigned long blinkStartTime;

  void begin() {
    posX = (SCREEN_WIDTH - (eyeW * 2 + eyeSpace)) / 2;
    posY = (SCREEN_HEIGHT - eyeH) / 2;
    currentH = eyeH;
    isBlinking = false;
    lastActionTime = millis();
  }

  void update() {
    unsigned long now = millis();
    if (!isBlinking && (now - lastActionTime > 2600)) {
      isBlinking = true;
      blinkStartTime = now;
      lastActionTime = now;
    }
    if (isBlinking) {
      unsigned long elapsed = now - blinkStartTime;
      const unsigned long BLINK_DUR = 200;
      if (elapsed >= BLINK_DUR) {
        isBlinking = false;
        currentH = eyeH;
      } else {
        float progress = (float)elapsed / BLINK_DUR;
        float squash = 4.0f * progress * (1.0f - progress);
        currentH = max(2, (int)(eyeH * (1.0 - squash * 0.94)));
      }
    }
  }

  void draw(Adafruit_SSD1306 &disp) {
    int eyeY = posY + (eyeH - currentH) / 2;
    int safeR = min(cornerR, currentH / 2);
    disp.fillRoundRect(posX, eyeY, eyeW, currentH, safeR, SSD1306_WHITE);
    disp.fillRoundRect(posX + eyeW + eyeSpace, eyeY, eyeW, currentH, safeR, SSD1306_WHITE);
  }
};

RobotEyesController robotEyes;

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Wire.setClock(400000);
  robotEyes.begin();
}

void loop() {
  robotEyes.update();

  display.clearDisplay();
  robotEyes.draw(display);
  display.display();
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Robot Eyes (Modular Header)
// Library: U8g2 (HW I2C)
//
// Integration:
//   1. In setup(): robotEyes.begin(); u8g2.setBusClock(400000);
//   2. In loop():  robotEyes.update(); robotEyes.draw(u8g2);
// ==========================================================================

#ifndef ROBOT_EYES_ANIMATION_H
#define ROBOT_EYES_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

class RobotEyesController {
public:
  const int eyeW = ${p.eyeWidth};
  const int eyeH = ${p.eyeHeight};
  const int eyeSpace = ${p.eyeSpace};
  const int cornerR = ${p.cornerRadius};

  int posX, posY;
  int currentH;
  bool isBlinking;
  unsigned long lastActionTime;
  unsigned long blinkStartTime;

  void begin(int screenW = 128, int screenH = 64) {
    posX = (screenW - (eyeW * 2 + eyeSpace)) / 2;
    posY = (screenH - eyeH) / 2;
    currentH = eyeH;
    isBlinking = false;
    lastActionTime = millis();
  }

  void update() {
    unsigned long now = millis();
    if (!isBlinking && (now - lastActionTime > 2600)) {
      isBlinking = true;
      blinkStartTime = now;
      lastActionTime = now;
    }
    if (isBlinking) {
      unsigned long elapsed = now - blinkStartTime;
      const unsigned long BLINK_DUR = 200;
      if (elapsed >= BLINK_DUR) {
        isBlinking = false;
        currentH = eyeH;
      } else {
        float progress = (float)elapsed / BLINK_DUR;
        float squash = 4.0f * progress * (1.0f - progress);
        currentH = max(2, (int)(eyeH * (1.0 - squash * 0.94)));
      }
    }
  }

  void draw(U8G2 &disp) {
    int eyeY = posY + (eyeH - currentH) / 2;
    int safeR = min(cornerR, currentH / 2);
    disp.drawRBox(posX, eyeY, eyeW, currentH, safeR);
    disp.drawRBox(posX + eyeW + eyeSpace, eyeY, eyeW, currentH, safeR);
  }
};

RobotEyesController robotEyes;

#endif // ROBOT_EYES_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Robot Eyes (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (HW I2C)
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

class RobotEyesController {
public:
  const int eyeW = ${p.eyeWidth};
  const int eyeH = ${p.eyeHeight};
  const int eyeSpace = ${p.eyeSpace};
  const int cornerR = ${p.cornerRadius};

  int posX, posY;
  int currentH;
  bool isBlinking;
  unsigned long lastActionTime;
  unsigned long blinkStartTime;

  void begin() {
    posX = (128 - (eyeW * 2 + eyeSpace)) / 2;
    posY = (64 - eyeH) / 2;
    currentH = eyeH;
    isBlinking = false;
    lastActionTime = millis();
  }

  void update() {
    unsigned long now = millis();
    if (!isBlinking && (now - lastActionTime > 2600)) {
      isBlinking = true;
      blinkStartTime = now;
      lastActionTime = now;
    }
    if (isBlinking) {
      unsigned long elapsed = now - blinkStartTime;
      const unsigned long BLINK_DUR = 200;
      if (elapsed >= BLINK_DUR) {
        isBlinking = false;
        currentH = eyeH;
      } else {
        float progress = (float)elapsed / BLINK_DUR;
        float squash = 4.0f * progress * (1.0f - progress);
        currentH = max(2, (int)(eyeH * (1.0 - squash * 0.94)));
      }
    }
  }

  void draw(U8G2 &disp) {
    int eyeY = posY + (eyeH - currentH) / 2;
    int safeR = min(cornerR, currentH / 2);
    disp.drawRBox(posX, eyeY, eyeW, currentH, safeR);
    disp.drawRBox(posX + eyeW + eyeSpace, eyeY, eyeW, currentH, safeR);
  }
};

RobotEyesController robotEyes;

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
  robotEyes.begin();
}

void loop() {
  robotEyes.update();

  u8g2.clearBuffer();
  robotEyes.draw(u8g2);
  u8g2.sendBuffer();
}
`;
      }
    }
  }

  function generateRadarScanCode() {
    const p = params.radar_scan;
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Radar Scanner (Modular Header)
// Library: Adafruit SSD1306 (Wire I2C)
//
// Integration:
//   1. Call updateAndDrawRadar(display); in your render loop.
// ==========================================================================

#ifndef RADAR_SCAN_ANIMATION_H
#define RADAR_SCAN_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int RADAR_X = 64;
const int RADAR_Y = 32;
const int RADAR_RADIUS = ${p.radius};
const float SWEEP_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float radarSweepAngle = 0.0;

void drawRadar(Adafruit_SSD1306 &disp, float angle) {
  disp.drawCircle(RADAR_X, RADAR_Y, RADAR_RADIUS, SSD1306_WHITE);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.6), SSD1306_WHITE);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.25), SSD1306_WHITE);

  int sweepX = RADAR_X + (int)(cos(angle) * RADAR_RADIUS);
  int sweepY = RADAR_Y + (int)(sin(angle) * RADAR_RADIUS);
  disp.drawLine(RADAR_X, RADAR_Y, sweepX, sweepY, SSD1306_WHITE);
}

void updateAndDrawRadar(Adafruit_SSD1306 &disp) {
  radarSweepAngle += SWEEP_SPEED;
  if (radarSweepAngle >= 6.2831853f) radarSweepAngle -= 6.2831853f;
  drawRadar(disp, radarSweepAngle);
}

#endif // RADAR_SCAN_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Radar Scanner (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

const int RADAR_X = 64;
const int RADAR_Y = 32;
const int RADAR_RADIUS = ${p.radius};
const float SWEEP_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float sweepAngle = 0.0;

void drawRadar(Adafruit_SSD1306 &disp, float angle) {
  disp.drawCircle(RADAR_X, RADAR_Y, RADAR_RADIUS, SSD1306_WHITE);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.6), SSD1306_WHITE);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.25), SSD1306_WHITE);

  int sweepX = RADAR_X + (int)(cos(angle) * RADAR_RADIUS);
  int sweepY = RADAR_Y + (int)(sin(angle) * RADAR_RADIUS);
  disp.drawLine(RADAR_X, RADAR_Y, sweepX, sweepY, SSD1306_WHITE);
}

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Wire.setClock(400000);
}

void loop() {
  sweepAngle += SWEEP_SPEED;
  if (sweepAngle >= 6.2831853f) sweepAngle -= 6.2831853f;

  display.clearDisplay();
  drawRadar(display, sweepAngle);
  display.display();
  delay(15);
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Radar Scanner (Modular Header)
// Library: U8g2 (HW I2C)
//
// Integration:
//   1. Call updateAndDrawRadar(u8g2); in your render loop.
// ==========================================================================

#ifndef RADAR_SCAN_ANIMATION_H
#define RADAR_SCAN_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

const int RADAR_X = 64;
const int RADAR_Y = 32;
const int RADAR_RADIUS = ${p.radius};
const float SWEEP_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float radarSweepAngle = 0.0;

void drawRadar(U8G2 &disp, float angle) {
  disp.drawCircle(RADAR_X, RADAR_Y, RADAR_RADIUS);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.6));
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.25));

  int sweepX = RADAR_X + (int)(cos(angle) * RADAR_RADIUS);
  int sweepY = RADAR_Y + (int)(sin(angle) * RADAR_RADIUS);
  disp.drawLine(RADAR_X, RADAR_Y, sweepX, sweepY);
}

void updateAndDrawRadar(U8G2 &disp) {
  radarSweepAngle += SWEEP_SPEED;
  if (radarSweepAngle >= 6.2831853f) radarSweepAngle -= 6.2831853f;
  drawRadar(disp, radarSweepAngle);
}

#endif // RADAR_SCAN_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Radar Scanner (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (HW I2C)
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

const int RADAR_X = 64;
const int RADAR_Y = 32;
const int RADAR_RADIUS = ${p.radius};
const float SWEEP_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float sweepAngle = 0.0;

void drawRadar(U8G2 &disp, float angle) {
  disp.drawCircle(RADAR_X, RADAR_Y, RADAR_RADIUS);
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.6));
  disp.drawCircle(RADAR_X, RADAR_Y, (int)(RADAR_RADIUS * 0.25));

  int sweepX = RADAR_X + (int)(cos(angle) * RADAR_RADIUS);
  int sweepY = RADAR_Y + (int)(sin(angle) * RADAR_RADIUS);
  disp.drawLine(RADAR_X, RADAR_Y, sweepX, sweepY);
}

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
}

void loop() {
  sweepAngle += SWEEP_SPEED;
  if (sweepAngle >= 6.2831853f) sweepAngle -= 6.2831853f;

  u8g2.clearBuffer();
  drawRadar(u8g2, sweepAngle);
  u8g2.sendBuffer();
  delay(15);
}
`;
      }
    }
  }

  function generateSineWaveCode() {
    const p = params.sine_wave;
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Sine Wave (Modular Header)
// Library: Adafruit SSD1306 (Wire I2C)
//
// Integration:
//   1. Call updateAndDrawSineWave(display); in your render loop.
// ==========================================================================

#ifndef SINE_WAVE_ANIMATION_H
#define SINE_WAVE_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int SINE_AMPLITUDE   = ${p.amplitude};
const float SINE_FREQUENCY = ${(p.frequency * 0.05).toFixed(3)}f;
const float SINE_SPEED     = ${(p.speed * 0.04).toFixed(3)}f;

float sinePhaseOffset = 0.0;

void drawSineWave(Adafruit_SSD1306 &disp, float phase) {
  int prevY = 32 + (int)(sin(phase) * SINE_AMPLITUDE);
  for (int x = 1; x < 128; x++) {
    int y = 32 + (int)(sin((x * SINE_FREQUENCY) + phase) * SINE_AMPLITUDE);
    disp.drawLine(x - 1, prevY, x, y, SSD1306_WHITE);
    prevY = y;
  }
}

void updateAndDrawSineWave(Adafruit_SSD1306 &disp) {
  sinePhaseOffset += SINE_SPEED;
  drawSineWave(disp, sinePhaseOffset);
}

#endif // SINE_WAVE_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Sine Wave (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

const int AMPLITUDE   = ${p.amplitude};
const float FREQUENCY = ${(p.frequency * 0.05).toFixed(3)}f;
const float WAVE_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float phaseOffset = 0.0;

void drawSineWave(Adafruit_SSD1306 &disp, float phase) {
  int prevY = 32 + (int)(sin(phase) * AMPLITUDE);
  for (int x = 1; x < 128; x++) {
    int y = 32 + (int)(sin((x * FREQUENCY) + phase) * AMPLITUDE);
    disp.drawLine(x - 1, prevY, x, y, SSD1306_WHITE);
    prevY = y;
  }
}

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Wire.setClock(400000);
}

void loop() {
  phaseOffset += WAVE_SPEED;

  display.clearDisplay();
  drawSineWave(display, phaseOffset);
  display.display();
  delay(15);
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Procedural Sine Wave (Modular Header)
// Library: U8g2 (HW I2C)
//
// Integration:
//   1. Call updateAndDrawSineWave(u8g2); in your render loop.
// ==========================================================================

#ifndef SINE_WAVE_ANIMATION_H
#define SINE_WAVE_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

const int SINE_AMPLITUDE   = ${p.amplitude};
const float SINE_FREQUENCY = ${(p.frequency * 0.05).toFixed(3)}f;
const float SINE_SPEED     = ${(p.speed * 0.04).toFixed(3)}f;

float sinePhaseOffset = 0.0;

void drawSineWave(U8G2 &disp, float phase) {
  int prevY = 32 + (int)(sin(phase) * SINE_AMPLITUDE);
  for (int x = 1; x < 128; x++) {
    int y = 32 + (int)(sin((x * SINE_FREQUENCY) + phase) * SINE_AMPLITUDE);
    disp.drawLine(x - 1, prevY, x, y);
    prevY = y;
  }
}

void updateAndDrawSineWave(U8G2 &disp) {
  sinePhaseOffset += SINE_SPEED;
  drawSineWave(disp, sinePhaseOffset);
}

#endif // SINE_WAVE_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Procedural Sine Wave (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (HW I2C)
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

const int AMPLITUDE   = ${p.amplitude};
const float FREQUENCY = ${(p.frequency * 0.05).toFixed(3)}f;
const float WAVE_SPEED = ${(p.speed * 0.04).toFixed(3)}f;

float phaseOffset = 0.0;

void drawSineWave(U8G2 &disp, float phase) {
  int prevY = 32 + (int)(sin(phase) * AMPLITUDE);
  for (int x = 1; x < 128; x++) {
    int y = 32 + (int)(sin((x * FREQUENCY) + phase) * AMPLITUDE);
    disp.drawLine(x - 1, prevY, x, y);
    prevY = y;
  }
}

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
}

void loop() {
  phaseOffset += WAVE_SPEED;

  u8g2.clearBuffer();
  drawSineWave(u8g2, phaseOffset);
  u8g2.sendBuffer();
  delay(15);
}
`;
      }
    }
  }

  function generateStarfieldCode() {
    const p = params.starfield;
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';
    const starCount = Math.min(36, p.count);

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - 3D Warp Starfield (Modular Header)
// Library: Adafruit SSD1306 (Wire I2C)
//
// Integration:
//   1. In setup(): starfield.begin();
//   2. In loop():  starfield.updateAndDraw(display);
// ==========================================================================

#ifndef STARFIELD_ANIMATION_H
#define STARFIELD_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

struct Star { int8_t x, y; uint8_t z; };

class StarfieldController {
public:
  static const uint8_t NUM_STARS = ${starCount};
  Star stars[NUM_STARS];

  void begin() {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].x = random(-60, 60);
      stars[i].y = random(-40, 40);
      stars[i].z = random(20, 100);
    }
  }

  void updateAndDraw(Adafruit_SSD1306 &disp) {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].z -= ${p.speed};
      if (stars[i].z <= 4) stars[i].z = 100;
      int sx = 64 + ((int)stars[i].x * 32) / stars[i].z;
      int sy = 32 + ((int)stars[i].y * 32) / stars[i].z;
      if (sx >= 0 && sx < 128 && sy >= 0 && sy < 64) {
        disp.drawPixel(sx, sy, SSD1306_WHITE);
      }
    }
  }
};

StarfieldController starfield;

#endif // STARFIELD_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - 3D Warp Starfield (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

struct Star { int8_t x, y; uint8_t z; };

class StarfieldController {
public:
  static const uint8_t NUM_STARS = ${starCount};
  Star stars[NUM_STARS];

  void begin() {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].x = random(-60, 60);
      stars[i].y = random(-40, 40);
      stars[i].z = random(20, 100);
    }
  }

  void updateAndDraw(Adafruit_SSD1306 &disp) {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].z -= ${p.speed};
      if (stars[i].z <= 4) stars[i].z = 100;
      int sx = 64 + ((int)stars[i].x * 32) / stars[i].z;
      int sy = 32 + ((int)stars[i].y * 32) / stars[i].z;
      if (sx >= 0 && sx < 128 && sy >= 0 && sy < 64) {
        disp.drawPixel(sx, sy, SSD1306_WHITE);
      }
    }
  }
};

StarfieldController starfield;

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Wire.setClock(400000);
  starfield.begin();
}

void loop() {
  display.clearDisplay();
  starfield.updateAndDraw(display);
  display.display();
  delay(15);
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - 3D Warp Starfield (Modular Header)
// Library: U8g2 (HW I2C)
//
// Integration:
//   1. In setup(): starfield.begin();
//   2. In loop():  starfield.updateAndDraw(u8g2);
// ==========================================================================

#ifndef STARFIELD_ANIMATION_H
#define STARFIELD_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

struct Star { int8_t x, y; uint8_t z; };

class StarfieldController {
public:
  static const uint8_t NUM_STARS = ${starCount};
  Star stars[NUM_STARS];

  void begin() {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].x = random(-60, 60);
      stars[i].y = random(-40, 40);
      stars[i].z = random(20, 100);
    }
  }

  void updateAndDraw(U8G2 &disp) {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].z -= ${p.speed};
      if (stars[i].z <= 4) stars[i].z = 100;
      int sx = 64 + ((int)stars[i].x * 32) / stars[i].z;
      int sy = 32 + ((int)stars[i].y * 32) / stars[i].z;
      if (sx >= 0 && sx < 128 && sy >= 0 && sy < 64) {
        disp.drawPixel(sx, sy);
      }
    }
  }
};

StarfieldController starfield;

#endif // STARFIELD_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - 3D Warp Starfield (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (HW I2C)
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

struct Star { int8_t x, y; uint8_t z; };

class StarfieldController {
public:
  static const uint8_t NUM_STARS = ${starCount};
  Star stars[NUM_STARS];

  void begin() {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].x = random(-60, 60);
      stars[i].y = random(-40, 40);
      stars[i].z = random(20, 100);
    }
  }

  void updateAndDraw(U8G2 &disp) {
    for (uint8_t i = 0; i < NUM_STARS; i++) {
      stars[i].z -= ${p.speed};
      if (stars[i].z <= 4) stars[i].z = 100;
      int sx = 64 + ((int)stars[i].x * 32) / stars[i].z;
      int sy = 32 + ((int)stars[i].y * 32) / stars[i].z;
      if (sx >= 0 && sx < 128 && sy >= 0 && sy < 64) {
        disp.drawPixel(sx, sy);
      }
    }
  }
};

StarfieldController starfield;

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
  starfield.begin();
}

void loop() {
  u8g2.clearBuffer();
  starfield.updateAndDraw(u8g2);
  u8g2.sendBuffer();
  delay(15);
}
`;
      }
    }
  }

  function generateProgressBarCode() {
    const p = params.progress_bar;
    const isU8g2 = codeLibrary === 'u8g2';
    const isModular = codeScope === 'modular';

    if (!isU8g2) {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Animated Progress Bar (Modular Header)
// Library: Adafruit SSD1306 (Wire I2C)
//
// Integration:
//   1. Call drawProgressBar(display, percent); in your render loop (0-100).
// ==========================================================================

#ifndef PROGRESS_BAR_ANIMATION_H
#define PROGRESS_BAR_ANIMATION_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int PROGRESS_BAR_X = ${(128 - p.width) / 2};
const int PROGRESS_BAR_Y = 24;
const int PROGRESS_BAR_W = ${p.width};
const int PROGRESS_BAR_H = ${p.height};

void drawProgressBar(Adafruit_SSD1306 &disp, int progress) {
  disp.drawRoundRect(PROGRESS_BAR_X, PROGRESS_BAR_Y, PROGRESS_BAR_W, PROGRESS_BAR_H, 3, SSD1306_WHITE);
  int fillW = map(constrain(progress, 0, 100), 0, 100, 0, PROGRESS_BAR_W - 4);
  if (fillW > 0) {
    disp.fillRoundRect(PROGRESS_BAR_X + 2, PROGRESS_BAR_Y + 2, fillW, PROGRESS_BAR_H - 4, 2, SSD1306_WHITE);
  }
}

#endif // PROGRESS_BAR_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Animated Progress Bar (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: Adafruit SSD1306 (Wire I2C)
// ==========================================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

const int BAR_X = ${(128 - p.width) / 2};
const int BAR_Y = 24;
const int BAR_W = ${p.width};
const int BAR_H = ${p.height};

int currentProgress = 0;

void drawProgressBar(Adafruit_SSD1306 &disp, int progress) {
  disp.drawRoundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 3, SSD1306_WHITE);
  int fillW = map(constrain(progress, 0, 100), 0, 100, 0, BAR_W - 4);
  if (fillW > 0) {
    disp.fillRoundRect(BAR_X + 2, BAR_Y + 2, fillW, BAR_H - 4, 2, SSD1306_WHITE);
  }
}

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Wire.setClock(400000);
}

void loop() {
  display.clearDisplay();
  drawProgressBar(display, currentProgress);
  display.display();

  currentProgress = (currentProgress + 1) % 101;
  delay(30);
}
`;
      }
    } else {
      if (isModular) {
        return `// ==========================================================================
// OLED Studio - Animated Progress Bar (Modular Header)
// Library: U8g2 (HW I2C)
//
// Integration:
//   1. Call drawProgressBar(u8g2, percent); in your render loop (0-100).
// ==========================================================================

#ifndef PROGRESS_BAR_ANIMATION_H
#define PROGRESS_BAR_ANIMATION_H

#include <Arduino.h>
#include <U8g2lib.h>

const int PROGRESS_BAR_X = ${(128 - p.width) / 2};
const int PROGRESS_BAR_Y = 24;
const int PROGRESS_BAR_W = ${p.width};
const int PROGRESS_BAR_H = ${p.height};

void drawProgressBar(U8G2 &disp, int progress) {
  disp.drawRFrame(PROGRESS_BAR_X, PROGRESS_BAR_Y, PROGRESS_BAR_W, PROGRESS_BAR_H, 3);
  int fillW = map(constrain(progress, 0, 100), 0, 100, 0, BAR_W - 4);
  if (fillW > 0) {
    disp.drawRBox(PROGRESS_BAR_X + 2, PROGRESS_BAR_Y + 2, fillW, PROGRESS_BAR_H - 4, 2);
  }
}

#endif // PROGRESS_BAR_ANIMATION_H
`;
      } else {
        return `// ==========================================================================
// OLED Studio - Animated Progress Bar (Full Sketch)
// Target Hardware: Arduino Uno / Nano / ESP32
// Library: U8g2 (HW I2C)
// ==========================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

const int BAR_X = ${(128 - p.width) / 2};
const int BAR_Y = 24;
const int BAR_W = ${p.width};
const int BAR_H = ${p.height};

int currentProgress = 0;

void drawProgressBar(U8G2 &disp, int progress) {
  disp.drawRFrame(BAR_X, BAR_Y, BAR_W, BAR_H, 3);
  int fillW = map(constrain(progress, 0, 100), 0, 100, 0, BAR_W - 4);
  if (fillW > 0) {
    disp.drawRBox(BAR_X + 2, BAR_Y + 2, fillW, BAR_H - 4, 2);
  }
}

void setup() {
  u8g2.begin();
  u8g2.setBusClock(400000);
}

void loop() {
  u8g2.clearBuffer();
  drawProgressBar(u8g2, currentProgress);
  u8g2.sendBuffer();

  currentProgress = (currentProgress + 1) % 101;
  delay(30);
}
`;
      }
    }
  }

  // --- UI Update Functions ---

  function updateCodeView() {
    const codeEl = document.getElementById('animArduinoCode');
    if (codeEl) codeEl.textContent = generateCode();

    const btnDownload = document.getElementById('btnDownloadAnimIno');
    if (btnDownload) {
      const span = btnDownload.querySelector('span');
      if (span) span.textContent = codeScope === 'modular' ? '.h' : '.ino';
    }
  }

  function setStudioMode(mode) {
    studioMode = mode;

    document.querySelectorAll('.anim-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
    });

    const presetsPanel = document.getElementById('animPresetsPanel');
    const customPanel = document.getElementById('animCustomPanel');
    const eyeBar = document.getElementById('animEyeActionsBar');
    const canvasHint = document.getElementById('animCanvasHint');

    if (mode === 'custom') {
      if (presetsPanel) presetsPanel.style.display = 'none';
      if (customPanel) customPanel.style.display = 'block';
      if (eyeBar) eyeBar.style.display = 'none';
      if (canvasHint) canvasHint.style.display = 'block';
      renderCustomLayersList();
      renderCustomShapeProps();
    } else {
      if (presetsPanel) presetsPanel.style.display = 'block';
      if (customPanel) customPanel.style.display = 'none';
      if (canvasHint) canvasHint.style.display = 'none';
      if (eyeBar) eyeBar.style.display = currentTemplate === 'robot_eyes' ? 'flex' : 'none';
      setupPresetInputs();
    }

    updateCodeView();
  }

  // --- i18n Helper ---
  function tr(key, fallback = '') {
    if (typeof t === 'function') {
      const val = t(key);
      if (val && val !== key) return val;
    }
    return fallback || key;
  }

  function getLocalizedObjectName(obj) {
    if (!obj) return '';
    const match = obj.name.match(/^(Kutu|Box|Rect|Çember|Circle|Kalem|Line|Pen|Gözler|Eyes|Çift Göz|Metin|Text)\s+(\d+)$/i);
    if (match) {
      const num = match[2];
      let prefix = tr('anim_shape_rect', 'Kutu');
      if (obj.type === 'circle') prefix = tr('anim_shape_circle', 'Çember');
      else if (obj.type === 'line') prefix = tr('anim_shape_line', 'Kalem');
      else if (obj.type === 'eyes') prefix = tr('anim_shape_eyes', 'Gözler');
      else if (obj.type === 'text') prefix = tr('anim_shape_text', 'Metin');
      return `${prefix} ${num}`;
    }
    return obj.name;
  }

  // --- Custom Studio UI Renders ---

  function renderCustomLayersList() {
    const container = document.getElementById('customLayersList');
    if (!container) return;

    container.innerHTML = '';
    if (customStudio.objects.length === 0) {
      container.innerHTML = `<div class="anim-empty-layers-msg">${tr('anim_empty_layers', 'Henüz şekil eklenmedi. Yukarıdaki butonlarla şekil ekleyebilirsiniz.')}</div>`;
      return;
    }

    customStudio.objects.forEach(obj => {
      const item = document.createElement('div');
      item.className = 'anim-layer-row' + (obj.id === customStudio.selectedId ? ' active' : '');

      let typeIcon = '';
      if (obj.type === 'round_rect') typeIcon = '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" fill="none" stroke-width="2"/>';
      else if (obj.type === 'circle') typeIcon = '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/>';
      else if (obj.type === 'line') typeIcon = '<line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2"/>';
      else if (obj.type === 'eyes') typeIcon = '<rect x="2" y="6" width="8" height="12" rx="2" stroke="currentColor" fill="none" stroke-width="2"/><rect x="14" y="6" width="8" height="12" rx="2" stroke="currentColor" fill="none" stroke-width="2"/>';
      else typeIcon = '<polyline points="4 7 4 4 20 4 20 7" stroke="currentColor" fill="none" stroke-width="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2"/>';

      item.innerHTML = `
        <div class="anim-layer-left">
          <svg viewBox="0 0 24 24" width="13" height="13">${typeIcon}</svg>
          <span class="anim-layer-name">${getLocalizedObjectName(obj)}</span>
        </div>
        <button class="anim-layer-del" title="${tr('anim_delete_layer', 'Sil')}">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      const delBtn = item.querySelector('.anim-layer-del');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCustomObject(obj.id);
        });
      }

      item.addEventListener('click', () => {
        customStudio.selectedId = obj.id;
        renderCustomLayersList();
        renderCustomShapeProps();
      });

      container.appendChild(item);
    });
  }

  function renderCustomShapeProps() {
    const container = document.getElementById('customShapePropsContainer');
    if (!container) return;

    const obj = customStudio.objects.find(o => o.id === customStudio.selectedId);
    if (!obj) {
      container.innerHTML = `<div class="anim-empty-props-msg">${tr('anim_empty_props', 'Düzenlemek için yukarıdaki butonlarla bir şekil ekleyin.')}</div>`;
      return;
    }

    const currentKf = customStudio.activeKeyframe;
    const state = obj[currentKf];

    let html = '';
    if (obj.type === 'line') {
      const x2Val = state.x2 !== undefined ? state.x2 : (state.x + (state.w || 20));
      const y2Val = state.y2 !== undefined ? state.y2 : (state.y + (state.h || 0));
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_start_x', 'Başlangıç X (X1)')}</span>
            <span class="anim-param-val" id="valCustomX">${state.x} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomX" min="0" max="127" value="${state.x}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_start_y', 'Başlangıç Y (Y1)')}</span>
            <span class="anim-param-val" id="valCustomY">${state.y} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomY" min="0" max="63" value="${state.y}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_end_x', 'Bitiş X (X2)')}</span>
            <span class="anim-param-val" id="valCustomX2">${x2Val} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomX2" min="0" max="127" value="${x2Val}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_end_y', 'Bitiş Y (Y2)')}</span>
            <span class="anim-param-val" id="valCustomY2">${y2Val} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomY2" min="0" max="63" value="${y2Val}">
        </div>
      `;
    } else {
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_pos_x', 'X Konumu')}</span>
            <span class="anim-param-val" id="valCustomX">${state.x} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomX" min="0" max="110" value="${state.x}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_pos_y', 'Y Konumu')}</span>
            <span class="anim-param-val" id="valCustomY">${state.y} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomY" min="0" max="54" value="${state.y}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_width', 'Genişlik')}</span>
            <span class="anim-param-val" id="valCustomW">${state.w} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomW" min="4" max="80" value="${state.w}">
        </div>

        <div class="anim-control-group">
          <label class="anim-control-label">
            <span>${tr('anim_prop_height', 'Yükseklik')}</span>
            <span class="anim-param-val" id="valCustomH">${state.h} px</span>
          </label>
          <input type="range" class="range-slider" id="inputCustomH" min="2" max="60" value="${state.h}">
        </div>
      `;

      if (obj.type === 'round_rect' || obj.type === 'eyes') {
        html += `
          <div class="anim-control-group">
            <label class="anim-control-label">
              <span>${tr('anim_prop_radius', 'Köşe Yuvarlaklığı')}</span>
              <span class="anim-param-val" id="valCustomR">${state.r} px</span>
            </label>
            <input type="range" class="range-slider" id="inputCustomR" min="0" max="20" value="${state.r}">
          </div>
        `;
      }

      if (obj.type === 'eyes') {
        html += `
          <div class="anim-control-group">
            <label class="anim-control-label">
              <span>${tr('anim_prop_spacing', 'Göz Aralığı')}</span>
              <span class="anim-param-val" id="valCustomSpacing">${state.spacing || 14} px</span>
            </label>
            <input type="range" class="range-slider" id="inputCustomSpacing" min="4" max="30" value="${state.spacing || 14}">
          </div>
        `;
      }

      if (obj.type === 'text') {
        html += `
          <div class="anim-control-group">
            <label class="anim-control-label"><span>${tr('anim_prop_text', 'Metin')}</span></label>
            <input type="text" class="text-input" id="inputCustomText" value="${state.text || 'OLED'}">
          </div>
        `;
      }
    }

    container.innerHTML = html;
    bindCustomPropsEvents(obj, state);
  }

  function bindCustomPropsEvents(obj, state) {
    const bind = (id, valId, key, suffix) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (el) {
        el.addEventListener('input', (e) => {
          state[key] = parseInt(e.target.value, 10);
          if (valEl) valEl.textContent = state[key] + suffix;
          updateCodeView();
        });
      }
    };

    bind('inputCustomX', 'valCustomX', 'x', ' px');
    bind('inputCustomY', 'valCustomY', 'y', ' px');
    bind('inputCustomX2', 'valCustomX2', 'x2', ' px');
    bind('inputCustomY2', 'valCustomY2', 'y2', ' px');
    bind('inputCustomW', 'valCustomW', 'w', ' px');
    bind('inputCustomH', 'valCustomH', 'h', ' px');
    bind('inputCustomR', 'valCustomR', 'r', ' px');
    bind('inputCustomSpacing', 'valCustomSpacing', 'spacing', ' px');

    const textInput = document.getElementById('inputCustomText');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        state.text = e.target.value;
        updateCodeView();
      });
    }
  }

  function addCustomObject(type) {
    const id = customStudio.nextId++;
    let name = tr('anim_shape_rect', 'Kutu') + ' ' + id;
    let kA = { x: 30, y: 18, w: 28, h: 28, r: 4, spacing: 12, text: '' };
    let kB = { x: 70, y: 18, w: 28, h: 28, r: 4, spacing: 12, text: '' };

    if (type === 'circle') {
      name = tr('anim_shape_circle', 'Çember') + ' ' + id;
      kA = { x: 40, y: 16, w: 24, h: 24, r: 12, spacing: 0, text: '' };
      kB = { x: 70, y: 24, w: 24, h: 24, r: 12, spacing: 0, text: '' };
    } else if (type === 'line') {
      name = tr('anim_shape_line', 'Kalem') + ' ' + id;
      kA = { x: 24, y: 44, x2: 84, y2: 20, w: 60, h: 24, r: 0, spacing: 0, text: '' };
      kB = { x: 24, y: 20, x2: 84, y2: 44, w: 60, h: 24, r: 0, spacing: 0, text: '' };
    } else if (type === 'eyes') {
      name = tr('anim_shape_eyes', 'Gözler') + ' ' + id;
      kA = { x: 34, y: 16, w: 22, h: 32, r: 8, spacing: 16, text: '' };
      kB = { x: 34, y: 28, w: 24, h: 4, r: 2, spacing: 16, text: '' };
    } else if (type === 'text') {
      name = tr('anim_shape_text', 'Metin') + ' ' + id;
      kA = { x: 20, y: 24, w: 50, h: 14, r: 0, spacing: 0, text: 'HELLO' };
      kB = { x: 60, y: 24, w: 50, h: 14, r: 0, spacing: 0, text: 'HELLO' };
    }

    customStudio.objects.push({ id, name, type, kA, kB });
    customStudio.selectedId = id;
    renderCustomLayersList();
    renderCustomShapeProps();
    updateCodeView();
  }

  function deleteCustomObject(id) {
    customStudio.objects = customStudio.objects.filter(o => o.id !== id);
    if (customStudio.objects.length === 0) {
      customStudio.selectedId = null;
    } else if (customStudio.selectedId === id) {
      customStudio.selectedId = customStudio.objects[0].id;
    }
    renderCustomLayersList();
    renderCustomShapeProps();
    updateCodeView();
  }

  function applyQuickMotionPreset(motionType) {
    const obj = customStudio.objects.find(o => o.id === customStudio.selectedId);
    if (!obj) return;

    if (obj.type === 'line') {
      if (motionType === 'slide_h') {
        obj.kA.x = 16; obj.kA.x2 = 64;
        obj.kB.x = 64; obj.kB.x2 = 112;
      } else if (motionType === 'bounce_v') {
        obj.kA.y = 12; obj.kA.y2 = 12;
        obj.kB.y = 52; obj.kB.y2 = 52;
      } else if (motionType === 'blink') {
        obj.kA.y = 18; obj.kA.y2 = 46;
        obj.kB.y = 46; obj.kB.y2 = 18;
      } else if (motionType === 'pulse') {
        obj.kA.x = 44; obj.kA.x2 = 84;
        obj.kB.x = 16; obj.kB.x2 = 112;
      }
      renderCustomShapeProps();
      updateCodeView();
      return;
    }

    if (motionType === 'slide_h') {
      obj.kA.x = 16;
      obj.kB.x = 84;
      obj.kB.y = obj.kA.y;
    } else if (motionType === 'bounce_v') {
      obj.kA.y = 8;
      obj.kB.y = 36;
      obj.kB.x = obj.kA.x;
    } else if (motionType === 'blink') {
      obj.kB.h = 3;
      obj.kB.r = 1;
      obj.kB.y = obj.kA.y + Math.round((obj.kA.h - 3) / 2);
    } else if (motionType === 'pulse') {
      obj.kB.w = Math.min(60, obj.kA.w + 14);
      obj.kB.h = Math.min(50, obj.kA.h + 14);
      obj.kB.x = Math.max(2, obj.kA.x - 7);
      obj.kB.y = Math.max(2, obj.kA.y - 7);
    }

    renderCustomShapeProps();
    updateCodeView();
  }

  // --- Preset Template Controls Setup ---

  function setupPresetInputs() {
    const container = document.getElementById('animParamsContainer');
    if (!container) return;

    let html = '';
    if (currentTemplate === 'robot_eyes') {
      const p = params.robot_eyes;
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_eye_width', 'Göz Genişliği')}</span><span class="anim-param-val" id="valEyeWidth">${p.eyeWidth} px</span></label>
          <input type="range" class="range-slider" id="inputEyeWidth" min="20" max="48" value="${p.eyeWidth}">
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_eye_height', 'Göz Yüksekliği')}</span><span class="anim-param-val" id="valEyeHeight">${p.eyeHeight} px</span></label>
          <input type="range" class="range-slider" id="inputEyeHeight" min="16" max="48" value="${p.eyeHeight}">
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_eye_space', 'Göz Aralığı')}</span><span class="anim-param-val" id="valEyeSpace">${p.eyeSpace} px</span></label>
          <input type="range" class="range-slider" id="inputEyeSpace" min="4" max="24" value="${p.eyeSpace}">
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_corner_radius', 'Köşe Yuvarlaklığı')}</span><span class="anim-param-val" id="valEyeRadius">${p.cornerRadius} px</span></label>
          <input type="range" class="range-slider" id="inputEyeRadius" min="0" max="18" value="${p.cornerRadius}">
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_speed', 'Hız')}</span><span class="anim-param-val" id="valEyeSpeed">${p.speed}x</span></label>
          <input type="range" class="range-slider" id="inputEyeSpeed" min="1" max="10" value="${p.speed}">
        </div>
        <div class="anim-control-group checkbox-row">
          <label><input type="checkbox" id="checkEyeAutoDemo" ${p.autoDemo ? 'checked' : ''}><span>${tr('anim_param_auto_demo', 'Otomatik Döngü (Demo)')}</span></label>
        </div>
      `;
    } else if (currentTemplate === 'radar_scan') {
      const p = params.radar_scan;
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_radius', 'Tarama Yarıçapı')}</span><span class="anim-param-val" id="valRadarRadius">${p.radius} px</span></label>
          <input type="range" class="range-slider" id="inputRadarRadius" min="14" max="30" value="${p.radius}">
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_radar_speed', 'Tarama Hızı')}</span><span class="anim-param-val" id="valRadarSpeed">${p.speed}x</span></label>
          <input type="range" class="range-slider" id="inputRadarSpeed" min="1" max="10" value="${p.speed}">
        </div>
      `;
    } else if (currentTemplate === 'sine_wave') {
      const p = params.sine_wave;
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_mode', 'Mod')}</span></label>
          <select id="selectSineMode" class="select-input select-input-sm">
            <option value="line" ${p.mode === 'line' ? 'selected' : ''}>${tr('anim_mode_sine_line', 'Sinüs Eğrisi (Line)')}</option>
            <option value="bars" ${p.mode === 'bars' ? 'selected' : ''}>${tr('anim_mode_sine_bars', 'Ekolayzır Barları (Bars)')}</option>
          </select>
        </div>
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_amplitude', 'Genlik')}</span><span class="anim-param-val" id="valSineAmp">${p.amplitude} px</span></label>
          <input type="range" class="range-slider" id="inputSineAmp" min="6" max="24" value="${p.amplitude}">
        </div>
      `;
    } else if (currentTemplate === 'starfield') {
      const p = params.starfield;
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_stars', 'Yıldız Sayısı')}</span><span class="anim-param-val" id="valStarCount">${p.count}</span></label>
          <input type="range" class="range-slider" id="inputStarCount" min="15" max="60" value="${p.count}">
        </div>
      `;
    } else if (currentTemplate === 'progress_bar') {
      const p = params.progress_bar;
      html = `
        <div class="anim-control-group">
          <label class="anim-control-label"><span>${tr('anim_param_progress', 'İlerleme Değeri')}</span><span class="anim-param-val" id="valProgressValue">${p.progress}%</span></label>
          <input type="range" class="range-slider" id="inputProgressValue" min="0" max="100" value="${p.progress}">
        </div>
      `;
    }

    container.innerHTML = html;
    bindPresetEvents();
  }

  function bindPresetEvents() {
    if (currentTemplate === 'robot_eyes') {
      const p = params.robot_eyes;
      const bind = (id, valId, key, suffix) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if (el) el.addEventListener('input', (e) => {
          p[key] = parseInt(e.target.value, 10);
          if (valEl) valEl.textContent = p[key] + suffix;
          updateCodeView();
        });
      };
      bind('inputEyeWidth', 'valEyeWidth', 'eyeWidth', ' px');
      bind('inputEyeHeight', 'valEyeHeight', 'eyeHeight', ' px');
      bind('inputEyeSpace', 'valEyeSpace', 'eyeSpace', ' px');
      bind('inputEyeRadius', 'valEyeRadius', 'cornerRadius', ' px');
      bind('inputEyeSpeed', 'valEyeSpeed', 'speed', 'x');

      const checkAuto = document.getElementById('checkEyeAutoDemo');
      if (checkAuto) checkAuto.addEventListener('change', (e) => p.autoDemo = e.target.checked);
    } else if (currentTemplate === 'radar_scan') {
      const p = params.radar_scan;
      const elR = document.getElementById('inputRadarRadius');
      if (elR) elR.addEventListener('input', (e) => {
        p.radius = parseInt(e.target.value, 10);
        document.getElementById('valRadarRadius').textContent = p.radius + ' px';
        updateCodeView();
      });
    } else if (currentTemplate === 'sine_wave') {
      const p = params.sine_wave;
      const selMode = document.getElementById('selectSineMode');
      if (selMode) selMode.addEventListener('change', (e) => { p.mode = e.target.value; updateCodeView(); });
      const elAmp = document.getElementById('inputSineAmp');
      if (elAmp) elAmp.addEventListener('input', (e) => {
        p.amplitude = parseInt(e.target.value, 10);
        document.getElementById('valSineAmp').textContent = p.amplitude + ' px';
        updateCodeView();
      });
    } else if (currentTemplate === 'starfield') {
      const p = params.starfield;
      const elC = document.getElementById('inputStarCount');
      if (elC) elC.addEventListener('input', (e) => {
        p.count = parseInt(e.target.value, 10);
        document.getElementById('valStarCount').textContent = p.count;
        initStars();
        updateCodeView();
      });
    } else if (currentTemplate === 'progress_bar') {
      const p = params.progress_bar;
      const elP = document.getElementById('inputProgressValue');
      if (elP) elP.addEventListener('input', (e) => {
        p.progress = parseInt(e.target.value, 10);
        document.getElementById('valProgressValue').textContent = p.progress + '%';
        updateCodeView();
      });
    }
  }

  function updateDurationLabels() {
    const secUnit = tr('anim_unit_sec', 'sn');
    const valDuration = document.getElementById('valCustomDuration');
    if (valDuration) valDuration.textContent = customStudio.holdDuration.toFixed(1) + ' ' + secUnit;
    const valMoveDuration = document.getElementById('valCustomMoveDuration');
    if (valMoveDuration) valMoveDuration.textContent = customStudio.moveDuration.toFixed(1) + ' ' + secUnit;
  }

  // --- Modal Open/Close Controls ---

  function openAnimStudio() {
    const modal = document.getElementById('animModalOverlay');
    if (!modal) return;

    modal.style.display = 'flex';
    animActive = true;
    isPlaying = true;
    lastTimestamp = 0;

    // Start with code drawer collapsed
    toggleCodeDrawer(false);

    const oledColorSelect = document.getElementById('oledColorSelect');
    if (oledColorSelect) {
      const c = oledColorSelect.value;
      if (c === 'blue') currentOledColor = '#60a5fa';
      else if (c === 'yellow') currentOledColor = '#facc15';
      else if (c === 'green') currentOledColor = '#4ade80';
      else currentOledColor = '#ffffff';
    }

    setStudioMode(studioMode);
    updateDurationLabels();
    initStars();

    if (!animCanvas) {
      animCanvas = document.getElementById('animStudioCanvas');
      if (animCanvas) animCtx = animCanvas.getContext('2d');
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(animLoop);
  }

  function closeAnimStudio() {
    const modal = document.getElementById('animModalOverlay');
    if (modal) modal.style.display = 'none';
    animActive = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function copyAnimCode() {
    const code = generateCode();
    navigator.clipboard.writeText(code).then(() => {
      const btns = document.querySelectorAll('#btnCopyAnimCode');
      btns.forEach(btn => {
        const textSpan = btn.querySelector('.btn-copy-label');
        if (textSpan) {
          const original = textSpan.textContent;
          textSpan.textContent = typeof t === 'function' ? t('copied') || 'Kopyalandı!' : 'Kopyalandı!';
          setTimeout(() => { textSpan.textContent = original; }, 1500);
        }
      });
    });
  }

  function downloadAnimIno() {
    const code = generateCode();
    const ext = codeScope === 'modular' ? 'h' : 'ino';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const filename = studioMode === 'custom' ? `custom_animation_oled.${ext}` : `${currentTemplate}_oled.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Initialization & Event Wiring ---

  function init() {
    animCanvas = document.getElementById('animStudioCanvas');
    if (animCanvas) animCtx = animCanvas.getContext('2d');

    // Header Launcher
    const btnAnim = document.getElementById('btnAnimStudio');
    if (btnAnim) btnAnim.addEventListener('click', openAnimStudio);

    // Modal Close
    const btnClose = document.getElementById('btnCloseAnimModal');
    if (btnClose) btnClose.addEventListener('click', closeAnimStudio);

    const overlay = document.getElementById('animModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAnimStudio();
      });
    }

    // Code Drawer Toggles
    const btnToggleCode = document.getElementById('btnToggleAnimCodeDrawer');
    if (btnToggleCode) {
      btnToggleCode.addEventListener('click', () => toggleCodeDrawer());
    }

    const btnGrip = document.getElementById('btnDrawerGrip');
    if (btnGrip) {
      btnGrip.addEventListener('click', () => toggleCodeDrawer(true));
    }

    const btnCloseDrawer = document.getElementById('btnCloseAnimDrawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => toggleCodeDrawer(false));
    }

    // Mode Switcher Tabs
    const tabPresets = document.getElementById('btnModePresets');
    if (tabPresets) tabPresets.addEventListener('click', () => setStudioMode('presets'));

    const tabCustom = document.getElementById('btnModeCustom');
    if (tabCustom) tabCustom.addEventListener('click', () => setStudioMode('custom'));

    // Template Selector Cards
    const templateCards = document.querySelectorAll('.anim-tpl-card');
    templateCards.forEach(card => {
      card.addEventListener('click', () => {
        templateCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentTemplate = card.getAttribute('data-template');
        setupPresetInputs();
        updateCodeView();

        const actionsBar = document.getElementById('animEyeActionsBar');
        if (actionsBar) actionsBar.style.display = currentTemplate === 'robot_eyes' ? 'flex' : 'none';
      });
    });

    // Robot Eyes Emotion Buttons
    const emotionBtns = document.querySelectorAll('.anim-emotion-btn');
    emotionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emo = btn.getAttribute('data-emotion');
        params.robot_eyes.autoDemo = false;
        const autoCheck = document.getElementById('checkEyeAutoDemo');
        if (autoCheck) autoCheck.checked = false;
        triggerEyeEmotion(emo);
      });
    });

    // Custom Mode: Add Shape Buttons
    const addShapeBtns = document.querySelectorAll('.anim-add-shape-btn');
    addShapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const shapeType = btn.getAttribute('data-add-shape');
        addCustomObject(shapeType);
      });
    });

    // Custom Mode: Keyframe Toggle Buttons (No A or B letters)
    const btnKfA = document.getElementById('btnKfA');
    const btnKfB = document.getElementById('btnKfB');
    if (btnKfA && btnKfB) {
      btnKfA.addEventListener('click', () => {
        customStudio.activeKeyframe = 'kA';
        btnKfA.classList.add('active');
        btnKfB.classList.remove('active');
        renderCustomShapeProps();
      });
      btnKfB.addEventListener('click', () => {
        customStudio.activeKeyframe = 'kB';
        btnKfB.classList.add('active');
        btnKfA.classList.remove('active');
        renderCustomShapeProps();
      });
    }

    // Custom Mode: Hold Duration Slider
  const inputDuration = document.getElementById('inputCustomDuration');
  const valDuration = document.getElementById('valCustomDuration');
  if (inputDuration) {
    inputDuration.addEventListener('input', (e) => {
      const valSec = parseInt(e.target.value, 10) / 10;
      customStudio.holdDuration = valSec;
      if (valDuration) valDuration.textContent = valSec.toFixed(1) + ' ' + tr('anim_unit_sec', 'sn');
      updateCodeView();
    });
  }

  // Custom Mode: Transition Movement Duration Slider
  const inputMoveDuration = document.getElementById('inputCustomMoveDuration');
  const valMoveDuration = document.getElementById('valCustomMoveDuration');
  if (inputMoveDuration) {
    inputMoveDuration.addEventListener('input', (e) => {
      const valSec = parseInt(e.target.value, 10) / 10;
      customStudio.moveDuration = valSec;
      if (valMoveDuration) valMoveDuration.textContent = valSec.toFixed(1) + ' ' + tr('anim_unit_sec', 'sn');
      updateCodeView();
    });
  }

    // Custom Mode: Quick Motion Preset Buttons
    const motionBtns = document.querySelectorAll('.anim-motion-preset-btn');
    motionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const motion = btn.getAttribute('data-motion');
        applyQuickMotionPreset(motion);
      });
    });

    // Play / Pause Toggle
    const btnPlayPause = document.getElementById('btnAnimPlayPause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        isPlaying = !isPlaying;
        btnPlayPause.classList.toggle('active', !isPlaying);
        if (studioMode === 'custom' && !isPlaying) {
          renderCustomShapeProps();
        }
      });
    }

    // Canvas Interactive Dragging in Custom Mode (when paused)
    if (animCanvas) {
      animCanvas.addEventListener('mousedown', (e) => {
        if (studioMode !== 'custom' || isPlaying) return;

        const rect = animCanvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const mouseX = Math.round((e.clientX - rect.left) * scaleX);
        const mouseY = Math.round((e.clientY - rect.top) * scaleY);

        const currentKf = customStudio.activeKeyframe;
        for (let i = customStudio.objects.length - 1; i >= 0; i--) {
          const obj = customStudio.objects[i];
          const st = obj[currentKf];
          let hit = false;
          if (obj.type === 'line') {
            const minX = Math.min(st.x, st.x2 !== undefined ? st.x2 : st.x) - 6;
            const maxX = Math.max(st.x, st.x2 !== undefined ? st.x2 : st.x) + 6;
            const minY = Math.min(st.y, st.y2 !== undefined ? st.y2 : st.y) - 6;
            const maxY = Math.max(st.y, st.y2 !== undefined ? st.y2 : st.y) + 6;
            hit = (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY);
          } else {
            const w = obj.type === 'eyes' ? (st.w * 2 + (st.spacing || 14)) : st.w;
            hit = (mouseX >= st.x && mouseX <= st.x + w && mouseY >= st.y && mouseY <= st.y + st.h);
          }

          if (hit) {
            customStudio.selectedId = obj.id;
            isDragging = true;
            dragTarget = st;
            dragStartX = mouseX;
            dragStartY = mouseY;
            shapeInitialX = st.x;
            shapeInitialY = st.y;
            shapeInitialX2 = st.x2 !== undefined ? st.x2 : st.x;
            shapeInitialY2 = st.y2 !== undefined ? st.y2 : st.y;
            renderCustomLayersList();
            renderCustomShapeProps();
            break;
          }
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || !dragTarget || !animCanvas) return;
        const rect = animCanvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const mouseX = Math.round((e.clientX - rect.left) * scaleX);
        const mouseY = Math.round((e.clientY - rect.top) * scaleY);

        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;

        if (dragTarget.x2 !== undefined) {
          dragTarget.x = Math.max(0, Math.min(127, shapeInitialX + deltaX));
          dragTarget.y = Math.max(0, Math.min(63, shapeInitialY + deltaY));
          dragTarget.x2 = Math.max(0, Math.min(127, shapeInitialX2 + deltaX));
          dragTarget.y2 = Math.max(0, Math.min(63, shapeInitialY2 + deltaY));

          const xInput = document.getElementById('inputCustomX');
          const yInput = document.getElementById('inputCustomY');
          const x2Input = document.getElementById('inputCustomX2');
          const y2Input = document.getElementById('inputCustomY2');
          if (xInput) xInput.value = dragTarget.x;
          if (yInput) yInput.value = dragTarget.y;
          if (x2Input) x2Input.value = dragTarget.x2;
          if (y2Input) y2Input.value = dragTarget.y2;
          const valX = document.getElementById('valCustomX');
          const valY = document.getElementById('valCustomY');
          const valX2 = document.getElementById('valCustomX2');
          const valY2 = document.getElementById('valCustomY2');
          if (valX) valX.textContent = dragTarget.x + ' px';
          if (valY) valY.textContent = dragTarget.y + ' px';
          if (valX2) valX2.textContent = dragTarget.x2 + ' px';
          if (valY2) valY2.textContent = dragTarget.y2 + ' px';
        } else {
          dragTarget.x = Math.max(0, Math.min(120, shapeInitialX + deltaX));
          dragTarget.y = Math.max(0, Math.min(60, shapeInitialY + deltaY));

          const xInput = document.getElementById('inputCustomX');
          const yInput = document.getElementById('inputCustomY');
          if (xInput) xInput.value = dragTarget.x;
          if (yInput) yInput.value = dragTarget.y;
          const valX = document.getElementById('valCustomX');
          const valY = document.getElementById('valCustomY');
          if (valX) valX.textContent = dragTarget.x + ' px';
          if (valY) valY.textContent = dragTarget.y + ' px';
        }

        updateCodeView();
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
        dragTarget = null;
      });
    }

    // Code Library Selector
    const libSelect = document.getElementById('animLibSelect');
    if (libSelect) {
      libSelect.addEventListener('change', (e) => {
        codeLibrary = e.target.value;
        updateCodeView();
      });
    }

    // Code Scope Selector (Modular vs Full Sketch)
    const scopeSelect = document.getElementById('animScopeSelect');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', (e) => {
        codeScope = e.target.value;
        updateCodeView();
      });
    }

    // Copy & Download
    const btnCopy = document.getElementById('btnCopyAnimCode');
    if (btnCopy) btnCopy.addEventListener('click', copyAnimCode);

    const btnDownload = document.getElementById('btnDownloadAnimIno');
    if (btnDownload) btnDownload.addEventListener('click', downloadAnimIno);

    // Language Change Listener
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(() => {
        updateDurationLabels();
        renderCustomLayersList();
        renderCustomShapeProps();
        setupPresetInputs();
        updateCodeView();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.openAnimStudio = openAnimStudio;
  window.closeAnimStudio = closeAnimStudio;
})();
