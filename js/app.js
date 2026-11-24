if (btnExportJson) {
  btnExportJson.addEventListener('click', () => {
    syncActiveScreen();
    const projectData = {
      version: '2.0',
      title: 'OLED_MultiScreen_Project',
      inverted: state.inverted,
      oledColor: state.oledColor,
      screenProfile: state.screenProfile,
      screens: state.screens.map(s => ({
        id: s.id,
        name: s.name,
        pixels: Array.from(s.pixels),
        erasedPixels: Array.from(s.erasedPixels),
        objects: s.objects
      })),
      activeScreenId: state.activeScreenId
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'oled_project.json');
  });
}

inputFileJson.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      if (typeof data.inverted === 'boolean') {
        state.inverted = data.inverted;
        btnInvert.classList.toggle('active', state.inverted);
      }
      if (data.oledColor) {
        state.oledColor = data.oledColor;
        oledColorSelect.value = state.oledColor;
        updateColorTheme();
      }
      if (data.screenProfile && SCREEN_PROFILES[data.screenProfile]) {
        changeScreenProfile(data.screenProfile);
      }

      if (data.screens && Array.isArray(data.screens) && data.screens.length > 0) {
        state.screens = data.screens.map(s => ({
          id: s.id || ('screen_' + generateId()),
          name: s.name || (typeof t === 'function' ? t('default_screen_name') : 'Screen'),
          objects: s.objects || [],
          pixels: s.pixels ? new Uint8Array(s.pixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
          erasedPixels: s.erasedPixels ? new Uint8Array(s.erasedPixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
          undoStack: [],
          redoStack: []
        }));
        const targetId = (data.activeScreenId && state.screens.some(s => s.id === data.activeScreenId))
          ? data.activeScreenId
          : state.screens[0].id;
        switchScreen(targetId);
      } else {

        state.screens = [{
          id: 'screen_1',
          name: typeof t === 'function' ? `${t('default_screen_name')} 1` : 'Screen 1',
          objects: data.objects || [],
          pixels: data.pixels ? new Uint8Array(data.pixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
          erasedPixels: data.erasedPixels ? new Uint8Array(data.erasedPixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
          undoStack: [],
          redoStack: []
        }];
        switchScreen('screen_1');
      }
    } catch (err) {
      showToast(typeof t === 'function' ? t('alert_invalid_json') : 'Geçersiz JSON proje dosyası!', 'error');
    }
    inputFileJson.value = '';
  };
  reader.readAsText(file);
});

btnExportIno.addEventListener('click', () => {
  const code = generateArduinoCode();
  const scope = codeScopeSelect ? codeScopeSelect.value : 'full_project';
  const filename = (scope === 'modular_header') ? 'screens.h' : 'OledScreenDisplay.ino';
  const blob = new Blob([code], { type: 'text/plain' });
  downloadBlob(blob, filename);
});

function pasteObjectsFromList(sourceList, i18nKey, fallbackSuffix) {
  if (!sourceList || sourceList.length === 0) return;
  pushHistory();
  const newIds = [];
  for (const src of sourceList) {
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = generateId();
    copy.name = `${copy.name || copy.type} (Copy)`;
    if (copy.type === 'line') {
      copy.x1 = Math.min(SCREEN_WIDTH - 1, copy.x1 + 4);
      copy.y1 = Math.min(SCREEN_HEIGHT - 1, copy.y1 + 4);
      copy.x2 = Math.min(SCREEN_WIDTH - 1, copy.x2 + 4);
      copy.y2 = Math.min(SCREEN_HEIGHT - 1, copy.y2 + 4);
    } else {
      copy.x = Math.min(SCREEN_WIDTH - 2, (copy.x || 0) + 4);
      copy.y = Math.min(SCREEN_HEIGHT - 2, (copy.y || 0) + 4);
    }
    state.objects.push(copy);
    newIds.push(copy.id);
  }
  state.selectedIds = newIds;
  state.selectedId = newIds[newIds.length - 1] || null;
  setActiveTool('select');
  updatePropertiesPanel();
  renderAll();
  updateArduinoCode();

  const msg = typeof t === 'function'
    ? t(i18nKey, { count: newIds.length })
    : `${newIds.length} ${fallbackSuffix}`;
  showToast(msg, 'success', 1800);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      e.target.blur();
      return;
    }
    if (tabContextMenu && tabContextMenu.style.display !== 'none') {
      tabContextMenu.style.display = 'none';
      return;
    }
    if (overviewActive) {
      closeOverviewMode();
      return;
    }
    if (codeModalOverlay && codeModalOverlay.style.display !== 'none') {
      closeCodeModal();
      return;
    }
    const iconsModalOverlay = document.getElementById('iconsModalOverlay');
    if (iconsModalOverlay && iconsModalOverlay.style.display !== 'none') {
      if (typeof window.closeIconsModal === 'function') {
        window.closeIconsModal();
      } else {
        iconsModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
      }
      return;
    }
    const animModalOverlay = document.getElementById('animModalOverlay');
    if (animModalOverlay && animModalOverlay.style.display !== 'none') {
      if (typeof window.closeAnimStudio === 'function') {
        window.closeAnimStudio();
      } else {
        animModalOverlay.style.display = 'none';
      }
      return;
    }
    return;
  }

  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if (state.objects.length > 0) {
      state.selectedIds = state.objects.filter(o => o.visible !== false).map(o => o.id);
      state.selectedId = state.selectedIds[state.selectedIds.length - 1] || null;
      setActiveTool('select');
      updatePropertiesPanel();
      renderAll();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    const selObjs = getSelectedObjects();
    if (selObjs.length > 0) {
      e.preventDefault();
      state.clipboard = JSON.parse(JSON.stringify(selObjs));
      const msg = typeof t === 'function'
        ? t('toast_copied_obj', { count: selObjs.length })
        : `${selObjs.length} nesne kopyalandı`;
      showToast(msg, 'info', 1800);
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (state.clipboard && state.clipboard.length > 0) {
      e.preventDefault();
      pasteObjectsFromList(state.clipboard, 'toast_pasted_obj', 'nesne yapıştırıldı');
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    const selObjs = getSelectedObjects();
    if (selObjs.length > 0) {
      e.preventDefault();
      pasteObjectsFromList(selObjs, 'toast_duplicated_obj', 'nesne çoğaltıldı');
    }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedIds.length > 0 || state.selectedId) {
      e.preventDefault();
      deleteSelectedObject();
    }
    return;
  }

  const selObjs = getSelectedObjects();
  if (selObjs.length > 0) {
    const step = e.shiftKey ? 5 : 1;
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;

    if (dx !== 0 || dy !== 0) {
      e.preventDefault();
      pushHistory();
      for (const obj of selObjs) {
        if (obj.type === 'line') {
          obj.x1 += dx; obj.x2 += dx;
          obj.y1 += dy; obj.y2 += dy;
        } else {
          obj.x += dx;
          obj.y += dy;
        }
      }
      if (selObjs.length === 1) updatePropertiesFormValues(selObjs[0]);
      renderAll();
      updateArduinoCode();
      return;
    }
  }

  switch (e.key.toLowerCase()) {
    case 'v': setActiveTool('select'); break;
    case 'p': setActiveTool('pencil'); break;
    case 'e': setActiveTool('eraser'); break;
    case 't': setActiveTool('text'); break;
    case 'l': setActiveTool('line'); break;
    case 'r': setActiveTool('rect'); break;
    case 'c': setActiveTool('circle'); break;
  }
});

function initDefaultScene() {
  state.screens = [
    {
      id: 'screen_1',
      name: typeof t === 'function' ? `${t('default_screen_name')} 1` : 'Screen 1',
      objects: [],
      pixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
      erasedPixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
      undoStack: [],
      redoStack: []
    }
  ];
  state.activeScreenId = 'screen_1';
  state.objects = state.screens[0].objects;
  state.pixels = state.screens[0].pixels;
  state.erasedPixels = state.screens[0].erasedPixels;
  state.undoStack = state.screens[0].undoStack;
  state.redoStack = state.screens[0].redoStack;

  selectObject(null);
  updateZoomDisplay();
  updateColorTheme();
  renderScreensTabBar();
  syncCodeUI();
  renderAll();
  updateArduinoCode();
  updateHistoryButtons();
}

if (typeof onLanguageChange === 'function') {
  onLanguageChange(() => {
    if (state.screens && state.screens.length > 0) {
      const defaultNamePattern = /^(?:Ekran|Screen)\s*(\d+)$/i;
      state.screens.forEach(s => {
        const match = s.name.match(defaultNamePattern);
        if (match) {
          const num = match[1];
          s.name = typeof t === 'function' ? `${t('default_screen_name')} ${num}` : `Screen ${num}`;
        }
      });
    }
    updateZoomDisplay();
    updatePropertiesPanel();
    renderScreensTabBar();
    renderLayersList();
    if (overviewActive) renderFigmaOverview();
    syncCodeUI();
    updateArduinoCode();
  });
}

initDefaultScene();
