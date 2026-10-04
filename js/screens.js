const btnOverviewMode = document.getElementById('btnOverviewMode');
const figmaOverviewContainer = document.getElementById('figmaOverviewContainer');
const figmaCanvasViewport = document.getElementById('figmaCanvasViewport');
const figmaCanvasTransform = document.getElementById('figmaCanvasTransform');
const figmaArtboardsGrid = document.getElementById('figmaArtboardsGrid');
const overviewScreenCount = document.getElementById('overviewScreenCount');
const overviewZoomLabel = document.getElementById('overviewZoomLabel');
const btnOverviewZoomIn = document.getElementById('btnOverviewZoomIn');
const btnOverviewZoomOut = document.getElementById('btnOverviewZoomOut');
const btnOverviewFit = document.getElementById('btnOverviewFit');
const btnCloseOverview = document.getElementById('btnCloseOverview');

const tabContextMenu = document.getElementById('tabContextMenu');
const menuRenameTab = document.getElementById('menuRenameTab');
const menuClearTab = document.getElementById('menuClearTab');
const menuCloseTab = document.getElementById('menuCloseTab');

let contextMenuTargetScreen = null;
let contextMenuTargetTab = null;

function getActiveScreen() {
  return state.screens.find(s => s.id === state.activeScreenId) || state.screens[0];
}

function syncActiveScreen() {
  const s = getActiveScreen();
  if (s) {
    s.objects = state.objects;
    s.pixels = state.pixels;
    s.erasedPixels = state.erasedPixels;
    s.undoStack = state.undoStack;
    s.redoStack = state.redoStack;
  }
}

let lastAddedScreenId = null;

function startRenameTab(screen, nameSpan) {
  if (!nameSpan || !screen) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'screen-tab-input';
  input.value = screen.name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finishRename = () => {
    if (finished) return;
    finished = true;
    const val = input.value.trim();
    if (val) {
      screen.name = val;
    }
    renderScreensTabBar();
    if (overviewActive) renderFigmaOverview();
    updateArduinoCode();
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (ke) => {
    if (ke.key === 'Enter') {
      input.blur();
    } else if (ke.key === 'Escape') {
      input.value = screen.name;
      input.blur();
    }
  });
}

function updateTabBarActiveState() {
  if (!screenTabsList) return;
  const tabs = screenTabsList.querySelectorAll('.screen-tab');
  if (tabs.length !== state.screens.length) {
    renderScreensTabBar();
    return;
  }
  tabs.forEach((tab, idx) => {
    const s = state.screens[idx];
    if (!s) return;
    tab.dataset.screenId = s.id;
    tab.classList.toggle('active', s.id === state.activeScreenId);
    const badge = tab.querySelector('.screen-tab-badge');
    if (badge) badge.textContent = `${s.objects.length}`;
    const nameSpan = tab.querySelector('.screen-tab-name');
    if (nameSpan) nameSpan.textContent = s.name;
  });
}

function renderScreensTabBar() {
  if (!screenTabsList) return;
  screenTabsList.innerHTML = '';

  state.screens.forEach((screen, index) => {
    const isActive = screen.id === state.activeScreenId;
    const tab = document.createElement('div');
    tab.className = `screen-tab ${isActive ? 'active' : ''}`;
    tab.dataset.screenId = screen.id;
    tab.title = typeof t === 'function' ? t('tab_title_tooltip', { name: screen.name }) : `${screen.name} (Click to select, double click or right click to rename)`;

    if (screen.id === lastAddedScreenId) {
      tab.classList.add('tab-entering');
      setTimeout(() => {
        tab.classList.remove('tab-entering');
      }, 250);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'screen-tab-name';
    nameSpan.textContent = screen.name;

    nameSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRenameTab(screen, nameSpan);
    });

    tab.appendChild(nameSpan);

    const badge = document.createElement('span');
    badge.className = 'screen-tab-badge';
    const objCount = screen.objects.length;
    badge.textContent = `${objCount}`;
    badge.title = typeof t === 'function' ? t('objects_count_badge', { count: objCount }) : `${objCount} nesne`;
    tab.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'screen-tab-actions';

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-tab-action danger';
    btnDel.title = typeof t === 'function' ? t('close_screen') : 'Close Screen';
    btnDel.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteScreen(screen.id, tab);
    });
    actions.appendChild(btnDel);
    tab.appendChild(actions);

    tab.addEventListener('click', () => {
      if (state.activeScreenId !== screen.id) {
        switchScreen(screen.id);
      }
    });

    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuTargetScreen = screen;
      contextMenuTargetTab = tab;
      if (tabContextMenu) {
        tabContextMenu.style.display = 'block';
        tabContextMenu.style.left = `${Math.min(window.innerWidth - 180, e.clientX)}px`;
        tabContextMenu.style.top = `${Math.min(window.innerHeight - 140, e.clientY)}px`;
      }
    });

    screenTabsList.appendChild(tab);
  });

  lastAddedScreenId = null;
}

if (menuRenameTab) {
  menuRenameTab.addEventListener('click', () => {
    if (tabContextMenu) tabContextMenu.style.display = 'none';
    if (contextMenuTargetTab && contextMenuTargetScreen) {
      const nameSpan = contextMenuTargetTab.querySelector('.screen-tab-name');
      startRenameTab(contextMenuTargetScreen, nameSpan);
    }
  });
}

if (menuClearTab) {
  menuClearTab.addEventListener('click', () => {
    if (tabContextMenu) tabContextMenu.style.display = 'none';
    if (contextMenuTargetScreen) {
      const confirmMsg = typeof t === 'function' 
        ? t('confirm_clear_screen', { name: contextMenuTargetScreen.name })
        : `"${contextMenuTargetScreen.name}" ekranındaki tüm çizimleri temizlemek istediğinize emin misiniz?`;
      if (confirm(confirmMsg)) {
        contextMenuTargetScreen.objects = [];
        contextMenuTargetScreen.pixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
        contextMenuTargetScreen.erasedPixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
        contextMenuTargetScreen.undoStack = [];
        contextMenuTargetScreen.redoStack = [];
        if (state.activeScreenId === contextMenuTargetScreen.id) {
          state.objects = [];
          state.pixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          state.erasedPixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
          state.undoStack = [];
          state.redoStack = [];
          renderAll();
        }
        renderScreensTabBar();
        if (overviewActive) renderFigmaOverview();
        updateArduinoCode();
      }
    }
  });
}

if (menuCloseTab) {
  menuCloseTab.addEventListener('click', () => {
    if (tabContextMenu) tabContextMenu.style.display = 'none';
    if (contextMenuTargetScreen && contextMenuTargetTab) {
      deleteScreen(contextMenuTargetScreen.id, contextMenuTargetTab);
    }
  });
}

window.addEventListener('click', (e) => {
  if (tabContextMenu && !tabContextMenu.contains(e.target)) {
    tabContextMenu.style.display = 'none';
  }
});

function switchScreen(screenId) {
  syncActiveScreen();
  const screen = state.screens.find(s => s.id === screenId);
  if (!screen) return;

  state.activeScreenId = screenId;
  state.objects = screen.objects;
  state.pixels = screen.pixels;
  state.erasedPixels = screen.erasedPixels;
  state.undoStack = screen.undoStack || [];
  state.redoStack = screen.redoStack || [];

  state.isDrawing = false;
  state.dragMode = null;
  state.creationPreview = null;
  selectObject(null);
  updateTabBarActiveState();
  renderAll();
  updateArduinoCode();
  updateHistoryButtons();
  if (overviewActive) renderFigmaOverview();
}

function addNewScreen(name) {
  syncActiveScreen();
  const screenNum = state.screens.length + 1;
  const defName = typeof t === 'function' ? `${t('default_screen_name')} ${screenNum}` : `Screen ${screenNum}`;
  const newScreen = {
    id: 'screen_' + generateId(),
    name: name || defName,
    objects: [],
    pixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
    erasedPixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
    undoStack: [],
    redoStack: []
  };
  state.screens.push(newScreen);
  lastAddedScreenId = newScreen.id;
  switchScreen(newScreen.id);
  if (overviewActive) renderFigmaOverview();
}

function deleteScreen(screenId, tabElement) {
  const screen = state.screens.find(s => s.id === screenId);
  if (!screen) return;

  const isLastScreen = state.screens.length <= 1;
  const hasContent = screen.objects.length > 0 || screen.pixels.some(p => p === 1);

  if (isLastScreen) {
    if (hasContent) {
      const confirmLast = typeof t === 'function'
        ? t('confirm_last_screen_clear', { name: screen.name })
        : `"${screen.name}" ekranındaki tüm çizimler temizlenecek. Devam etmek istiyor musunuz?`;
      if (!confirm(confirmLast)) {
        return;
      }
    }
  } else if (hasContent) {
    const confirmDel = typeof t === 'function'
      ? t('confirm_delete_screen', { name: screen.name })
      : `"${screen.name}" adlı ekranı silmek istediğinize emin misiniz?`;
    if (!confirm(confirmDel)) {
      return;
    }
  }

  const executeDelete = () => {
    if (isLastScreen) {
      screen.objects = [];
      screen.pixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
      screen.erasedPixels = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
      screen.undoStack = [];
      screen.redoStack = [];
      screen.name = typeof t === 'function' ? `${t('default_screen_name')} 1` : 'Screen 1';
      lastAddedScreenId = screen.id;
      switchScreen(screen.id);
    } else {
      const idx = state.screens.findIndex(s => s.id === screenId);
      state.screens.splice(idx, 1);

      if (state.activeScreenId === screenId) {
        const nextIdx = Math.max(0, idx - 1);
        switchScreen(state.screens[nextIdx].id);
      } else {
        renderScreensTabBar();
        updateArduinoCode();
      }
    }
    if (overviewActive) renderFigmaOverview();
  };

  if (tabElement) {
    tabElement.classList.add('tab-closing');
    setTimeout(executeDelete, 190);
  } else {
    executeDelete();
  }
}

if (btnAddScreen) {
  btnAddScreen.addEventListener('click', () => addNewScreen());
}

let overviewActive = false;
let overviewScale = 0.85; 
let overviewPanX = 0;
let overviewPanY = 0;
let isOverviewPanning = false;
let startPanX = 0;
let startPanY = 0;

function updateOverviewTransform() {
  if (!figmaCanvasTransform) return;
  figmaCanvasTransform.style.transform = `translate(${overviewPanX}px, ${overviewPanY}px) scale(${overviewScale})`;
  if (overviewZoomLabel) {
    overviewZoomLabel.textContent = `${Math.round(overviewScale * 100)}%`;
  }
}

function openOverviewMode() {
  syncActiveScreen();
  overviewActive = true;
  if (btnOverviewMode) btnOverviewMode.classList.add('active');
  if (figmaOverviewContainer) figmaOverviewContainer.style.display = 'flex';
  renderFigmaOverview();
  updateOverviewTransform();
}

function closeOverviewMode() {
  overviewActive = false;
  if (btnOverviewMode) btnOverviewMode.classList.remove('active');
  if (figmaOverviewContainer) figmaOverviewContainer.style.display = 'none';
}

function toggleOverviewMode() {
  if (overviewActive) {
    closeOverviewMode();
  } else {
    openOverviewMode();
  }
}

function renderScreenPreviewToCanvas(screen, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const theme = COLOR_MAP[state.colorTheme] || COLOR_MAP.white;
  const isInv = !!state.inverted;

  ctx.fillStyle = isInv ? theme.pixel : '#000000';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const objBuf = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  for (const obj of screen.objects) {
    if (obj.visible === false) continue;
    drawObjectToBuffer(obj, objBuf);
  }

  for (let i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
    if (screen.erasedPixels[i] === 1) {
      objBuf[i] = 0;
    }
  }

  const imgData = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  const d = imgData.data;

  const hex = theme.pixel;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const bgR = isInv ? r : 0;
  const bgG = isInv ? g : 0;
  const bgB = isInv ? b : 0;

  for (let i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
    const isLit = (screen.pixels[i] === 1 || objBuf[i] === 1);
    const pIdx = i * 4;
    if (isLit) {
      d[pIdx] = isInv ? 0 : r;
      d[pIdx + 1] = isInv ? 0 : g;
      d[pIdx + 2] = isInv ? 0 : b;
      d[pIdx + 3] = 255;
    } else {
      d[pIdx] = bgR;
      d[pIdx + 1] = bgG;
      d[pIdx + 2] = bgB;
      d[pIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function renderFigmaOverview() {
  if (!figmaArtboardsGrid) return;
  figmaArtboardsGrid.innerHTML = '';
  if (overviewScreenCount) {
    overviewScreenCount.textContent = typeof t === 'function' 
      ? t('screens_count', { count: state.screens.length }) 
      : `${state.screens.length} Ekran`;
  }

  state.screens.forEach((screen, index) => {
    const isActive = screen.id === state.activeScreenId;
    const card = document.createElement('div');
    card.className = `figma-artboard-card ${isActive ? 'active' : ''}`;
    card.dataset.screenId = screen.id;

    const header = document.createElement('div');
    header.className = 'artboard-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'artboard-title-group';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'artboard-title';
    titleSpan.textContent = screen.name;
    titleSpan.title = typeof t === 'function' ? t('rename_screen_tooltip') : 'Tıklayarak yeniden adlandırın';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'artboard-rename-btn';
    renameBtn.title = typeof t === 'function' ? t('rename_screen_tooltip') : 'Yeniden Adlandır';
    renameBtn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    const startArtboardRename = (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'artboard-rename-input';
      input.value = screen.name;
      titleSpan.replaceWith(input);
      input.focus();
      input.select();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        const val = input.value.trim();
        if (val) {
          screen.name = val;
        }
        renderScreensTabBar();
        renderFigmaOverview();
        updateArduinoCode();
      };

      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        else if (ke.key === 'Escape') { input.value = screen.name; input.blur(); }
      });
    };

    titleSpan.addEventListener('click', startArtboardRename);
    renameBtn.addEventListener('click', startArtboardRename);

    titleGroup.appendChild(titleSpan);
    titleGroup.appendChild(renameBtn);

    const badgeGroup = document.createElement('div');
    badgeGroup.className = 'artboard-badge-group';

    if (isActive) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'artboard-active-badge';
      activeBadge.textContent = typeof t === 'function' ? t('active_badge') : 'Aktif';
      badgeGroup.appendChild(activeBadge);
    }

    const resTag = document.createElement('span');
    resTag.className = 'artboard-res-tag';
    resTag.textContent = `${SCREEN_WIDTH}×${SCREEN_HEIGHT}`;
    badgeGroup.appendChild(resTag);

    header.appendChild(titleGroup);
    header.appendChild(badgeGroup);
    card.appendChild(header);

    const frame = document.createElement('div');
    frame.className = 'mini-oled-frame';

    const editBtnText = typeof t === 'function' ? t('edit_screen') : 'Ekranı Düzenle';
    frame.innerHTML = `
      <div class="mini-pcb-holes">
        <div class="mini-hole tl"></div>
        <div class="mini-hole tr"></div>
        <div class="mini-hole bl"></div>
        <div class="mini-hole br"></div>
      </div>
      <div class="mini-pcb-pins">
        <span>GND</span><span>VCC</span><span>SCL</span><span>SDA</span>
      </div>
      <div class="mini-oled-screen-bezel">
        <canvas class="mini-oled-canvas" width="${SCREEN_WIDTH}" height="${SCREEN_HEIGHT}"></canvas>
        <div class="artboard-hover-overlay">
          <button class="btn-open-artboard">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>${editBtnText}</span>
          </button>
        </div>
      </div>
    `;

    const canvas = frame.querySelector('.mini-oled-canvas');
    renderScreenPreviewToCanvas(screen, canvas);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.artboard-rename-btn') || e.target.closest('.artboard-rename-input')) return;
      switchScreen(screen.id);
      closeOverviewMode();
    });

    card.appendChild(frame);
    figmaArtboardsGrid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'figma-add-card';
  addCard.title = typeof t === 'function' ? t('add_new_screen_title') : 'Yeni bir OLED ekranı ekle';
  const addScreenText = typeof t === 'function' ? t('add_new_screen') : 'Yeni Ekran Ekle';
  addCard.innerHTML = `
    <div class="figma-add-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <span class="figma-add-text">${addScreenText}</span>
  `;
  addCard.addEventListener('click', () => {
    addNewScreen();
    renderFigmaOverview();
  });
  figmaArtboardsGrid.appendChild(addCard);
}

if (figmaCanvasViewport) {

  figmaCanvasViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    overviewScale = Math.min(3.0, Math.max(0.25, overviewScale * zoomFactor));
    updateOverviewTransform();
  }, { passive: false });

  figmaCanvasViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.artboard-rename-input')) return;
    if (e.target === figmaCanvasViewport || e.target === figmaCanvasTransform || e.target === figmaArtboardsGrid || e.button === 1) {
      isOverviewPanning = true;
      startPanX = e.clientX - overviewPanX;
      startPanY = e.clientY - overviewPanY;
      figmaCanvasViewport.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isOverviewPanning) return;
    overviewPanX = e.clientX - startPanX;
    overviewPanY = e.clientY - startPanY;
    updateOverviewTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isOverviewPanning) {
      isOverviewPanning = false;
      if (figmaCanvasViewport) figmaCanvasViewport.style.cursor = 'grab';
    }
  });
}

if (btnOverviewMode) btnOverviewMode.addEventListener('click', toggleOverviewMode);
if (btnCloseOverview) btnCloseOverview.addEventListener('click', closeOverviewMode);

if (btnOverviewZoomIn) {
  btnOverviewZoomIn.addEventListener('click', () => {
    overviewScale = Math.min(3.0, overviewScale * 1.2);
    updateOverviewTransform();
  });
}

if (btnOverviewZoomOut) {
  btnOverviewZoomOut.addEventListener('click', () => {
    overviewScale = Math.max(0.25, overviewScale / 1.2);
    updateOverviewTransform();
  });
}

if (btnOverviewFit) {
  btnOverviewFit.addEventListener('click', () => {
    overviewScale = 0.85;
    overviewPanX = 0;
    overviewPanY = 0;
    updateOverviewTransform();
  });
}
