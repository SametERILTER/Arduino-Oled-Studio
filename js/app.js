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
      alert(typeof t === 'function' ? t('alert_invalid_json') : 'Geçersiz JSON proje dosyası!');
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
    const animModalOverlay = document.getElementById('animModalOverlay');
    if (animModalOverlay && animModalOverlay.style.display !== 'none') {
      if (typeof window.closeAnimStudio === 'function') {
        window.closeAnimStudio();
      } else {
        animModalOverlay.style.display = 'none';
      }
      return;
    }
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

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedId) {
      e.preventDefault();
      deleteSelectedObject();
    }
    return;
  }

  const selObj = getSelectedObject();
  if (selObj) {
    const step = e.shiftKey ? 5 : 1;
    let moved = false;

    if (e.key === 'ArrowLeft') {
      pushHistory();
      if (selObj.type === 'line') { selObj.x1 -= step; selObj.x2 -= step; }
      else { selObj.x -= step; }
      moved = true;
    } else if (e.key === 'ArrowRight') {
      pushHistory();
      if (selObj.type === 'line') { selObj.x1 += step; selObj.x2 += step; }
      else { selObj.x += step; }
      moved = true;
    } else if (e.key === 'ArrowUp') {
      pushHistory();
      if (selObj.type === 'line') { selObj.y1 -= step; selObj.y2 -= step; }
      else { selObj.y -= step; }
      moved = true;
    } else if (e.key === 'ArrowDown') {
      pushHistory();
      if (selObj.type === 'line') { selObj.y1 += step; selObj.y2 += step; }
      else { selObj.y += step; }
      moved = true;
    }

    if (moved) {
      e.preventDefault();
      updatePropertiesFormValues(selObj);
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
