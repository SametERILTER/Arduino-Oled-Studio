const state = {
  zoom: 5,
  showGrid: true,
  inverted: false,
  oledColor: 'white', 
  activeTool: 'select', 
  brushSize: 1, 
  lastBrushPos: null,
  eraserMode: 'pixel', 

  screens: [],
  activeScreenId: null,

  pixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
  erasedPixels: new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT),
  objects: [],
  selectedId: null,

  isDrawing: false,
  dragMode: null, 
  resizeHandle: null, 
  dragStart: { x: 0, y: 0 },
  initialObjState: null,
  creationPreview: null,
  currentMousePos: { x: -1, y: -1 },

  undoStack: [],
  redoStack: []
};

const oledCanvas = document.getElementById('oledCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const oledCtx = oledCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
const viewportSurface = document.querySelector('.oled-display-surface');

const mouseCoordText = document.getElementById('mouseCoordText');
const selectionStatus = document.getElementById('selectionStatus');
const canvasScaleText = document.getElementById('canvasScaleText');
const zoomLevelText = document.getElementById('zoomLevelText');

const screenTabsList = document.getElementById('screenTabsList');
const btnAddScreen = document.getElementById('btnAddScreen');

const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnToggleGrid = document.getElementById('btnToggleGrid');
const btnInvert = document.getElementById('btnInvert');
const oledColorSelect = document.getElementById('oledColorSelect');
const screenTypeSelect = document.getElementById('screenTypeSelect');
const btnClearAll = document.getElementById('btnClearAll');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');

const btnExportJson = document.getElementById('btnExportJson');
const inputFileJson = document.getElementById('inputFileJson');
const btnExportIno = document.getElementById('btnExportIno');
const inputImageBitmap = document.getElementById('inputImageBitmap');

const propertiesPanelHeading = document.querySelector('.sidebar-panel:first-child .panel-heading');
const noSelectionMsg = document.getElementById('noSelectionMsg');
const propertiesForm = document.getElementById('propertiesForm');
const brushPropertiesForm = document.getElementById('brushPropertiesForm');
const eraserModeField = document.getElementById('eraserModeField');
const brushSizeField = document.getElementById('brushSizeField');
const brushTitleLabel = document.getElementById('brushTitleLabel');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');
const propX = document.getElementById('propX');
const propY = document.getElementById('propY');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const dimensionProps = document.getElementById('dimensionProps');
const textSpecificProps = document.getElementById('textSpecificProps');
const propText = document.getElementById('propText');
const propTextSize = document.getElementById('propTextSize');
const shapeSpecificProps = document.getElementById('shapeSpecificProps');
const propFilled = document.getElementById('propFilled');
const bitmapSpecificProps = document.getElementById('bitmapSpecificProps');
const propBitmapThreshold = document.getElementById('propBitmapThreshold');
const propBitmapThresholdVal = document.getElementById('propBitmapThresholdVal');
const propBitmapMode = document.getElementById('propBitmapMode');
const propBitmapInvert = document.getElementById('propBitmapInvert');
const btnBitmapOrigSize = document.getElementById('btnBitmapOrigSize');
const btnBitmapFit = document.getElementById('btnBitmapFit');
const layersList = document.getElementById('layersList');
const layersCount = document.getElementById('layersCount');

const arduinoCodeSnippet = document.getElementById('arduinoCodeSnippet');
const codeFormatSelect = document.getElementById('codeFormatSelect');
const codeScopeSelect = document.getElementById('codeScopeSelect');
const btnCopyCode = document.getElementById('btnCopyCode');
const copyBtnText = document.getElementById('copyBtnText');

const modalCodeFormatSelect = document.getElementById('modalCodeFormatSelect');
const modalCodeScopeSelect = document.getElementById('modalCodeScopeSelect');
const modalDownloadBtnLabel = document.getElementById('modalDownloadBtnLabel');

const COLOR_MAP = {
  white: { pixel: '#ffffff', glow: 'rgba(255, 255, 255, 0.25)', bg: '#080a14' },
  blue:  { pixel: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)',  bg: '#060a18' },
  yellow:{ pixel: '#facc15', glow: 'rgba(250, 204, 21, 0.25)',  bg: '#121206' },
  green: { pixel: '#4ade80', glow: 'rgba(74, 222, 128, 0.25)',  bg: '#041208' }
};

function updateZoomDisplay() {
  viewportSurface.style.width = `${SCREEN_WIDTH * state.zoom}px`;
  viewportSurface.style.height = `${SCREEN_HEIGHT * state.zoom}px`;
  zoomLevelText.textContent = `${state.zoom * 100}%`;
  canvasScaleText.textContent = typeof t === 'function' ? t('status_scale', { zoom: state.zoom }) : `Ölçek: ${state.zoom}x`;
  renderAll();
}

function updateColorTheme() {
  const current = COLOR_MAP[state.oledColor] || COLOR_MAP.white;
  document.documentElement.style.setProperty('--oled-pixel-color', current.pixel);
  document.documentElement.style.setProperty('--oled-bg-color', current.bg);
  renderAll();
}

function pushHistory() {
  syncActiveScreen();
  const snapshot = {
    pixels: new Uint8Array(state.pixels),
    erasedPixels: new Uint8Array(state.erasedPixels),
    objects: JSON.parse(JSON.stringify(state.objects)),
    selectedId: state.selectedId
  };
  state.undoStack.push(snapshot);
  if (state.undoStack.length > 30) state.undoStack.shift();
  state.redoStack = [];
  updateHistoryButtons();
  updateArduinoCode();
}

function undo() {
  if (state.undoStack.length === 0) return;
  const current = {
    pixels: new Uint8Array(state.pixels),
    erasedPixels: new Uint8Array(state.erasedPixels),
    objects: JSON.parse(JSON.stringify(state.objects)),
    selectedId: state.selectedId
  };
  state.redoStack.push(current);
  const previous = state.undoStack.pop();
  state.pixels = new Uint8Array(previous.pixels);
  state.erasedPixels = previous.erasedPixels ? new Uint8Array(previous.erasedPixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  state.objects = previous.objects;
  state.selectedId = previous.selectedId;
  syncActiveScreen();
  updateHistoryButtons();
  updatePropertiesPanel();
  renderAll();
  updateArduinoCode();
}

function redo() {
  if (state.redoStack.length === 0) return;
  const current = {
    pixels: new Uint8Array(state.pixels),
    erasedPixels: new Uint8Array(state.erasedPixels),
    objects: JSON.parse(JSON.stringify(state.objects)),
    selectedId: state.selectedId
  };
  state.undoStack.push(current);
  const next = state.redoStack.pop();
  state.pixels = new Uint8Array(next.pixels);
  state.erasedPixels = next.erasedPixels ? new Uint8Array(next.erasedPixels) : new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  state.objects = next.objects;
  state.selectedId = next.selectedId;
  syncActiveScreen();
  updateHistoryButtons();
  updatePropertiesPanel();
  renderAll();
  updateArduinoCode();
}

function updateHistoryButtons() {
  btnUndo.disabled = state.undoStack.length === 0;
  btnRedo.disabled = state.redoStack.length === 0;
}
