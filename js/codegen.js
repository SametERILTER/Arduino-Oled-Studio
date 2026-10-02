function syncCodeUI() {
  const scope = codeScopeSelect ? codeScopeSelect.value : 'full_project';

  if (modalDownloadBtnLabel) {
    const defaultLabel = (scope === 'modular_header') ? 'screens.h İndir' : '.ino İndir';
    const i18nLabel = typeof t === 'function' ? (scope === 'modular_header' ? t('download_h') : t('download_ino')) : defaultLabel;
    modalDownloadBtnLabel.textContent = i18nLabel;
  }
}

function extractScreenAdafruitCommands(screen, sIdx) {
  let commands = [];

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      if (screen.pixels[y * SCREEN_WIDTH + x] === 1) {
        commands.push(`  display.drawPixel(${x}, ${y}, SSD1306_WHITE);`);
      }
    }
  }

  for (const obj of screen.objects) {
    if (obj.visible === false) continue;
    switch (obj.type) {
      case 'text':
        commands.push(`  display.setTextSize(${obj.size});`);
        commands.push(`  display.setTextColor(SSD1306_WHITE);`);
        commands.push(`  display.setCursor(${obj.x}, ${obj.y});`);
        commands.push(`  display.print("${escapeForCpp(obj.text)}");`);
        break;
      case 'rect':
        commands.push(`  display.drawRect(${obj.x}, ${obj.y}, ${obj.w}, ${obj.h}, SSD1306_WHITE);`);
        break;
      case 'filled_rect':
        commands.push(`  display.fillRect(${obj.x}, ${obj.y}, ${obj.w}, ${obj.h}, SSD1306_WHITE);`);
        break;
      case 'circle':
        commands.push(`  display.drawCircle(${obj.x}, ${obj.y}, ${obj.r}, SSD1306_WHITE);`);
        break;
      case 'filled_circle':
        commands.push(`  display.fillCircle(${obj.x}, ${obj.y}, ${obj.r}, SSD1306_WHITE);`);
        break;
      case 'line':
        commands.push(`  display.drawLine(${obj.x1}, ${obj.y1}, ${obj.x2}, ${obj.y2}, SSD1306_WHITE);`);
        break;
      case 'bitmap':
        const safeName = `bmp_s${sIdx + 1}_${obj.id.replace(/[^a-zA-Z0-9_]/g, '')}`;
        commands.push(`  display.drawBitmap(${obj.x}, ${obj.y}, ${safeName}, ${obj.w}, ${obj.h}, SSD1306_WHITE);`);
        break;
    }
  }

  const objBuf = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  for (const obj of screen.objects) {
    if (obj.visible === false) continue;
    drawObjectToBuffer(obj, objBuf);
  }
  let hasErased = false;
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const idx = y * SCREEN_WIDTH + x;
      if (screen.erasedPixels[idx] === 1 && objBuf[idx] === 1) {
        if (!hasErased) {
          commands.push(`  // Erased pixels`);
          hasErased = true;
        }
        commands.push(`  display.drawPixel(${x}, ${y}, SSD1306_BLACK);`);
      }
    }
  }
  return commands;
}

function extractScreenU8g2Commands(screen) {
  let commands = [];
  for (const obj of screen.objects) {
    if (obj.visible === false) continue;
    switch (obj.type) {
      case 'text':
        commands.push(`  u8g2.setFont(u8g2_font_6x10_tr);`);
        commands.push(`  u8g2.drawStr(${obj.x}, ${obj.y + 7 * obj.size}, "${escapeForCpp(obj.text)}");`);
        break;
      case 'rect':
        commands.push(`  u8g2.drawFrame(${obj.x}, ${obj.y}, ${obj.w}, ${obj.h});`);
        break;
      case 'filled_rect':
        commands.push(`  u8g2.drawBox(${obj.x}, ${obj.y}, ${obj.w}, ${obj.h});`);
        break;
      case 'circle':
        commands.push(`  u8g2.drawCircle(${obj.x}, ${obj.y}, ${obj.r});`);
        break;
      case 'filled_circle':
        commands.push(`  u8g2.drawDisc(${obj.x}, ${obj.y}, ${obj.r});`);
        break;
      case 'line':
        commands.push(`  u8g2.drawLine(${obj.x1}, ${obj.y1}, ${obj.x2}, ${obj.y2});`);
        break;
    }
  }

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      if (screen.pixels[y * SCREEN_WIDTH + x] === 1) {
        commands.push(`  u8g2.drawPixel(${x}, ${y});`);
      }
    }
  }

  const objBufU8 = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  for (const obj of screen.objects) {
    if (obj.visible === false) continue;
    drawObjectToBuffer(obj, objBufU8);
  }
  let hasErasedU8 = false;
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const idx = y * SCREEN_WIDTH + x;
      if (screen.erasedPixels[idx] === 1 && objBufU8[idx] === 1) {
        if (!hasErasedU8) {
          commands.push(`  // Erased pixels`);
          commands.push(`  u8g2.setDrawColor(0);`);
          hasErasedU8 = true;
        }
        commands.push(`  u8g2.drawPixel(${x}, ${y});`);
      }
    }
  }
  if (hasErasedU8) {
    commands.push(`  u8g2.setDrawColor(1);`);
  }
  return commands;
}

function buildModularLoop(isMulti) {
  if (!isMulti) {
    return `void loop() {
  // Single screen mode. Add your custom loop logic here.
}`;
  }

  return `void loop() {
  // Modular multi-screen loop
  // Call showScreen(index) anytime to switch screens:
  // showScreen(0); // Screen 1
  // showScreen(1); // Screen 2
}`;
}

function generateArduinoCode() {
  syncActiveScreen();
  const format = codeFormatSelect ? codeFormatSelect.value : 'adafruit_commands';
  const scope = codeScopeSelect ? codeScopeSelect.value : 'full_project';

  if (scope === 'bitmaps_only') {
    return generateBitmapsOnlyCode();
  } else if (scope === 'active_screen_only') {
    return generateActiveScreenOnlyCode(format);
  } else if (scope === 'modular_header') {
    return generateModularHeaderCode(format);
  }

  if (format === 'bitmap_array') {
    return generateBitmapArrayCode();
  } else if (format === 'u8g2') {
    return generateU8g2Code();
  } else {
    return generateAdafruitCommandsCode();
  }
}

function generateBitmapsOnlyCode() {
  syncActiveScreen();
  const bitmapDefs = new Map();
  state.screens.forEach((screen, sIdx) => {
    screen.objects.forEach(obj => {
      if (obj.visible !== false && obj.type === 'bitmap') {
        const safeName = `bmp_s${sIdx + 1}_${obj.id.replace(/[^a-zA-Z0-9_]/g, '')}`;
        if (!bitmapDefs.has(safeName)) {
          const bytes = convertBitmapToBytes(obj.w, obj.h, obj.data, obj.origW, obj.origH);
          const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
          bitmapDefs.set(safeName, `// Screen: ${screen.name} - ${obj.name} (${obj.w}x${obj.h})\nstatic const unsigned char PROGMEM ${safeName}[] = { ${hex} };`);
        }
      }
    });
  });

  if (bitmapDefs.size === 0) {
    return `// ==========================================================================\n// No bitmap or image objects found in your project.\n// Upload an image from the left panel or add an icon from the library.\n// ==========================================================================`;
  }

  return `/*
 * Monochrome OLED Bitmap Definitions (PROGMEM)
 * Total ${bitmapDefs.size} image datasets
 * Copy this data directly to the top of your Arduino sketch.
 */

#include <Arduino.h>
#include <avr/pgmspace.h>

${Array.from(bitmapDefs.values()).join('\n\n')}
`;
}

function generateActiveScreenOnlyCode(format) {
  syncActiveScreen();
  const screen = getActiveScreen();
  const sIdx = state.screens.findIndex(s => s.id === screen.id);
  const safeFnName = `drawScreen_${(screen.name || 'Screen').replace(/[^a-zA-Z0-9_]/g, '_')}`;

  if (format === 'u8g2') {
    const commands = extractScreenU8g2Commands(screen);
    const body = commands.length > 0 ? commands.join('\n') : '  // Empty screen';
    return `/*
 * Modular Screen Function: "${screen.name}"
 * Library: U8g2
 *
 * Usage (U8g2 First/NextPage Loop):
 *   u8g2.firstPage();
 *   do {
 *     ${safeFnName}();
 *   } while (u8g2.nextPage());
 */

void ${safeFnName}() {
${body}
}
`;
  } else if (format === 'bitmap_array') {
    const finalBuffer = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    for (const obj of screen.objects) {
      if (obj.visible === false) continue;
      drawObjectToBuffer(obj, finalBuffer);
    }
    for (let i = 0; i < finalBuffer.length; i++) {
      if (screen.pixels[i] === 1) finalBuffer[i] = 1;
      if (screen.erasedPixels[i] === 1) finalBuffer[i] = 0;
    }

    let hexLines = [];
    for (let i = 0; i < finalBuffer.length; i += 16) {
      const chunk = finalBuffer.slice(i, i + 16);
      const hexChunk = chunk.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
      hexLines.push('  ' + hexChunk + (i + 16 < finalBuffer.length ? ',' : ''));
    }
    const varName = `oled_${(screen.name || 'screen').replace(/[^a-zA-Z0-9_]/g, '_')}_bmp`;
    return `/*
 * Modular Screen Bitmap Function: "${screen.name}"
 * Library: Adafruit SSD1306 (Full Screen Bitmap)
 */

const unsigned char PROGMEM ${varName}[] = {
${hexLines.join('\n')}
};

void ${safeFnName}() {
  display.drawBitmap(0, 0, ${varName}, ${SCREEN_WIDTH}, ${SCREEN_HEIGHT}, SSD1306_WHITE);
}
`;
  } else {

    const commands = extractScreenAdafruitCommands(screen, sIdx >= 0 ? sIdx : 0);
    const body = commands.length > 0 ? commands.join('\n') : '  // Empty screen';

    let bmpDefs = [];
    screen.objects.forEach(obj => {
      if (obj.visible !== false && obj.type === 'bitmap') {
        const safeName = `bmp_s${(sIdx >= 0 ? sIdx : 0) + 1}_${obj.id.replace(/[^a-zA-Z0-9_]/g, '')}`;
        const bytes = convertBitmapToBytes(obj.w, obj.h, obj.data, obj.origW, obj.origH);
        const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
        bmpDefs.push(`static const unsigned char PROGMEM ${safeName}[] = { ${hex} };`);
      }
    });

    const bmpBlock = bmpDefs.length > 0 ? bmpDefs.join('\n') + '\n\n' : '';

    return `/*
 * Modular Screen Function: "${screen.name}"
 * Library: Adafruit GFX / SSD1306
 *
 * Usage Example:
 *   display.clearDisplay();
 *   ${safeFnName}();
 *   display.display();
 */

${bmpBlock}void ${safeFnName}() {
${body}
}
`;
  }
}

function generateModularHeaderCode(format) {
  syncActiveScreen();
  const isU8g2 = (format === 'u8g2');

  let bitmapDefs = new Map();
  state.screens.forEach((screen, sIdx) => {
    screen.objects.forEach(obj => {
      if (obj.visible !== false && obj.type === 'bitmap') {
        const safeName = `bmp_s${sIdx + 1}_${obj.id.replace(/[^a-zA-Z0-9_]/g, '')}`;
        if (!bitmapDefs.has(safeName)) {
          const bytes = convertBitmapToBytes(obj.w, obj.h, obj.data, obj.origW, obj.origH);
          const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
          bitmapDefs.set(safeName, `static const unsigned char PROGMEM ${safeName}[] = { ${hex} };`);
        }
      }
    });
  });

  const progmemBlock = bitmapDefs.size > 0 
    ? `// --- BITMAP DEFINITIONS ---\n` + Array.from(bitmapDefs.values()).join('\n\n') + '\n\n'
    : '';

  let screenFunctions = [];
  let switchCases = [];

  state.screens.forEach((screen, sIdx) => {
    const fnName = `drawScreen${sIdx + 1}`;
    const commands = isU8g2 
      ? extractScreenU8g2Commands(screen) 
      : extractScreenAdafruitCommands(screen, sIdx);

    const body = commands.length > 0 ? commands.join('\n') : '  // Empty screen';
    screenFunctions.push(`// Screen ${sIdx + 1}: ${screen.name}\ninline void ${fnName}() {\n${body}\n}`);
    switchCases.push(`    case ${sIdx}:\n      ${fnName}();\n      break;`);
  });

  const dispatcher = isU8g2 ? `
inline void showScreen(int screenIndex) {
  u8g2.firstPage();
  do {
    switch (screenIndex) {
${switchCases.join('\n')}
      default:
        break;
    }
  } while (u8g2.nextPage());
}` : `
inline void showScreen(int screenIndex) {
  display.clearDisplay();
  switch (screenIndex) {
${switchCases.join('\n')}
    default:
      break;
  }
  display.display();
}`;

  return `/*
 * ============================================================================
 * screens.h - Modular OLED Screen Definitions
 * Save this file inside your Arduino project sketch directory.
 * Simply add #include "screens.h" at the top of your main .ino sketch.
 * ============================================================================
 */

#ifndef OLED_SCREENS_H
#define OLED_SCREENS_H

#include <Arduino.h>
#include <avr/pgmspace.h>

${isU8g2 ? '#include <U8g2lib.h>\nextern U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2;' : '#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nextern Adafruit_SSD1306 display;'}

#define SCREEN_WIDTH ${SCREEN_WIDTH}
#define SCREEN_HEIGHT ${SCREEN_HEIGHT}
#define TOTAL_SCREENS ${state.screens.length}

${progmemBlock}// ==========================================================================
// SCREEN DRAWING FUNCTIONS
// ==========================================================================
${screenFunctions.join('\n\n')}

// ==========================================================================
// CENTRAL SCREEN DISPATCHER
// ==========================================================================
${dispatcher}

#endif // OLED_SCREENS_H
`;
}

function generateAdafruitCommandsCode() {
  syncActiveScreen();
  const profile = SCREEN_PROFILES[state.screenProfile || 'ssd1306_128x64'];
  const invertCode = state.inverted ? `  display.invertDisplay(true);\n` : '';
  const isMulti = state.screens.length > 1;
  const loopCode = buildModularLoop(isMulti);

  const bitmapDefs = new Map();
  state.screens.forEach((screen, sIdx) => {
    screen.objects.forEach(obj => {
      if (obj.visible !== false && obj.type === 'bitmap') {
        const safeName = `bmp_s${sIdx + 1}_${obj.id.replace(/[^a-zA-Z0-9_]/g, '')}`;
        if (!bitmapDefs.has(safeName)) {
          const bytes = convertBitmapToBytes(obj.w, obj.h, obj.data, obj.origW, obj.origH);
          const hex = bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
          bitmapDefs.set(safeName, `// Screen: ${screen.name} - ${obj.name} (${obj.w}x${obj.h})\nstatic const unsigned char PROGMEM ${safeName}[] = { ${hex} };`);
        }
      }
    });
  });

  const progmemBlock = bitmapDefs.size > 0 
    ? `// ==========================================================================\n// BITMAP DEFINITIONS (PROGMEM)\n// ==========================================================================\n` + Array.from(bitmapDefs.values()).join('\n\n') + '\n\n'
    : '';

  let screenFunctions = [];
  let switchCases = [];

  state.screens.forEach((screen, sIdx) => {
    const fnName = `drawScreen${sIdx + 1}`;
    const commands = extractScreenAdafruitCommands(screen, sIdx);
    const body = commands.length > 0 ? commands.join('\n') : '  // Empty screen';
    screenFunctions.push(`// Screen ${sIdx + 1}: ${screen.name}\nvoid ${fnName}() {\n${body}\n}`);
    switchCases.push(`    case ${sIdx}:\n      ${fnName}();\n      break;`);
  });

  let dispatcher = '';
  if (isMulti) {
    dispatcher = `// ==========================================================================
// MODULAR SCREEN DISPATCHER
// ==========================================================================
const int TOTAL_SCREENS = ${state.screens.length};

void showScreen(int screenIndex) {
  display.clearDisplay();

  switch (screenIndex) {
${switchCases.join('\n')}
    default:
      break;
  }

  display.display();
}
`;
  }

  const setupCode = isMulti ? `void setup() {
  Serial.begin(115200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("${profile.driver} initialization failed!"));
    for(;;);
  }

  display.clearDisplay();
${invertCode}  // Load initial screen (0 = Screen 1)
  showScreen(0);
}` : `void setup() {
  Serial.begin(115200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("${profile.driver} initialization failed!"));
    for(;;);
  }

  display.clearDisplay();
${invertCode}  drawScreen1();
  display.display();
}`;

  return `/*
 * ${profile.name} (${profile.driver}) Modular Arduino Sketch
 * Resolution: ${SCREEN_WIDTH}x${SCREEN_HEIGHT} Pixels, I2C Address: 0x3C
 * Total Screens: ${state.screens.length}
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH ${SCREEN_WIDTH}
#define SCREEN_HEIGHT ${SCREEN_HEIGHT}
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

${progmemBlock}// ==========================================================================
// SCREEN DRAWING FUNCTIONS (MODULAR)
// ==========================================================================
${screenFunctions.join('\n\n')}

${dispatcher}// ==========================================================================
// ARDUINO MAIN PROGRAM
// ==========================================================================
${setupCode}

${loopCode}
`;
}

function generateBitmapArrayCode() {
  syncActiveScreen();
  const profile = SCREEN_PROFILES[state.screenProfile || 'ssd1306_128x64'];
  const isMulti = state.screens.length > 1;
  const loopCode = buildModularLoop(isMulti);

  let bitmapDeclarations = [];
  let screenVarNames = [];

  state.screens.forEach((screen, sIdx) => {
    const finalBuffer = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    for (const obj of screen.objects) {
      if (obj.visible === false) continue;
      drawObjectToBuffer(obj, finalBuffer);
    }
    for (let i = 0; i < finalBuffer.length; i++) {
      if (screen.pixels[i]) finalBuffer[i] = 1;
    }
    for (let i = 0; i < finalBuffer.length; i++) {
      if (screen.erasedPixels[i]) finalBuffer[i] = 0;
    }

    const totalBytes = Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT) / 8);
    const byteArray = [];
    for (let i = 0; i < totalBytes; i++) {
      let byteVal = 0;
      const basePixelIndex = i * 8;
      for (let bit = 0; bit < 8; bit++) {
        if (basePixelIndex + bit < finalBuffer.length && finalBuffer[basePixelIndex + bit]) {
          byteVal |= (1 << (7 - bit));
        }
      }
      byteArray.push(byteVal);
    }

    let hexLines = [];
    for (let i = 0; i < byteArray.length; i += 16) {
      const chunk = byteArray.slice(i, i + 16);
      const hexChunk = chunk.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');
      hexLines.push('  ' + hexChunk + (i + 16 < byteArray.length ? ',' : ''));
    }

    const varName = `oled_screen_${sIdx + 1}_bitmap`;
    screenVarNames.push(varName);
    bitmapDeclarations.push(`// Screen ${sIdx + 1}: ${screen.name} (${SCREEN_WIDTH}x${SCREEN_HEIGHT})\nconst unsigned char PROGMEM ${varName}[] = {\n${hexLines.join('\n')}\n};`);
  });

  const arrayPointerTable = isMulti ? `
// All Screen Arrays Table
const unsigned char* const oled_screens[] = {
${screenVarNames.map(v => '  ' + v).join(',\n')}
};

const int TOTAL_SCREENS = ${state.screens.length};

// Modular Screen Display Function
void showScreen(int screenIndex) {
  if (screenIndex < 0 || screenIndex >= TOTAL_SCREENS) return;
  display.clearDisplay();
  ${state.inverted ? 'display.invertDisplay(true);' : ''}
  display.drawBitmap(0, 0, oled_screens[screenIndex], ${SCREEN_WIDTH}, ${SCREEN_HEIGHT}, SSD1306_WHITE);
  display.display();
}
` : '';

  let setupAndLoop = '';
  if (isMulti) {
    setupAndLoop = `void setup() {
  Serial.begin(115200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("${profile.driver} initialization failed!"));
    for(;;);
  }

  // Display initial screen (0 = Screen 1)
  showScreen(0);
}

${loopCode}`;
  } else {
    setupAndLoop = `void setup() {
  Serial.begin(115200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("${profile.driver} initialization failed!"));
    for(;;);
  }

  display.clearDisplay();
  ${state.inverted ? 'display.invertDisplay(true);' : ''}
  display.drawBitmap(0, 0, ${screenVarNames[0]}, ${SCREEN_WIDTH}, ${SCREEN_HEIGHT}, SSD1306_WHITE);
  display.display();
}

void loop() {
  // Single screen mode
}`;
  }

  const bytesPerScreen = Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT) / 8);

  return `/*
 * ${profile.name} Monochrome OLED Bitmap Array (PROGMEM - Modular)
 * Total Screens: ${state.screens.length} (${bytesPerScreen} Bytes each)
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH ${SCREEN_WIDTH}
#define SCREEN_HEIGHT ${SCREEN_HEIGHT}
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================================================
// SCREEN BITMAP DATA (PROGMEM)
// ==========================================================================
${bitmapDeclarations.join('\n\n')}
${arrayPointerTable}
// ==========================================================================
// ARDUINO PROGRAM (SETUP & LOOP)
// ==========================================================================
${setupAndLoop}
`;
}

function generateU8g2Code() {
  syncActiveScreen();
  const profile = SCREEN_PROFILES[state.screenProfile || 'ssd1306_128x64'];
  const isMulti = state.screens.length > 1;
  const loopCode = buildModularLoop(isMulti);

  let constructorStr = 'U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';

  if (profile.driver === 'SH1106') {
    constructorStr = 'U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  } else if (SCREEN_HEIGHT === 32) {
    constructorStr = 'U8G2_SSD1306_128X32_UNIVISION_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  } else if (SCREEN_WIDTH === 64) {
    constructorStr = 'U8G2_SSD1306_64X48_ER_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  }

  let screenFunctions = [];
  let switchCases = [];

  state.screens.forEach((screen, sIdx) => {
    const fnName = `drawScreen${sIdx + 1}`;
    const commands = extractScreenU8g2Commands(screen);
    const body = commands.length > 0 ? commands.join('\n') : '  // Empty screen';
    screenFunctions.push(`// Screen ${sIdx + 1}: ${screen.name}\nvoid ${fnName}() {\n${body}\n}`);
    switchCases.push(`    case ${sIdx}:\n      ${fnName}();\n      break;`);
  });

  let dispatcherAndLoop = '';
  if (isMulti) {
    dispatcherAndLoop = `// ==========================================================================
// MODULAR SCREEN DISPATCHER
// ==========================================================================
const int TOTAL_SCREENS = ${state.screens.length};

void showScreen(int screenIndex) {
  u8g2.firstPage();
  do {
    switch (screenIndex) {
${switchCases.join('\n')}
      default:
        break;
    }
  } while (u8g2.nextPage());
}

// ==========================================================================
// ARDUINO MAIN PROGRAM
// ==========================================================================
void setup() {
  Serial.begin(115200);
  u8g2.begin();
  // Display initial screen (0 = Screen 1)
  showScreen(0);
}

${loopCode}`;
  } else {
    dispatcherAndLoop = `// ==========================================================================
// ARDUINO MAIN PROGRAM
// ==========================================================================
void setup() {
  Serial.begin(115200);
  u8g2.begin();
}

void loop() {
  u8g2.firstPage();
  do {
    drawScreen1();
  } while (u8g2.nextPage());
  delay(1000);
}`;
  }

  return `/*
 * ${profile.name} U8g2 Modular Library Sketch
 * Total Screens: ${state.screens.length}
 */

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

// Display I2C Configuration
${constructorStr}

// ==========================================================================
// SCREEN DRAWING FUNCTIONS (MODULAR)
// ==========================================================================
${screenFunctions.join('\n\n')}

${dispatcherAndLoop}
`;
}

function convertBitmapToBytes(w, h, data, origW, origH) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  origW = origW || w;
  origH = origH || h;
  const rowBytes = Math.ceil(w / 8);
  const bytes = [];
  for (let r = 0; r < h; r++) {
    for (let cb = 0; cb < rowBytes; cb++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const c = cb * 8 + bit;
        if (c < w) {
          const srcC = Math.min(origW - 1, Math.floor(c * (origW / w)));
          const srcR = Math.min(origH - 1, Math.floor(r * (origH / h)));
          if (data[srcR * origW + srcC]) {
            b |= (1 << (7 - bit));
          }
        }
      }
      bytes.push(b);
    }
  }
  return bytes;
}

function escapeForCpp(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function calculateMemoryStats() {
  syncActiveScreen();
  const mode = codeFormatSelect.value;
  let ramBytes = Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT) / 8);
  let flashBytes = 0;

  if (mode === 'u8g2') {
    ramBytes = (SCREEN_HEIGHT <= 32) ? 64 : 128; 
  }

  if (mode === 'bitmap_array') {
    flashBytes = Math.ceil((SCREEN_WIDTH * SCREEN_HEIGHT) / 8) * state.screens.length;
  } else {

    state.screens.forEach(screen => {
      for (const obj of screen.objects) {
        if (obj.visible === false) continue;
        if (obj.type === 'bitmap') {
          const rowBytes = Math.ceil(obj.w / 8);
          flashBytes += (rowBytes * obj.h);
        }
      }
    });
  }

  let totalObjCount = 0;
  state.screens.forEach(s => {
    totalObjCount += s.objects.filter(o => o.visible !== false).length;
  });

  return {
    ramBytes,
    flashBytes,
    objCount: totalObjCount,
    screensCount: state.screens.length,
    ramPercentUno: Math.round((ramBytes / 2048) * 100), 
    flashPercentUno: ((flashBytes / 32256) * 100).toFixed(1) 
  };
}

function updateArduinoCode() {
  const code = generateArduinoCode();
  arduinoCodeSnippet.textContent = code;

  const stats = calculateMemoryStats();

  const modalCode = document.getElementById('modalArduinoCodeSnippet');
  if (modalCode) {
    modalCode.textContent = code;
  }
  const statFlash = document.getElementById('statFlash');
  const statObjects = document.getElementById('statObjects');
  if (statFlash) statFlash.textContent = typeof t === 'function'
    ? t('modal_stat_flash', { flash: stats.flashBytes })
    : `PROGMEM (Flash): ${stats.flashBytes} Bayt`;
  if (statObjects) statObjects.textContent = typeof t === 'function'
    ? t('modal_stat_objects', { count: stats.objCount })
    : `Aktif Nesneler: ${stats.objCount}`;
}

codeFormatSelect.addEventListener('change', () => {
  if (modalCodeFormatSelect) modalCodeFormatSelect.value = codeFormatSelect.value;
  updateArduinoCode();
});

if (codeScopeSelect) {
  codeScopeSelect.addEventListener('change', () => {
    if (modalCodeScopeSelect) modalCodeScopeSelect.value = codeScopeSelect.value;
    syncCodeUI();
    updateArduinoCode();
  });
}

btnCopyCode.addEventListener('click', () => {
  copyCodeToClipboard(arduinoCodeSnippet.textContent, copyBtnText, btnCopyCode);
});

const btnExpandCode = document.getElementById('btnExpandCode');
const codeModalOverlay = document.getElementById('codeModalOverlay');
const btnCloseCodeModal = document.getElementById('btnCloseCodeModal');
const modalBtnCopyCode = document.getElementById('modalBtnCopyCode');
const modalCopyBtnText = document.getElementById('modalCopyBtnText');
const modalBtnDownloadIno = document.getElementById('modalBtnDownloadIno');

function openCodeModal() {
  if (modalCodeFormatSelect && codeFormatSelect) modalCodeFormatSelect.value = codeFormatSelect.value;
  if (modalCodeScopeSelect && codeScopeSelect) modalCodeScopeSelect.value = codeScopeSelect.value;
  syncCodeUI();
  updateArduinoCode();
  codeModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCodeModal() {
  codeModalOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

btnExpandCode.addEventListener('click', openCodeModal);
btnCloseCodeModal.addEventListener('click', closeCodeModal);

codeModalOverlay.addEventListener('click', (e) => {
  if (e.target === codeModalOverlay) {
    closeCodeModal();
  }
});

if (modalCodeFormatSelect) {
  modalCodeFormatSelect.addEventListener('change', () => {
    if (codeFormatSelect) codeFormatSelect.value = modalCodeFormatSelect.value;
    updateArduinoCode();
  });
}

if (modalCodeScopeSelect) {
  modalCodeScopeSelect.addEventListener('change', () => {
    if (codeScopeSelect) codeScopeSelect.value = modalCodeScopeSelect.value;
    syncCodeUI();
    updateArduinoCode();
  });
}

modalBtnCopyCode.addEventListener('click', () => {
  copyCodeToClipboard(arduinoCodeSnippet.textContent, modalCopyBtnText, modalBtnCopyCode);
});

modalBtnDownloadIno.addEventListener('click', () => {
  const code = generateArduinoCode();
  const scope = codeScopeSelect ? codeScopeSelect.value : 'full_project';
  const filename = (scope === 'modular_header') ? 'screens.h' : 'OledScreenDisplay.ino';
  const blob = new Blob([code], { type: 'text/plain' });
  downloadBlob(blob, filename);
});

function copyCodeToClipboard(text, labelElem, btnElem) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = labelElem.textContent;
    labelElem.textContent = typeof t === 'function' ? t('copied') : 'Kopyalandı!';
    btnElem.style.backgroundColor = '#10b981';
    btnElem.style.borderColor = '#10b981';
    setTimeout(() => {
      labelElem.textContent = typeof t === 'function' ? t('copy') : originalText;
      btnElem.style.backgroundColor = '';
      btnElem.style.borderColor = '';
    }, 1500);
  });
}
