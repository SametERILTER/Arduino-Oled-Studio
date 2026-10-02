const PRESET_ICONS = {};

function rasterizeSvgToBitmap(svgEl, targetSize = 16) {
  return new Promise((resolve) => {
    if (!svgEl) {
      resolve(null);
      return;
    }

    const svgClone = svgEl.cloneNode(true);
    svgClone.setAttribute('width', targetSize);
    svgClone.setAttribute('height', targetSize);
    if (!svgClone.getAttribute('viewBox')) {
      svgClone.setAttribute('viewBox', '0 0 24 24');
    }

    let svgStr = new XMLSerializer().serializeToString(svgClone);
    svgStr = svgStr.replace(/currentColor/g, '#ffffff');

    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, targetSize, targetSize);
      ctx.drawImage(img, 0, 0, targetSize, targetSize);

      const imgData = ctx.getImageData(0, 0, targetSize, targetSize).data;
      const bitData = new Array(targetSize * targetSize);
      const rawRgba = new Array(targetSize * targetSize * 4);

      for (let i = 0; i < targetSize * targetSize; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const a = imgData[i * 4 + 3];

        rawRgba[i * 4] = r;
        rawRgba[i * 4 + 1] = g;
        rawRgba[i * 4 + 2] = b;
        rawRgba[i * 4 + 3] = a;

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        bitData[i] = (a >= 70 && lum >= 70) ? 1 : 0;
      }

      resolve({
        w: targetSize,
        h: targetSize,
        origW: targetSize,
        origH: targetSize,
        data: bitData,
        rawRgba: rawRgba
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

function initPresetIcons() {
  document.querySelectorAll('.preset-icon-btn').forEach(btn => {
    const key = btn.dataset.preset;
    const svg = btn.querySelector('svg');
    if (key && svg) {
      rasterizeSvgToBitmap(svg, 16).then(res => {
        if (res) {
          PRESET_ICONS[key] = {
            name: key,
            ...res
          };
        }
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPresetIcons);
} else {
  initPresetIcons();
}

document.querySelectorAll('.preset-icon-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.preset;
    let preset = PRESET_ICONS[key];
    if (!preset) {
      const svg = btn.querySelector('svg');
      if (svg) {
        const res = await rasterizeSvgToBitmap(svg, 16);
        if (res) {
          PRESET_ICONS[key] = { name: key, ...res };
          preset = PRESET_ICONS[key];
        }
      }
    }
    if (!preset) return;

    pushHistory();
    const presetName = (typeof t === 'function' ? t('preset_name_' + key) : null) || key;
    const newBitmap = {
      id: generateId(),
      type: 'bitmap',
      name: presetName,
      x: Math.round((SCREEN_WIDTH - preset.w) / 2),
      y: Math.round((SCREEN_HEIGHT - preset.h) / 2),
      w: preset.w,
      h: preset.h,
      origW: preset.origW || preset.w,
      origH: preset.origH || preset.h,
      threshold: 128,
      inverted: false,
      ditherMode: 'threshold',
      rawRgba: preset.rawRgba ? [...preset.rawRgba] : null,
      data: [...preset.data],
      visible: true
    };

    state.objects.push(newBitmap);
    selectObject(newBitmap.id);
    setActiveTool('select');
    renderAll();
    updateArduinoCode();
  });
});

inputImageBitmap.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      let targetW = img.width;
      let targetH = img.height;
      if (targetW > SCREEN_WIDTH || targetH > SCREEN_HEIGHT) {
        const ratio = Math.min(SCREEN_WIDTH / targetW, SCREEN_HEIGHT / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

      pushHistory();
      const newBitmap = {
        id: generateId(),
        type: 'bitmap',
        name: file.name.substring(0, 12),
        x: Math.round((SCREEN_WIDTH - targetW) / 2),
        y: Math.round((SCREEN_HEIGHT - targetH) / 2),
        w: targetW,
        h: targetH,
        origW: targetW,
        origH: targetH,
        threshold: 128,
        inverted: false,
        ditherMode: 'threshold',
        alphaThreshold: 50,
        rawRgba: Array.from(imgData),
        data: [],
        visible: true
      };

      recomputeBitmapData(newBitmap);

      state.objects.push(newBitmap);
      selectObject(newBitmap.id);
      setActiveTool('select');
      renderAll();
      updateArduinoCode();
      inputImageBitmap.value = '';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});
