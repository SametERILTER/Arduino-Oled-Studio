let nextObjId = 1;

function generateId() {
  return `obj_${Date.now()}_${nextObjId++}`;
}

let fontMeasureCanvas = null;
let fontMeasureCtx = null;

function getTextDimensions(text, size, fontId) {
  size = Math.max(1, Math.round(size || 1));
  const fontDef = (typeof FONTS_CATALOG !== 'undefined' && FONTS_CATALOG[fontId]) ? FONTS_CATALOG[fontId] : null;

  if (!fontDef || fontDef.id === 'default') {
    const len = (text && text.length) || 1;
    return {
      w: len * 6 * size,
      h: 8 * size
    };
  }

  const fontSizePx = Math.round((fontDef.charH || 10) * size);
  if (!fontMeasureCanvas) {
    fontMeasureCanvas = document.createElement('canvas');
    fontMeasureCtx = fontMeasureCanvas.getContext('2d', { willReadFrequently: true });
  }

  const isBold = fontDef.id === 'helvB10';
  fontMeasureCtx.font = `${isBold ? 'bold ' : ''}${fontSizePx}px ${fontDef.cssFamily}`;
  const measured = fontMeasureCtx.measureText(text || ' ');
  const w = Math.max(4, Math.ceil(measured.width));
  const h = Math.max(4, Math.ceil(fontSizePx * 1.15));
  return { w, h };
}

function getObjectBounds(obj) {
  if (!obj) return null;
  switch (obj.type) {
    case 'text': {
      const dims = getTextDimensions(obj.text, obj.size, obj.font);
      return { x: obj.x, y: obj.y, w: dims.w, h: dims.h };
    }
    case 'rect':
    case 'filled_rect':
    case 'bitmap':
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    case 'circle':
    case 'filled_circle': {
      const r = obj.r;
      return { x: obj.x - r, y: obj.y - r, w: r * 2, h: r * 2 };
    }
    case 'line': {
      const minX = Math.min(obj.x1, obj.x2);
      const minY = Math.min(obj.y1, obj.y2);
      const maxX = Math.max(obj.x1, obj.x2);
      const maxY = Math.max(obj.y1, obj.y2);
      return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    }
    default:
      return { x: obj.x || 0, y: obj.y || 0, w: obj.w || 10, h: obj.h || 10 };
  }
}

function getSelectedObject() {
  return state.objects.find(o => o.id === state.selectedId) || null;
}

function selectObject(id) {
  state.selectedId = id;
  updatePropertiesPanel();
  renderOverlay();
  renderLayersList();
}

function renderAll() {
  renderOled();
  renderOverlay();
  renderLayersList();
  if (typeof syncActiveScreen === 'function') syncActiveScreen();
  if (typeof updateTabBarActiveState === 'function') updateTabBarActiveState();
}

function renderOled() {
  const current = COLOR_MAP[state.oledColor] || COLOR_MAP.white;
  const isInv = state.inverted;

  const bgCol = isInv ? current.pixel : current.bg;
  const fgCol = isInv ? current.bg : current.pixel;

  oledCtx.fillStyle = bgCol;
  oledCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const finalBuffer = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);

  for (const obj of state.objects) {
    if (obj.visible === false) continue;
    drawObjectToBuffer(obj, finalBuffer);
  }

  for (let i = 0; i < finalBuffer.length; i++) {
    if (state.pixels[i]) finalBuffer[i] = 1;
  }

  for (let i = 0; i < finalBuffer.length; i++) {
    if (state.erasedPixels[i]) finalBuffer[i] = 0;
  }

  oledCtx.fillStyle = fgCol;
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      if (finalBuffer[y * SCREEN_WIDTH + x] === 1) {
        oledCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  if (state.creationPreview) {
    oledCtx.fillStyle = isInv ? current.bg : current.pixel;
    drawObjectToBuffer(state.creationPreview, finalBuffer);
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        if (finalBuffer[y * SCREEN_WIDTH + x] === 1) {
          oledCtx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
}

function setPixel(buf, x, y, val = 1) {
  if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT) {
    buf[y * SCREEN_WIDTH + x] = val;
  }
}

function applyBrush(cx, cy, val, size) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const half = Math.floor(size / 2);

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = cx - half + dx;
      const py = cy - half + dy;
      if (px >= 0 && px < SCREEN_WIDTH && py >= 0 && py < SCREEN_HEIGHT) {
        const idx = py * SCREEN_WIDTH + px;
        if (val === 1) {

          state.pixels[idx] = 1;
          state.erasedPixels[idx] = 0;
        } else {

          state.pixels[idx] = 0;
          state.erasedPixels[idx] = 1;
        }
      }
    }
  }
}

function applyBrushLine(x0, y0, x1, y1, val, size) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while (true) {
    applyBrush(x0, y0, val, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function drawLine(buf, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while (true) {
    setPixel(buf, x0, y0, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function drawRect(buf, x, y, w, h, filled) {
  x = Math.round(x); y = Math.round(y);
  w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;

  if (filled) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        setPixel(buf, x + c, y + r, 1);
      }
    }
  } else {
    for (let c = 0; c < w; c++) {
      setPixel(buf, x + c, y, 1);
      setPixel(buf, x + c, y + h - 1, 1);
    }
    for (let r = 0; r < h; r++) {
      setPixel(buf, x, y + r, 1);
      setPixel(buf, x + w - 1, y + r, 1);
    }
  }
}

function drawCircle(buf, xm, ym, r, filled) {
  xm = Math.round(xm); ym = Math.round(ym); r = Math.round(r);
  if (r <= 0) {
    setPixel(buf, xm, ym, 1);
    return;
  }

  if (filled) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          setPixel(buf, xm + x, ym + y, 1);
        }
      }
    }
  } else {
    let x = -r, y = 0, err = 2 - 2 * r;
    do {
      setPixel(buf, xm - x, ym + y, 1);
      setPixel(buf, xm - y, ym - x, 1);
      setPixel(buf, xm + x, ym - y, 1);
      setPixel(buf, xm + y, ym + x, 1);
      r = err;
      if (r <= y) err += ++y * 2 + 1;
      if (r > x || err > y) err += ++x * 2 + 1;
    } while (x < 0);
  }
}

function drawChar5x7(buf, charCode, startX, startY, size) {
  const glyph = FONT_5X7[charCode] || FONT_5X7[32];
  for (let col = 0; col < 5; col++) {
    const colByte = glyph[col];
    for (let row = 0; row < 7; row++) {
      if ((colByte & (1 << row)) !== 0) {

        if (size === 1) {
          setPixel(buf, startX + col, startY + row, 1);
        } else {
          for (let sx = 0; sx < size; sx++) {
            for (let sy = 0; sy < size; sy++) {
              setPixel(buf, startX + col * size + sx, startY + row * size + sy, 1);
            }
          }
        }
      }
    }
  }
}

function drawText(buf, text, x, y, size, fontId = 'default') {
  x = Math.round(x);
  y = Math.round(y);
  size = Math.max(1, Math.round(size));
  text = String(text || '');

  const fontDef = (typeof FONTS_CATALOG !== 'undefined' && FONTS_CATALOG[fontId]) ? FONTS_CATALOG[fontId] : null;

  if (!fontDef || fontDef.id === 'default') {
    const charWidth = 6 * size; 
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      drawChar5x7(buf, code, x + i * charWidth, y, size);
    }
    return;
  }

  if (!fontMeasureCanvas) {
    fontMeasureCanvas = document.createElement('canvas');
    fontMeasureCtx = fontMeasureCanvas.getContext('2d', { willReadFrequently: true });
  }

  const fontSizePx = Math.round((fontDef.charH || 10) * size);
  const isBold = fontDef.id === 'helvB10';
  const fontStyle = `${isBold ? 'bold ' : ''}${fontSizePx}px ${fontDef.cssFamily}`;

  fontMeasureCtx.font = fontStyle;
  const measured = fontMeasureCtx.measureText(text);
  const textW = Math.max(2, Math.ceil(measured.width) + 4);
  const textH = Math.max(2, Math.ceil(fontSizePx * 1.3) + 4);

  fontMeasureCanvas.width = textW;
  fontMeasureCanvas.height = textH;

  fontMeasureCtx.clearRect(0, 0, textW, textH);
  fontMeasureCtx.font = fontStyle;
  fontMeasureCtx.textBaseline = 'top';
  fontMeasureCtx.fillStyle = '#ffffff';
  fontMeasureCtx.imageSmoothingEnabled = false;
  fontMeasureCtx.fillText(text, 0, 0);

  const imgData = fontMeasureCtx.getImageData(0, 0, textW, textH).data;

  for (let r = 0; r < textH; r++) {
    for (let c = 0; c < textW; c++) {
      const alpha = imgData[(r * textW + c) * 4 + 3];
      if (alpha > 100) {
        setPixel(buf, x + c, y + r, 1);
      }
    }
  }
}

function drawBitmap(buf, x, y, w, h, data, origW, origH) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  origW = origW || w;
  origH = origH || h;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {

      const srcC = Math.min(origW - 1, Math.floor(c * (origW / w)));
      const srcR = Math.min(origH - 1, Math.floor(r * (origH / h)));
      if (data[srcR * origW + srcC]) {
        setPixel(buf, x + c, y + r, 1);
      }
    }
  }
}

function drawObjectToBuffer(obj, buf) {
  switch (obj.type) {
    case 'text':
      drawText(buf, obj.text, obj.x, obj.y, obj.size, obj.font);
      break;
    case 'rect':
      drawRect(buf, obj.x, obj.y, obj.w, obj.h, false);
      break;
    case 'filled_rect':
      drawRect(buf, obj.x, obj.y, obj.w, obj.h, true);
      break;
    case 'circle':
      drawCircle(buf, obj.x, obj.y, obj.r, false);
      break;
    case 'filled_circle':
      drawCircle(buf, obj.x, obj.y, obj.r, true);
      break;
    case 'line':
      drawLine(buf, obj.x1, obj.y1, obj.x2, obj.y2);
      break;
    case 'bitmap':
      drawBitmap(buf, obj.x, obj.y, obj.w, obj.h, obj.data, obj.origW, obj.origH);
      break;
  }
}

function renderOverlay() {
  overlayCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (state.showGrid && state.zoom >= 4) {
    overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      overlayCtx.fillRect(x, 0, 1 / state.zoom, SCREEN_HEIGHT);
    }
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      overlayCtx.fillRect(0, y, SCREEN_WIDTH, 1 / state.zoom);
    }
  }

  const selObj = getSelectedObject();
  if (selObj && state.activeTool === 'select') {
    const bounds = getObjectBounds(selObj);
    if (!bounds) return;

    overlayCtx.save();

    overlayCtx.strokeStyle = '#3b82f6';
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([2, 2]);
    overlayCtx.strokeRect(bounds.x - 0.5, bounds.y - 0.5, bounds.w + 1, bounds.h + 1);

    overlayCtx.setLineDash([]);
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.strokeStyle = '#2563eb';
    overlayCtx.lineWidth = 1;

    const handleSize = 3;
    const handles = [
      { x: bounds.x, y: bounds.y }, 
      { x: bounds.x + bounds.w, y: bounds.y }, 
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, 
      { x: bounds.x, y: bounds.y + bounds.h } 
    ];

    for (const h of handles) {
      overlayCtx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      overlayCtx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    }

    overlayCtx.restore();
  }

  if (state.currentMousePos && state.currentMousePos.x >= 0) {
    if (state.activeTool === 'pencil' || (state.activeTool === 'eraser' && state.eraserMode === 'pixel')) {
      const size = state.brushSize;
      const half = Math.floor(size / 2);
      overlayCtx.save();
      overlayCtx.strokeStyle = (state.activeTool === 'pencil') ? '#38bdf8' : '#f87171';
      overlayCtx.lineWidth = 1;
      overlayCtx.strokeRect(state.currentMousePos.x - half + 0.5, state.currentMousePos.y - half + 0.5, size, size);
      overlayCtx.restore();
    }
  }
}
