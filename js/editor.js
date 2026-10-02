function getCanvasCoords(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = SCREEN_WIDTH / rect.width;
  const scaleY = SCREEN_HEIGHT / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  return {
    x: Math.max(0, Math.min(SCREEN_WIDTH - 1, x)),
    y: Math.max(0, Math.min(SCREEN_HEIGHT - 1, y))
  };
}

function getHandleAt(pos, bounds) {
  if (!bounds) return null;
  const tol = 3;
  const { x, y, w, h } = bounds;

  if (Math.abs(pos.x - x) <= tol && Math.abs(pos.y - y) <= tol) return 'nw';
  if (Math.abs(pos.x - (x + w)) <= tol && Math.abs(pos.y - y) <= tol) return 'ne';
  if (Math.abs(pos.x - (x + w)) <= tol && Math.abs(pos.y - (y + h)) <= tol) return 'se';
  if (Math.abs(pos.x - x) <= tol && Math.abs(pos.y - (y + h)) <= tol) return 'sw';

  return null;
}

function getObjectAt(pos) {

  for (let i = state.objects.length - 1; i >= 0; i--) {
    const obj = state.objects[i];
    if (obj.visible === false) continue;
    const b = getObjectBounds(obj);
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
      return obj;
    }
  }
  return null;
}

overlayCanvas.addEventListener('mousedown', (e) => {
  const pos = getCanvasCoords(e);
  state.isDrawing = true;
  state.dragStart = { ...pos };

  const tool = state.activeTool;

  if (tool === 'pencil' || tool === 'eraser') {
    pushHistory();

    if (tool === 'eraser' && state.eraserMode === 'object') {
      const clickedObj = getObjectAt(pos);
      if (clickedObj) {
        state.objects = state.objects.filter(o => o.id !== clickedObj.id);
        renderAll();
        updateArduinoCode();
        return;
      }
    }
    const val = (tool === 'pencil') ? 1 : 0;
    applyBrush(pos.x, pos.y, val, state.brushSize);
    state.lastBrushPos = { ...pos };
    renderOled();
    renderOverlay();
    return;
  }

  if (tool === 'select') {
    const selObj = getSelectedObject();
    if (selObj) {
      const bounds = getObjectBounds(selObj);
      const handle = getHandleAt(pos, bounds);
      if (handle) {
        pushHistory();
        state.dragMode = 'resize';
        state.resizeHandle = handle;
        state.initialObjState = JSON.parse(JSON.stringify(selObj));
        return;
      }
    }

    const clickedObj = getObjectAt(pos);
    if (clickedObj) {
      selectObject(clickedObj.id);
      pushHistory();
      state.dragMode = 'move';
      state.initialObjState = JSON.parse(JSON.stringify(clickedObj));
    } else {
      selectObject(null);
      state.dragMode = null;
    }
    renderAll();
    return;
  }

  if (tool === 'text') {
    pushHistory();
    const textLabel = typeof t === 'function' ? t('obj_text') : 'Metin';
    const newText = {
      id: generateId(),
      type: 'text',
      name: `${textLabel} ${state.objects.length + 1}`,
      text: 'OLED',
      x: pos.x,
      y: pos.y,
      size: 1,
      visible: true
    };
    state.objects.push(newText);
    selectObject(newText.id);
    setActiveTool('select');
    renderAll();
    updateArduinoCode();
    return;
  }

  if (['rect', 'filled_rect', 'circle', 'filled_circle', 'line'].includes(tool)) {
    state.dragMode = 'create';
    state.creationPreview = null;
  }
});

overlayCanvas.addEventListener('mousemove', (e) => {
  const pos = getCanvasCoords(e);
  mouseCoordText.textContent = `X: ${pos.x}, Y: ${pos.y}`;
  state.currentMousePos = { ...pos };

  if (!state.isDrawing) {
    if (state.activeTool === 'pencil' || (state.activeTool === 'eraser' && state.eraserMode === 'pixel')) {
      renderOverlay();
      overlayCanvas.style.cursor = 'none'; 
    } else if (state.activeTool === 'eraser' && state.eraserMode === 'object') {
      const hoverObj = getObjectAt(pos);
      overlayCanvas.style.cursor = hoverObj ? 'pointer' : 'crosshair';
      renderOverlay();
    } else if (state.activeTool === 'select') {
      const selObj = getSelectedObject();
      if (selObj) {
        const bounds = getObjectBounds(selObj);
        const handle = getHandleAt(pos, bounds);
        if (handle) {
          overlayCanvas.style.cursor = (handle === 'nw' || handle === 'se') ? 'nwse-resize' : 'nesw-resize';
          return;
        }
      }
      const hoverObj = getObjectAt(pos);
      overlayCanvas.style.cursor = hoverObj ? 'move' : 'default';
    } else {
      overlayCanvas.style.cursor = 'crosshair';
    }
    return;
  }

  const tool = state.activeTool;

  if (tool === 'pencil' || tool === 'eraser') {
    const val = (tool === 'pencil') ? 1 : 0;
    if (state.lastBrushPos) {
      applyBrushLine(state.lastBrushPos.x, state.lastBrushPos.y, pos.x, pos.y, val, state.brushSize);
    } else {
      applyBrush(pos.x, pos.y, val, state.brushSize);
    }
    state.lastBrushPos = { ...pos };
    renderOled();
    renderOverlay();
    return;
  }

  if (tool === 'select' && state.dragMode === 'move') {
    const selObj = getSelectedObject();
    if (!selObj || !state.initialObjState) return;

    const dx = pos.x - state.dragStart.x;
    const dy = pos.y - state.dragStart.y;

    if (selObj.type === 'line') {
      selObj.x1 = Math.max(0, Math.min(SCREEN_WIDTH - 1, state.initialObjState.x1 + dx));
      selObj.y1 = Math.max(0, Math.min(SCREEN_HEIGHT - 1, state.initialObjState.y1 + dy));
      selObj.x2 = Math.max(0, Math.min(SCREEN_WIDTH - 1, state.initialObjState.x2 + dx));
      selObj.y2 = Math.max(0, Math.min(SCREEN_HEIGHT - 1, state.initialObjState.y2 + dy));
    } else {
      selObj.x = Math.max(0, Math.min(SCREEN_WIDTH - 1, state.initialObjState.x + dx));
      selObj.y = Math.max(0, Math.min(SCREEN_HEIGHT - 1, state.initialObjState.y + dy));
    }

    updatePropertiesFormValues(selObj);
    renderAll();
    return;
  }

  if (tool === 'select' && state.dragMode === 'resize') {
    const selObj = getSelectedObject();
    if (!selObj || !state.initialObjState) return;

    const init = state.initialObjState;
    const dx = pos.x - state.dragStart.x;
    const dy = pos.y - state.dragStart.y;

    if (selObj.type === 'rect' || selObj.type === 'filled_rect' || selObj.type === 'bitmap') {
      const lockAspect = (selObj.type === 'bitmap' || e.shiftKey);

      if (state.resizeHandle === 'se') {
        let newW = Math.max(2, init.w + dx);
        let newH = Math.max(2, init.h + dy);
        if (lockAspect) {
          const scale = Math.max(newW / init.w, newH / init.h);
          newW = Math.max(2, Math.round(init.w * scale));
          newH = Math.max(2, Math.round(init.h * scale));
        }
        selObj.w = newW;
        selObj.h = newH;
      } else if (state.resizeHandle === 'sw') {
        let newW = Math.max(2, init.w - dx);
        let newH = Math.max(2, init.h + dy);
        if (lockAspect) {
          const scale = Math.max(newW / init.w, newH / init.h);
          newW = Math.max(2, Math.round(init.w * scale));
          newH = Math.max(2, Math.round(init.h * scale));
        }
        selObj.x = init.x + (init.w - newW);
        selObj.w = newW;
        selObj.h = newH;
      } else if (state.resizeHandle === 'ne') {
        let newW = Math.max(2, init.w + dx);
        let newH = Math.max(2, init.h - dy);
        if (lockAspect) {
          const scale = Math.max(newW / init.w, newH / init.h);
          newW = Math.max(2, Math.round(init.w * scale));
          newH = Math.max(2, Math.round(init.h * scale));
        }
        selObj.y = init.y + (init.h - newH);
        selObj.w = newW;
        selObj.h = newH;
      } else if (state.resizeHandle === 'nw') {
        let newW = Math.max(2, init.w - dx);
        let newH = Math.max(2, init.h - dy);
        if (lockAspect) {
          const scale = Math.max(newW / init.w, newH / init.h);
          newW = Math.max(2, Math.round(init.w * scale));
          newH = Math.max(2, Math.round(init.h * scale));
        }
        selObj.x = init.x + (init.w - newW);
        selObj.y = init.y + (init.h - newH);
        selObj.w = newW;
        selObj.h = newH;
      }
    } else if (selObj.type === 'circle' || selObj.type === 'filled_circle') {
      const dist = Math.round(Math.hypot(pos.x - selObj.x, pos.y - selObj.y));
      selObj.r = Math.max(2, dist);
    }

    updatePropertiesFormValues(selObj);
    renderAll();
    return;
  }

  if (state.dragMode === 'create') {
    const x0 = Math.min(state.dragStart.x, pos.x);
    const y0 = Math.min(state.dragStart.y, pos.y);
    const w = Math.max(1, Math.abs(pos.x - state.dragStart.x));
    const h = Math.max(1, Math.abs(pos.y - state.dragStart.y));

    if (tool === 'rect' || tool === 'filled_rect') {
      state.creationPreview = {
        type: tool,
        x: x0,
        y: y0,
        w: w,
        h: h
      };
    } else if (tool === 'circle' || tool === 'filled_circle') {
      const radius = Math.round(Math.hypot(pos.x - state.dragStart.x, pos.y - state.dragStart.y));
      state.creationPreview = {
        type: tool,
        x: state.dragStart.x,
        y: state.dragStart.y,
        r: radius
      };
    } else if (tool === 'line') {
      state.creationPreview = {
        type: 'line',
        x1: state.dragStart.x,
        y1: state.dragStart.y,
        x2: pos.x,
        y2: pos.y
      };
    }
    renderOled();
  }
});

window.addEventListener('mouseup', () => {
  if (!state.isDrawing) return;
  state.isDrawing = false;
  state.lastBrushPos = null;

  if (state.dragMode === 'create' && state.creationPreview) {
    pushHistory();
    const newObj = {
      id: generateId(),
      name: getReadableObjectName(state.creationPreview.type),
      visible: true,
      ...state.creationPreview
    };
    state.objects.push(newObj);
    state.creationPreview = null;
    selectObject(newObj.id);
    setActiveTool('select');
    renderAll();
    updateArduinoCode();
  }

  state.dragMode = null;
  state.initialObjState = null;
  state.creationPreview = null;
  updateArduinoCode();
});

overlayCanvas.addEventListener('mouseleave', () => {
  mouseCoordText.textContent = 'X: --, Y: --';
  state.currentMousePos = { x: -1, y: -1 };
  renderOverlay();
});

function getReadableObjectName(type) {
  if (typeof t === 'function') {
    switch (type) {
      case 'rect': return t('obj_rect');
      case 'filled_rect': return t('obj_filled_rect');
      case 'circle': return t('obj_circle');
      case 'filled_circle': return t('obj_filled_circle');
      case 'line': return t('obj_line');
      case 'text': return t('obj_text');
      case 'bitmap': return t('obj_bitmap');
      default: return t('obj_default');
    }
  }
  switch (type) {
    case 'rect': return 'Kutu';
    case 'filled_rect': return 'Dolu Kutu';
    case 'circle': return 'Çember';
    case 'filled_circle': return 'Dolu Çember';
    case 'line': return 'Çizgi';
    case 'text': return 'Metin';
    case 'bitmap': return 'Resim / İkon';
    default: return 'Nesne';
  }
}

function setActiveTool(toolName) {
  state.activeTool = toolName;
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === toolName);
  });
  if (toolName === 'pencil' || toolName === 'eraser') {
    selectObject(null);
  }
  updatePropertiesPanel();
  renderOverlay();
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveTool(btn.dataset.tool);
  });
});

document.querySelectorAll('.btn-brush-size').forEach(btn => {
  btn.addEventListener('click', () => {
    state.brushSize = parseInt(btn.dataset.size) || 1;
    updatePropertiesPanel();
    renderOverlay();
  });
});

document.querySelectorAll('.btn-eraser-mode').forEach(btn => {
  btn.addEventListener('click', () => {
    state.eraserMode = btn.dataset.mode;
    updatePropertiesPanel();
    renderOverlay();
  });
});

btnZoomIn.addEventListener('click', () => {
  if (state.zoom < 10) {
    state.zoom++;
    updateZoomDisplay();
  }
});

btnZoomOut.addEventListener('click', () => {
  if (state.zoom > 2) {
    state.zoom--;
    updateZoomDisplay();
  }
});

btnToggleGrid.addEventListener('click', () => {
  state.showGrid = !state.showGrid;
  btnToggleGrid.classList.toggle('active', state.showGrid);
  renderOverlay();
});

btnInvert.addEventListener('click', () => {
  state.inverted = !state.inverted;
  btnInvert.classList.toggle('active', state.inverted);
  renderAll();
  updateArduinoCode();
});

oledColorSelect.addEventListener('change', (e) => {
  state.oledColor = e.target.value;
  updateColorTheme();
});

function changeScreenProfile(profileKey) {
  const profile = SCREEN_PROFILES[profileKey];
  if (!profile) return;

  pushHistory();
  state.screenProfile = profileKey;
  SCREEN_WIDTH = profile.width;
  SCREEN_HEIGHT = profile.height;

  oledCanvas.width = SCREEN_WIDTH;
  oledCanvas.height = SCREEN_HEIGHT;
  overlayCanvas.width = SCREEN_WIDTH;
  overlayCanvas.height = SCREEN_HEIGHT;

  state.screens.forEach(s => {
    s.pixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    s.erasedPixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    s.undoStack = [];
    s.redoStack = [];
  });
  const act = getActiveScreen();
  state.pixels = act.pixels;
  state.erasedPixels = act.erasedPixels;

  const pcbModel = document.querySelector('.pcb-model-text');
  if (pcbModel) pcbModel.textContent = profile.pcbText;

  updateZoomDisplay();
  renderScreensTabBar();
  renderAll();
  updateArduinoCode();
}

if (screenTypeSelect) {
  screenTypeSelect.addEventListener('change', (e) => {
    changeScreenProfile(e.target.value);
  });
}

btnClearAll.addEventListener('click', () => {
  if (state.objects.length === 0 && state.pixels.every(p => p === 0) && state.erasedPixels.every(p => p === 0)) return;
  const currentScreen = getActiveScreen();
  const screenTitle = currentScreen ? currentScreen.name : 'bu ekranı';
  const confirmMsg = typeof t === 'function'
    ? t('confirm_clear_all', { name: screenTitle })
    : `"${screenTitle}" ekranındaki tüm çizimleri ve nesneleri temizlemek istediğinize emin misiniz?`;
  if (confirm(confirmMsg)) {
    pushHistory();
    state.pixels.fill(0);
    state.erasedPixels.fill(0);
    state.objects = [];
    selectObject(null);
    syncActiveScreen();
    renderScreensTabBar();
    renderAll();
    updateArduinoCode();
  }
});

btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

function updatePropertiesPanel() {
  const tool = state.activeTool;

  if (tool === 'pencil' || tool === 'eraser') {
    if (noSelectionMsg) noSelectionMsg.style.display = 'none';
    if (propertiesForm) propertiesForm.style.display = 'none';
    if (brushPropertiesForm) brushPropertiesForm.style.display = 'flex';
    if (btnDeleteSelected) btnDeleteSelected.disabled = true;

    if (tool === 'pencil') {
      if (brushPropertiesForm) brushPropertiesForm.classList.remove('is-eraser');
      if (propertiesPanelHeading) propertiesPanelHeading.textContent = typeof t === 'function' ? t('heading_pencil_settings') : 'KALEM AYARLARI';
      if (eraserModeField) eraserModeField.style.display = 'none';
      if (brushSizeField) brushSizeField.style.display = 'block';
      if (brushTitleLabel) brushTitleLabel.textContent = typeof t === 'function' ? t('label_pencil_thickness') : 'Kalem Kalınlığı';
      selectionStatus.textContent = typeof t === 'function' ? t('status_tool_pencil', { size: state.brushSize }) : `Araç: Kalem (${state.brushSize} px)`;
    } else {
      if (brushPropertiesForm) brushPropertiesForm.classList.add('is-eraser');
      if (propertiesPanelHeading) propertiesPanelHeading.textContent = typeof t === 'function' ? t('heading_eraser_settings') : 'SİLGİ AYARLARI';
      if (eraserModeField) eraserModeField.style.display = 'block';
      document.querySelectorAll('.btn-eraser-mode').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.eraserMode);
      });

      if (state.eraserMode === 'pixel') {
        if (brushSizeField) brushSizeField.style.display = 'block';
        if (brushTitleLabel) brushTitleLabel.textContent = typeof t === 'function' ? t('label_eraser_size') : 'Silgi Boyutu';
        selectionStatus.textContent = typeof t === 'function' ? t('status_tool_eraser', { size: state.brushSize }) : `Araç: Silgi (${state.brushSize} px)`;
      } else {
        if (brushSizeField) brushSizeField.style.display = 'none';
        selectionStatus.textContent = typeof t === 'function' ? t('status_tool_eraser_obj') : 'Araç: Nesne Silgisi (Tek Tıkla Sil)';
      }
    }

    document.querySelectorAll('.btn-brush-size').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.size) === state.brushSize);
    });

    return;
  }

  if (brushPropertiesForm) brushPropertiesForm.style.display = 'none';
  if (propertiesPanelHeading) propertiesPanelHeading.textContent = typeof t === 'function' ? t('heading_properties') : 'ÖZELLİKLER';

  const selObj = getSelectedObject();
  if (!selObj) {
    if (noSelectionMsg) noSelectionMsg.style.display = 'flex';
    if (propertiesForm) propertiesForm.style.display = 'none';
    if (bitmapSpecificProps) bitmapSpecificProps.style.display = 'none';
    if (btnDeleteSelected) btnDeleteSelected.disabled = true;
    selectionStatus.textContent = typeof t === 'function' ? t('status_no_selection') : 'Seçili: Hiçbir nesne seçilmedi';
    return;
  }

  if (noSelectionMsg) noSelectionMsg.style.display = 'none';
  if (propertiesForm) propertiesForm.style.display = 'flex';
  if (btnDeleteSelected) btnDeleteSelected.disabled = false;
  selectionStatus.textContent = typeof t === 'function' 
    ? t('status_selected', { name: selObj.name, type: getReadableObjectName(selObj.type) })
    : `Seçili: ${selObj.name} (${selObj.type})`;

  updatePropertiesFormValues(selObj);
}

function updatePropertiesFormValues(obj) {
  if (obj.type === 'line') {
    propX.value = obj.x1;
    propY.value = obj.y1;
    propW.value = Math.abs(obj.x2 - obj.x1);
    propH.value = Math.abs(obj.y2 - obj.y1);
    dimensionProps.style.display = 'grid';
    textSpecificProps.style.display = 'none';
    shapeSpecificProps.style.display = 'none';
    if (bitmapSpecificProps) bitmapSpecificProps.style.display = 'none';
  } else if (obj.type === 'text') {
    propX.value = obj.x;
    propY.value = obj.y;
    dimensionProps.style.display = 'none';
    textSpecificProps.style.display = 'block';
    propText.value = obj.text;
    propTextSize.value = obj.size;
    shapeSpecificProps.style.display = 'none';
    if (bitmapSpecificProps) bitmapSpecificProps.style.display = 'none';
  } else if (obj.type === 'circle' || obj.type === 'filled_circle') {
    propX.value = obj.x;
    propY.value = obj.y;
    dimensionProps.style.display = 'grid';
    document.getElementById('fieldW').querySelector('label').textContent = typeof t === 'function' ? t('label_r') : 'Yarıçap (R)';
    propW.value = obj.r;
    document.getElementById('fieldH').style.display = 'none';
    textSpecificProps.style.display = 'none';
    shapeSpecificProps.style.display = 'block';
    propFilled.checked = obj.type === 'filled_circle';
    if (bitmapSpecificProps) bitmapSpecificProps.style.display = 'none';
  } else if (obj.type === 'bitmap') {
    propX.value = obj.x;
    propY.value = obj.y;
    dimensionProps.style.display = 'grid';
    document.getElementById('fieldW').querySelector('label').textContent = typeof t === 'function' ? t('label_w') : 'Genişlik (W)';
    document.getElementById('fieldH').style.display = 'flex';
    propW.value = obj.w;
    propH.value = obj.h;
    textSpecificProps.style.display = 'none';
    shapeSpecificProps.style.display = 'none';
    if (bitmapSpecificProps) {
      bitmapSpecificProps.style.display = 'flex';
      const thresh = obj.threshold !== undefined ? obj.threshold : 128;
      if (propBitmapThreshold) propBitmapThreshold.value = thresh;
      if (propBitmapThresholdVal) propBitmapThresholdVal.textContent = thresh;
      if (propBitmapMode) propBitmapMode.value = obj.ditherMode || 'threshold';
      if (propBitmapInvert) propBitmapInvert.checked = !!obj.inverted;
    }
  } else {
    propX.value = obj.x;
    propY.value = obj.y;
    dimensionProps.style.display = 'grid';
    document.getElementById('fieldW').querySelector('label').textContent = typeof t === 'function' ? t('label_w') : 'Genişlik (W)';
    document.getElementById('fieldH').style.display = 'flex';
    propW.value = obj.w;
    propH.value = obj.h;
    textSpecificProps.style.display = 'none';

    if (obj.type === 'rect' || obj.type === 'filled_rect') {
      shapeSpecificProps.style.display = 'block';
      propFilled.checked = obj.type === 'filled_rect';
    } else {
      shapeSpecificProps.style.display = 'none';
    }
    if (bitmapSpecificProps) bitmapSpecificProps.style.display = 'none';
  }
}

propX.addEventListener('input', () => {
  const selObj = getSelectedObject();
  if (!selObj) return;
  const val = parseInt(propX.value) || 0;
  if (selObj.type === 'line') {
    const diff = val - selObj.x1;
    selObj.x1 = val;
    selObj.x2 += diff;
  } else {
    selObj.x = val;
  }
  renderAll();
  updateArduinoCode();
});

propY.addEventListener('input', () => {
  const selObj = getSelectedObject();
  if (!selObj) return;
  const val = parseInt(propY.value) || 0;
  if (selObj.type === 'line') {
    const diff = val - selObj.y1;
    selObj.y1 = val;
    selObj.y2 += diff;
  } else {
    selObj.y = val;
  }
  renderAll();
  updateArduinoCode();
});

propW.addEventListener('input', () => {
  const selObj = getSelectedObject();
  if (!selObj) return;
  const val = parseInt(propW.value) || 1;
  if (selObj.type === 'circle' || selObj.type === 'filled_circle') {
    selObj.r = val;
  } else if (selObj.type === 'line') {
    selObj.x2 = selObj.x1 + val;
  } else {
    selObj.w = val;
  }
  renderAll();
  updateArduinoCode();
});

propH.addEventListener('input', () => {
  const selObj = getSelectedObject();
  if (!selObj) return;
  const val = parseInt(propH.value) || 1;
  if (selObj.type === 'line') {
    selObj.y2 = selObj.y1 + val;
  } else {
    selObj.h = val;
  }
  renderAll();
  updateArduinoCode();
});

propText.addEventListener('input', () => {
  const selObj = getSelectedObject();
  if (!selObj || selObj.type !== 'text') return;
  selObj.text = propText.value;
  renderAll();
  updateArduinoCode();
});

propTextSize.addEventListener('change', () => {
  const selObj = getSelectedObject();
  if (!selObj || selObj.type !== 'text') return;
  selObj.size = parseInt(propTextSize.value) || 1;
  renderAll();
  updateArduinoCode();
});

propFilled.addEventListener('change', () => {
  const selObj = getSelectedObject();
  if (!selObj) return;
  if (selObj.type === 'rect' || selObj.type === 'filled_rect') {
    selObj.type = propFilled.checked ? 'filled_rect' : 'rect';
  } else if (selObj.type === 'circle' || selObj.type === 'filled_circle') {
    selObj.type = propFilled.checked ? 'filled_circle' : 'circle';
  }
  renderAll();
  updateArduinoCode();
});

function recomputeBitmapData(obj) {
  if (!obj || obj.type !== 'bitmap') return;

  const w = obj.origW || obj.w;
  const h = obj.origH || obj.h;

  if (!obj.rawRgba && obj.data) {
    obj.rawRgba = new Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = obj.data[i] ? 255 : 0;
      obj.rawRgba[i * 4] = v;
      obj.rawRgba[i * 4 + 1] = v;
      obj.rawRgba[i * 4 + 2] = v;
      obj.rawRgba[i * 4 + 3] = 255;
    }
  }

  if (!obj.rawRgba) return;

  const thresh = obj.threshold !== undefined ? obj.threshold : 128;
  const inverted = !!obj.inverted;
  const mode = obj.ditherMode || 'threshold';
  const alphaThresh = obj.alphaThreshold !== undefined ? obj.alphaThreshold : 50;
  const out = new Array(w * h);

  if (mode === 'dither') {

    const lumBuf = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = obj.rawRgba[i * 4 + 3];
      if (a < alphaThresh) {
        lumBuf[i] = 0;
      } else {
        const r = obj.rawRgba[i * 4];
        const g = obj.rawRgba[i * 4 + 1];
        const b = obj.rawRgba[i * 4 + 2];
        lumBuf[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = lumBuf[idx];
        const a = obj.rawRgba[idx * 4 + 3];

        if (a < alphaThresh) {
          out[idx] = 0;
          continue;
        }

        const newVal = oldVal >= thresh ? 255 : 0;
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

    for (let i = 0; i < w * h; i++) {
      const a = obj.rawRgba[i * 4 + 3];
      if (a < alphaThresh) {
        out[i] = 0;
      } else {
        const r = obj.rawRgba[i * 4];
        const g = obj.rawRgba[i * 4 + 1];
        const b = obj.rawRgba[i * 4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const bit = lum >= thresh ? 1 : 0;
        out[i] = inverted ? (1 - bit) : bit;
      }
    }
  }

  obj.data = out;
}

if (propBitmapThreshold) {
  propBitmapThreshold.addEventListener('input', (e) => {
    const selObj = getSelectedObject();
    if (!selObj || selObj.type !== 'bitmap') return;
    const val = parseInt(e.target.value, 10);
    selObj.threshold = val;
    propBitmapThresholdVal.textContent = val;
    recomputeBitmapData(selObj);
    renderAll();
    updateArduinoCode();
  });

  propBitmapThreshold.addEventListener('change', () => {
    pushHistory();
  });
}

if (propBitmapMode) {
  propBitmapMode.addEventListener('change', (e) => {
    const selObj = getSelectedObject();
    if (!selObj || selObj.type !== 'bitmap') return;
    pushHistory();
    selObj.ditherMode = e.target.value;
    recomputeBitmapData(selObj);
    renderAll();
    updateArduinoCode();
  });
}

if (propBitmapInvert) {
  propBitmapInvert.addEventListener('change', (e) => {
    const selObj = getSelectedObject();
    if (!selObj || selObj.type !== 'bitmap') return;
    pushHistory();
    selObj.inverted = e.target.checked;
    recomputeBitmapData(selObj);
    renderAll();
    updateArduinoCode();
  });
}

btnDeleteSelected.addEventListener('click', deleteSelectedObject);

function deleteSelectedObject() {
  const selObj = getSelectedObject();
  if (!selObj) return;
  pushHistory();
  state.objects = state.objects.filter(o => o.id !== selObj.id);
  selectObject(null);
  renderAll();
  updateArduinoCode();
}

document.getElementById('btnAlignLeft').addEventListener('click', () => {
  const sel = getSelectedObject();
  if (!sel) return;
  pushHistory();
  if (sel.type === 'line') {
    const min = Math.min(sel.x1, sel.x2);
    sel.x1 -= min;
    sel.x2 -= min;
  } else if (sel.type === 'circle' || sel.type === 'filled_circle') {
    sel.x = sel.r;
  } else {
    sel.x = 0;
  }
  updatePropertiesFormValues(sel);
  renderAll();
});

document.getElementById('btnAlignCenterH').addEventListener('click', () => {
  const sel = getSelectedObject();
  if (!sel) return;
  pushHistory();
  const b = getObjectBounds(sel);
  const targetX = Math.round((SCREEN_WIDTH - b.w) / 2);
  const dx = targetX - b.x;

  if (sel.type === 'line') {
    sel.x1 += dx;
    sel.x2 += dx;
  } else if (sel.type === 'circle' || sel.type === 'filled_circle') {
    sel.x = Math.round(SCREEN_WIDTH / 2);
  } else {
    sel.x += dx;
  }
  updatePropertiesFormValues(sel);
  renderAll();
});

document.getElementById('btnAlignRight').addEventListener('click', () => {
  const sel = getSelectedObject();
  if (!sel) return;
  pushHistory();
  const b = getObjectBounds(sel);
  const targetX = SCREEN_WIDTH - b.w;
  const dx = targetX - b.x;

  if (sel.type === 'line') {
    sel.x1 += dx;
    sel.x2 += dx;
  } else if (sel.type === 'circle' || sel.type === 'filled_circle') {
    sel.x = SCREEN_WIDTH - sel.r;
  } else {
    sel.x += dx;
  }
  updatePropertiesFormValues(sel);
  renderAll();
});

document.getElementById('btnAlignCenterV').addEventListener('click', () => {
  const sel = getSelectedObject();
  if (!sel) return;
  pushHistory();
  const b = getObjectBounds(sel);
  const targetY = Math.round((SCREEN_HEIGHT - b.h) / 2);
  const dy = targetY - b.y;

  if (sel.type === 'line') {
    sel.y1 += dy;
    sel.y2 += dy;
  } else if (sel.type === 'circle' || sel.type === 'filled_circle') {
    sel.y = Math.round(SCREEN_HEIGHT / 2);
  } else {
    sel.y += dy;
  }
  updatePropertiesFormValues(sel);
  renderAll();
});

function renderLayersList() {
  layersList.innerHTML = '';
  layersCount.textContent = typeof t === 'function' 
    ? t('layers_count', { count: state.objects.length }) 
    : `${state.objects.length} nesne`;

  if (state.objects.length === 0) {
    const emptyText = typeof t === 'function' ? t('no_layers_yet') : 'Henüz nesne yok';
    layersList.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-dim);font-size:11px;">${emptyText}</div>`;
    return;
  }

  const tipToggle = typeof t === 'function' ? t('layer_toggle_visibility') : 'Gizle / Göster';
  const tipUp = typeof t === 'function' ? t('layer_move_up') : 'Yukarı Taşı';
  const tipDown = typeof t === 'function' ? t('layer_move_down') : 'Aşağı Taşı';

  for (let i = state.objects.length - 1; i >= 0; i--) {
    const obj = state.objects[i];
    const isSelected = (obj.id === state.selectedId);

    const item = document.createElement('div');
    item.className = `layer-item ${isSelected ? 'active' : ''}`;

    item.innerHTML = `
      <div class="layer-name">
        <span style="opacity:0.6;font-size:10px;">#${i+1}</span>
        <span>${escapeHtml(obj.name || obj.type)}</span>
      </div>
      <div class="layer-actions">
        <button class="layer-mini-btn btn-toggle-vis" title="${tipToggle}">
          ${obj.visible !== false ? `
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ` : `
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          `}
        </button>
        <button class="layer-mini-btn btn-layer-up" title="${tipUp}">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="layer-mini-btn btn-layer-down" title="${tipDown}">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.layer-actions')) return;
      selectObject(obj.id);
      setActiveTool('select');
      renderAll();
    });

    item.querySelector('.btn-toggle-vis').addEventListener('click', () => {
      pushHistory();
      obj.visible = (obj.visible === false);
      renderAll();
      updateArduinoCode();
    });

    item.querySelector('.btn-layer-up').addEventListener('click', () => {
      if (i < state.objects.length - 1) {
        pushHistory();
        const tmp = state.objects[i];
        state.objects[i] = state.objects[i + 1];
        state.objects[i + 1] = tmp;
        renderAll();
        updateArduinoCode();
      }
    });

    item.querySelector('.btn-layer-down').addEventListener('click', () => {
      if (i > 0) {
        pushHistory();
        const tmp = state.objects[i];
        state.objects[i] = state.objects[i - 1];
        state.objects[i - 1] = tmp;
        renderAll();
        updateArduinoCode();
      }
    });

    layersList.appendChild(item);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
