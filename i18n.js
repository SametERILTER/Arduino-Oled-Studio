const I18N_STORAGE_KEY = 'oled_studio_lang';

const TRANSLATIONS = {
  tr: {

    brand_title: 'OLED Studio',
    brand_sub: 'Arduino ve ESP32 için',

    undo: 'Geri Al (Ctrl+Z)',
    redo: 'İleri Al (Ctrl+Y)',
    label_screen: 'Ekran:',
    zoom_out: 'Uzaklaştır',
    zoom_in: 'Yakınlaştır',
    toggle_grid: 'Piksel Izgarasını Aç/Kapat',
    grid: 'Izgara',
    toggle_invert: 'Ekranı Ters Çevir (Invert)',
    invert: 'Invert',
    label_pixel_color: 'Piksel:',
    color_white: 'Beyaz (Standart)',
    color_blue: 'OLED Mavisi',
    color_yellow: 'OLED Sarısı',
    color_green: 'OLED Yeşili',
    clear_all_title: 'Tüm Çizimi ve Nesneleri Temizle',
    clear: 'Temizle',
    open_json_title: 'JSON Proje Dosyası Aç',
    open: 'Aç',
    download_ino_title: 'Arduino .ino Kodu Olarak İndir',
    download_ino: '.ino İndir',
    download_h: 'screens.h İndir',

    section_tools: 'ARAÇLAR',
    tool_select_title: 'Seç & Taşı (V)',
    tool_select: 'Seç',
    tool_pencil_title: 'Piksel Kalemi (P)',
    tool_pencil: 'Kalem',
    tool_eraser_title: 'Piksel Silgisi (E)',
    tool_eraser: 'Silgi',
    tool_text_title: 'Yazı Ekle (T)',
    tool_text: 'Yazı',
    tool_line_title: 'Çizgi (L)',
    tool_line: 'Çizgi',
    tool_rect_title: 'Dikdörtgen (R)',
    tool_rect: 'Kutu',
    tool_filled_rect_title: 'Dolu Dikdörtgen',
    tool_filled_rect: 'Dolu Kutu',
    tool_circle_title: 'Çember (C)',
    tool_circle: 'Çember',
    tool_filled_circle_title: 'Dolu Çember',
    tool_filled_circle: 'Dolu Çember',

    section_preset_icons: 'HAZIR İKONLAR',
    icon_battery_full: 'Batarya (Dolu)',
    icon_battery_half: 'Batarya (Yarım)',
    icon_battery_empty: 'Batarya (Boş)',
    icon_wifi: 'WiFi',
    icon_bluetooth: 'Bluetooth',
    icon_heart: 'Kalp / Nabız',
    icon_thermometer: 'Sıcaklık',
    icon_drop: 'Nem / Su Damlası',
    icon_clock: 'Saat',
    icon_bolt: 'Güç / Şimşek',
    icon_sun: 'Güneş / Aydınlık',
    icon_moon: 'Ay / Gece',
    icon_lock: 'Kilitli',
    icon_unlock: 'Açık Kilit',
    icon_gear: 'Ayarlar / Dişli',
    icon_home: 'Ev / Home',
    icon_speaker: 'Hoparlör / Ses',
    icon_mute: 'Sessiz',
    icon_alert: 'Uyarı / Dikkat',
    icon_trash: 'Çöp Kutusu',
    icon_arrow_up: 'Yukarı Ok',
    icon_arrow_down: 'Aşağı Ok',
    icon_arrow_left: 'Sol Ok',
    icon_arrow_right: 'Sağ Ok',

    preset_name_battery_full: 'Batarya Dolu',
    preset_name_battery_half: 'Batarya Yarim',
    preset_name_battery_empty: 'Batarya Bos',
    preset_name_wifi: 'WiFi',
    preset_name_bluetooth: 'Bluetooth',
    preset_name_heart: 'Kalp',
    preset_name_thermometer: 'Sicaklik',
    preset_name_drop: 'Nem',
    preset_name_clock: 'Saat',
    preset_name_bolt: 'Simsek',
    preset_name_sun: 'Gunes',
    preset_name_moon: 'Ay',
    preset_name_lock: 'Kilit',
    preset_name_unlock: 'Acik Kilit',
    preset_name_gear: 'Ayar',
    preset_name_home: 'Ev',
    preset_name_speaker: 'Ses',
    preset_name_mute: 'Sessiz',
    preset_name_alert: 'Uyari',
    preset_name_trash: 'Cop',
    preset_name_arrow_up: 'Ok Yukari',
    preset_name_arrow_down: 'Ok Asagi',
    preset_name_arrow_left: 'Ok Sol',
    preset_name_arrow_right: 'Ok Sag',

    section_import_image: 'RESİM İÇE AKTAR',
    upload_image_title: '1-bit Siyah-Beyaz Resim Yükle',
    upload_image: 'Resim Yükle (.png, .bmp)',
    shortcuts_label: 'Kısayollar:',
    shortcuts_tip: 'V: Seç | P: Kalem | E: Silgi | T: Yazı | Del: Sil',

    overview_mode_title: 'Tüm Ekranlar Genel Bakış (Figma Modu)',
    all_screens: 'Tüm Ekranlar',
    add_screen_title: 'Yeni Ekran Ekle (+)',
    default_screen_name: 'Ekran',
    objects_count_badge: '{count} nesne',
    close_screen: 'Ekranı Kapat',
    tab_title_tooltip: '{name} (Tıklayarak seçin, çift tıklayarak veya sağ tıklayarak yeniden adlandırın)',
    ctx_rename: 'Yeniden Adlandır',
    ctx_double_click: 'Çift Tık',
    ctx_clear: 'Ekranı Temizle',
    ctx_close: 'Ekranı Kapat',
    confirm_clear_screen: '"{name}" ekranındaki tüm çizimleri temizlemek istediğinize emin misiniz?',
    confirm_last_screen_clear: '"{name}" ekranındaki tüm çizimler temizlenecek. Devam etmek istiyor musunuz?',
    confirm_delete_screen: '"{name}" adlı ekranı silmek istediğinize emin misiniz?',

    all_screens_cap: 'TÜM EKRANLAR',
    screens_count: '{count} Ekran',
    overview_zoom_out_title: 'Uzaklaştır (Mouse Tekerleği Aşağı)',
    overview_zoom_in_title: 'Yakınlaştır (Mouse Tekerleği Yukarı)',
    overview_fit_title: 'Tümünü Ekrana Sığdır',
    close_overview_title: 'Editöre Dön (ESC)',
    return_to_editor: 'Editöre Dön',
    overview_hint: 'Mouse tekerleğiyle yakınlaştırıp uzaklaştırabilir, boş alandan sürükleyerek kaydırabilirsiniz. Düzenlemek istediğiniz ekrana tıklayın. İsimlere tıklayarak yeniden adlandırabilirsiniz.',
    edit_screen: 'Ekranı Düzenle',
    add_new_screen: 'Yeni Ekran Ekle',
    add_new_screen_title: 'Yeni bir OLED ekranı ekle',
    active_badge: 'Aktif',
    rename_screen_tooltip: 'Yeniden Adlandır (Enter)',

    status_no_selection: 'Seçili: Hiçbir nesne seçilmedi',
    status_selected: 'Seçili: {name} ({type})',
    status_tool_pencil: 'Araç: Kalem ({size} px)',
    status_tool_eraser: 'Araç: Silgi ({size} px)',
    status_tool_eraser_obj: 'Araç: Nesne Silgisi (Tek Tıkla Sil)',
    status_scale: 'Ölçek: {zoom}x',

    heading_properties: 'ÖZELLİKLER',
    heading_pencil_settings: 'KALEM AYARLARI',
    heading_eraser_settings: 'SİLGİ AYARLARI',
    delete_selected_title: 'Seçili Nesneyi Sil (Delete)',
    no_selection_hint: 'Düzenlemek veya taşımak için OLED ekranındaki bir nesneye tıklayın ya da sol bardan bir araç seçin.',
    label_eraser_mode: 'Silgi Modu',
    btn_erase_pixel: 'Piksel Sil',
    btn_erase_object: 'Nesne Sil',
    label_brush_size: 'Boyut Seçimi',
    label_pencil_thickness: 'Kalem Kalınlığı',
    label_eraser_size: 'Silgi Boyutu',
    brush_1px: '1 Piksel',
    brush_2px: '2 Piksel',
    brush_3px: '3 Piksel',
    brush_4px: '4 Piksel',

    label_x: 'X (Piksel)',
    label_y: 'Y (Piksel)',
    label_w: 'Genişlik (W)',
    label_r: 'Yarıçap (R)',
    label_h: 'Yükseklik (H)',
    label_text_content: 'Metin İçeriği',
    ph_text_content: 'Yazılacak metin...',
    label_font_size: 'Font Boyutu (Adafruit GFX Ölçeği)',
    font_size_1: 'Boyut 1 (6×8 px - Standart)',
    font_size_2: 'Boyut 2 (12×16 px)',
    font_size_3: 'Boyut 3 (18×24 px)',
    font_size_4: 'Boyut 4 (24×32 px)',
    shape_filled: 'İçi Dolu (Filled)',

    bitmap_settings_title: 'RESİM / BITMAP AYARLARI',
    label_threshold: 'Siyah/Beyaz Eşiği (Threshold)',
    threshold_dark: '0 (Koyu)',
    threshold_light: '255 (Açık)',
    label_conversion_mode: 'Dönüştürme Yöntemi',
    mode_threshold: 'Sabit Eşik (İkon & Logo İçin Net)',
    mode_dither: 'Floyd-Steinberg Dither (Fotoğraf İçin Gölgeli)',
    invert_colors_negative: 'Renkleri Ters Çevir (Negatif)',
    btn_orig_size_title: 'Resmi orijinal piksel boyutuna getir',
    btn_orig_size: 'Orijinal Boyut',
    btn_fit_screen_title: 'Resmi ekran sınırlarına orantılı sığdır',
    btn_fit_screen: 'Ekrana Sığdır',

    label_align: 'Hizala:',
    align_left: 'Sol',
    align_left_title: 'Sola Daya',
    align_center_h: 'Yatay Orta',
    align_center_h_title: 'Yatay Ortala',
    align_right: 'Sağ',
    align_right_title: 'Sağa Daya',
    align_center_v: 'Dikey Orta',
    align_center_v_title: 'Dikey Ortala',

    heading_layers: 'KATMANLAR',
    layers_count: '{count} nesne',
    no_layers_yet: 'Henüz nesne yok',
    layer_toggle_visibility: 'Gizle / Göster',
    layer_move_up: 'Yukarı Taşı',
    layer_move_down: 'Aşağı Taşı',

    heading_code: 'KOD',
    expand_code_title: 'Kodu Tam Ekran Yap',
    label_code_format: 'Format:',
    label_code_scope: 'Kapsam:',
    opt_adafruit: 'Adafruit SSD1306',
    opt_bitmap_progmem: 'Bitmap (PROGMEM)',
    opt_u8g2: 'U8g2 Kütüphanesi',
    scope_full_project: 'Tüm Proje (.ino)',
    scope_active_screen_only: 'Sadece Bu Ekran',
    scope_modular_header: 'screens.h (Modüler)',
    scope_bitmaps_only: 'Yalnızca Bitmapler',
    copy_code_title: 'Kodu Panoya Kopyala',
    copy: 'Kopyala',
    copied: 'Kopyalandı!',
    code_placeholder: '// Kod oluşturuluyor...',

    modal_code_title: 'Arduino OLED Kodu',
    modal_stat_flash: 'PROGMEM (Flash): {flash} Bayt',
    modal_stat_objects: 'Aktif Nesneler: {count}',
    close_esc_title: 'Kapat (ESC)',
    modal_footer_tip: 'İpucu: Kodu kapatmak için <strong>ESC</strong> tuşuna basabilir veya dışarıya tıklayabilirsiniz.',
    download_as_file: 'Dosya Olarak İndir',
    modal_code_placeholder: '// Tam ekran kod hazırlanıyor...',

    ctx_rename: 'Yeniden Adlandır',
    ctx_double_click: 'Çift Tık',
    ctx_clear: 'Ekranı Temizle',
    ctx_close: 'Ekranı Kapat',

    obj_rect: 'Kutu',
    obj_filled_rect: 'Dolu Kutu',
    obj_circle: 'Çember',
    obj_filled_circle: 'Dolu Çember',
    obj_line: 'Çizgi',
    obj_text: 'Metin',
    obj_bitmap: 'Resim / İkon',
    obj_default: 'Nesne',

    confirm_clear_screen: '"{name}" ekranındaki tüm çizimleri temizlemek istediğinize emin misiniz?',
    confirm_delete_screen: '"{name}" adlı ekranı silmek istediğinize emin misiniz?',
    confirm_clear_all: '"{name}" ekranındaki tüm çizimleri ve nesneleri temizlemek istediğinize emin misiniz?',
    confirm_last_screen_clear: '"{name}" ekranındaki tüm çizimler temizlenecek. Devam etmek istiyor musunuz?',
    alert_invalid_json: 'Geçersiz JSON proje dosyası!',

    code_no_bitmaps_notice: '// ==========================================================================\n// Projenizde henüz herhangi bir görsel/bitmap nesnesi bulunmuyor.\n// Sol menüden \'Resim Yükle\' veya kütüphaneden bir ikon ekleyin.\n// ==========================================================================',
    code_header_comment: '// ==========================================================================\n// Arduino OLED Studio - Otomatik Oluşturulan Kod\n// ==========================================================================',
    code_bitmap_defs_title: '// ==========================================================================\n// BITMAP TANIMLARI (PROGMEM)\n// ==========================================================================',
    code_screen_draw_func: '// Ekran Çizim Fonksiyonu: {name}',
    code_screens_dispatch: '// ==========================================================================\n// EKRAN YÖNETİCİSİ (DISPATCHER)\n// ==========================================================================',
  },

  en: {

    brand_title: 'OLED Studio',
    brand_sub: 'for Arduino and ESP32',

    undo: 'Undo (Ctrl+Z)',
    redo: 'Redo (Ctrl+Y)',
    label_screen: 'Screen:',
    zoom_out: 'Zoom Out',
    zoom_in: 'Zoom In',
    toggle_grid: 'Toggle Pixel Grid',
    grid: 'Grid',
    toggle_invert: 'Invert Screen',
    invert: 'Invert',
    label_pixel_color: 'Pixel:',
    color_white: 'White (Standard)',
    color_blue: 'OLED Blue',
    color_yellow: 'OLED Yellow',
    color_green: 'OLED Green',
    clear_all_title: 'Clear All Drawings and Objects',
    clear: 'Clear',
    open_json_title: 'Open JSON Project File',
    open: 'Open',
    download_ino_title: 'Download as Arduino .ino Code',
    download_ino: 'Download .ino',
    download_h: 'Download screens.h',

    section_tools: 'TOOLS',
    tool_select_title: 'Select & Move (V)',
    tool_select: 'Select',
    tool_pencil_title: 'Pixel Pencil (P)',
    tool_pencil: 'Pencil',
    tool_eraser_title: 'Pixel Eraser (E)',
    tool_eraser: 'Eraser',
    tool_text_title: 'Add Text (T)',
    tool_text: 'Text',
    tool_line_title: 'Line (L)',
    tool_line: 'Line',
    tool_rect_title: 'Rectangle (R)',
    tool_rect: 'Box',
    tool_filled_rect_title: 'Filled Rectangle',
    tool_filled_rect: 'Filled Box',
    tool_circle_title: 'Circle (C)',
    tool_circle: 'Circle',
    tool_filled_circle_title: 'Filled Circle',
    tool_filled_circle: 'Filled Circle',

    section_preset_icons: 'PRESET ICONS',
    icon_battery_full: 'Battery (Full)',
    icon_battery_half: 'Battery (Half)',
    icon_battery_empty: 'Battery (Empty)',
    icon_wifi: 'WiFi',
    icon_bluetooth: 'Bluetooth',
    icon_heart: 'Heart / Pulse',
    icon_thermometer: 'Temperature',
    icon_drop: 'Humidity / Water Drop',
    icon_clock: 'Clock',
    icon_bolt: 'Power / Bolt',
    icon_sun: 'Sun / Brightness',
    icon_moon: 'Moon / Night',
    icon_lock: 'Locked',
    icon_unlock: 'Unlocked',
    icon_gear: 'Settings / Gear',
    icon_home: 'Home',
    icon_speaker: 'Speaker / Sound',
    icon_mute: 'Mute',
    icon_alert: 'Warning / Alert',
    icon_trash: 'Trash',
    icon_arrow_up: 'Arrow Up',
    icon_arrow_down: 'Arrow Down',
    icon_arrow_left: 'Arrow Left',
    icon_arrow_right: 'Arrow Right',

    preset_name_battery_full: 'Battery Full',
    preset_name_battery_half: 'Battery Half',
    preset_name_battery_empty: 'Battery Empty',
    preset_name_wifi: 'WiFi',
    preset_name_bluetooth: 'Bluetooth',
    preset_name_heart: 'Heart',
    preset_name_thermometer: 'Temperature',
    preset_name_drop: 'Humidity',
    preset_name_clock: 'Clock',
    preset_name_bolt: 'Lightning',
    preset_name_sun: 'Sun',
    preset_name_moon: 'Moon',
    preset_name_lock: 'Lock',
    preset_name_unlock: 'Unlocked',
    preset_name_gear: 'Settings',
    preset_name_home: 'Home',
    preset_name_speaker: 'Sound',
    preset_name_mute: 'Mute',
    preset_name_alert: 'Alert',
    preset_name_trash: 'Trash',
    preset_name_arrow_up: 'Arrow Up',
    preset_name_arrow_down: 'Arrow Down',
    preset_name_arrow_left: 'Arrow Left',
    preset_name_arrow_right: 'Arrow Right',

    section_import_image: 'IMPORT IMAGE',
    upload_image_title: 'Upload 1-bit Monochrome Image',
    upload_image: 'Upload Image (.png, .bmp)',
    shortcuts_label: 'Shortcuts:',
    shortcuts_tip: 'V: Select | P: Pencil | E: Eraser | T: Text | Del: Delete',

    overview_mode_title: 'All Screens Overview (Figma Mode)',
    all_screens: 'All Screens',
    add_screen_title: 'Add New Screen (+)',
    default_screen_name: 'Screen',
    objects_count_badge: '{count} objects',
    close_screen: 'Close Screen',
    tab_title_tooltip: '{name} (Click to select, double click or right click to rename)',
    ctx_rename: 'Rename',
    ctx_double_click: 'Double Click',
    ctx_clear: 'Clear Screen',
    ctx_close: 'Close Screen',
    confirm_clear_screen: 'Are you sure you want to clear all drawings on screen "{name}"?',
    confirm_last_screen_clear: 'All drawings on screen "{name}" will be cleared. Do you want to proceed?',
    confirm_delete_screen: 'Are you sure you want to delete screen "{name}"?',

    all_screens_cap: 'ALL SCREENS',
    screens_count: '{count} Screen(s)',
    overview_zoom_out_title: 'Zoom Out (Mouse Wheel Down)',
    overview_zoom_in_title: 'Zoom In (Mouse Wheel Up)',
    overview_fit_title: 'Fit All to Screen',
    close_overview_title: 'Return to Editor (ESC)',
    return_to_editor: 'Return to Editor',
    overview_hint: 'Zoom in/out with the mouse wheel and pan by dragging empty area. Click any screen to edit it, or click the title to rename.',
    edit_screen: 'Edit Screen',
    add_new_screen: 'Add New Screen',
    add_new_screen_title: 'Add a new OLED screen',
    active_badge: 'Active',
    rename_screen_tooltip: 'Rename (Enter)',

    status_no_selection: 'Selected: No object selected',
    status_selected: 'Selected: {name} ({type})',
    status_tool_pencil: 'Tool: Pencil ({size} px)',
    status_tool_eraser: 'Tool: Eraser ({size} px)',
    status_tool_eraser_obj: 'Tool: Object Eraser (Click to Delete)',
    status_scale: 'Scale: {zoom}x',

    heading_properties: 'PROPERTIES',
    heading_pencil_settings: 'PENCIL SETTINGS',
    heading_eraser_settings: 'ERASER SETTINGS',
    delete_selected_title: 'Delete Selected Object (Delete)',
    no_selection_hint: 'Click on an object on the OLED screen to edit or move, or select a tool from the left toolbar.',
    label_eraser_mode: 'Eraser Mode',
    btn_erase_pixel: 'Erase Pixels',
    btn_erase_object: 'Erase Object',
    label_brush_size: 'Size Selection',
    label_pencil_thickness: 'Pencil Thickness',
    label_eraser_size: 'Eraser Size',
    brush_1px: '1 Pixel',
    brush_2px: '2 Pixels',
    brush_3px: '3 Pixels',
    brush_4px: '4 Pixels',

    label_x: 'X (Pixel)',
    label_y: 'Y (Pixel)',
    label_w: 'Width (W)',
    label_r: 'Radius (R)',
    label_h: 'Height (H)',
    label_text_content: 'Text Content',
    ph_text_content: 'Enter text here...',
    label_font_size: 'Font Size (Adafruit GFX Scale)',
    font_size_1: 'Size 1 (6×8 px - Standard)',
    font_size_2: 'Size 2 (12×16 px)',
    font_size_3: 'Size 3 (18×24 px)',
    font_size_4: 'Size 4 (24×32 px)',
    shape_filled: 'Filled Shape',

    bitmap_settings_title: 'IMAGE / BITMAP SETTINGS',
    label_threshold: 'Monochrome Threshold',
    threshold_dark: '0 (Dark)',
    threshold_light: '255 (Light)',
    label_conversion_mode: 'Conversion Method',
    mode_threshold: 'Fixed Threshold (Crisp for Icons & Logos)',
    mode_dither: 'Floyd-Steinberg Dither (Shaded for Photos)',
    invert_colors_negative: 'Invert Colors (Negative)',
    btn_orig_size_title: 'Reset image to original pixel dimensions',
    btn_orig_size: 'Original Size',
    btn_fit_screen_title: 'Proportionally fit image to screen dimensions',
    btn_fit_screen: 'Fit to Screen',

    label_align: 'Align:',
    align_left: 'Left',
    align_left_title: 'Align Left',
    align_center_h: 'Center H',
    align_center_h_title: 'Center Horizontally',
    align_right: 'Right',
    align_right_title: 'Align Right',
    align_center_v: 'Center V',
    align_center_v_title: 'Center Vertically',

    heading_layers: 'LAYERS',
    layers_count: '{count} objects',
    no_layers_yet: 'No objects yet',
    layer_toggle_visibility: 'Hide / Show',
    layer_move_up: 'Move Up',
    layer_move_down: 'Move Down',

    heading_code: 'CODE',
    expand_code_title: 'Expand Code Fullscreen',
    label_code_format: 'Format:',
    label_code_scope: 'Scope:',
    opt_adafruit: 'Adafruit SSD1306',
    opt_bitmap_progmem: 'Bitmap (PROGMEM)',
    opt_u8g2: 'U8g2 Library',
    scope_full_project: 'Full Project (.ino)',
    scope_active_screen_only: 'Active Screen Only',
    scope_modular_header: 'screens.h (Modular)',
    scope_bitmaps_only: 'Bitmaps Only',
    copy_code_title: 'Copy Code to Clipboard',
    copy: 'Copy',
    copied: 'Copied!',
    code_placeholder: '// Generating code...',

    modal_code_title: 'Arduino OLED Code',
    modal_stat_flash: 'PROGMEM (Flash): {flash} Bytes',
    modal_stat_objects: 'Active Objects: {count}',
    close_esc_title: 'Close (ESC)',
    modal_footer_tip: 'Tip: You can press <strong>ESC</strong> or click outside to close the code view.',
    download_as_file: 'Download as File',
    modal_code_placeholder: '// Generating fullscreen code...',

    ctx_rename: 'Rename',
    ctx_double_click: 'Double Click',
    ctx_clear: 'Clear Screen',
    ctx_close: 'Close Screen',

    obj_rect: 'Box',
    obj_filled_rect: 'Filled Box',
    obj_circle: 'Circle',
    obj_filled_circle: 'Filled Circle',
    obj_line: 'Line',
    obj_text: 'Text',
    obj_bitmap: 'Image / Icon',
    obj_default: 'Object',

    confirm_clear_screen: 'Are you sure you want to clear all drawings on "{name}"?',
    confirm_delete_screen: 'Are you sure you want to delete the screen "{name}"?',
    confirm_clear_all: 'Are you sure you want to clear all drawings and objects on "{name}"?',
    confirm_last_screen_clear: 'All drawings on "{name}" will be cleared. Do you want to continue?',
    alert_invalid_json: 'Invalid JSON project file!',

    code_no_bitmaps_notice: '// ==========================================================================\n// No bitmap or image objects found in your project.\n// Add an image from \'Upload Image\' or pick an icon from the library.\n// ==========================================================================',
    code_header_comment: '// ==========================================================================\n// Arduino OLED Studio - Auto-Generated Code\n// ==========================================================================',
    code_bitmap_defs_title: '// ==========================================================================\n// BITMAP DEFINITIONS (PROGMEM)\n// ==========================================================================',
    code_screen_draw_func: '// Screen Draw Function: {name}',
    code_screens_dispatch: '// ==========================================================================\n// SCREEN DISPATCHER\n// ==========================================================================',
  }
};

let currentLang = 'tr';
const langChangeListeners = [];

function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;
  let text = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.tr[key] || key);

  if (typeof text === 'string' && params && typeof params === 'object') {
    Object.keys(params).forEach(pKey => {
      text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), params[pKey]);
    });
  }
  return text;
}

function getLang() {
  return currentLang;
}

function onLanguageChange(fn) {
  if (typeof fn === 'function') {
    langChangeListeners.push(fn);
  }
}

function applyTranslationsToDOM() {

  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) {
      el.innerHTML = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });

  const codeEl = document.getElementById('langCurrentCode');
  if (codeEl) {
    codeEl.textContent = currentLang.toUpperCase();
  }

  document.querySelectorAll('.lang-option, .lang-btn').forEach(btn => {
    const lang = btn.getAttribute('data-lang');
    btn.classList.toggle('active', lang === currentLang);
  });
}

function setLang(lang) {
  if (lang !== 'tr' && lang !== 'en') return;
  currentLang = lang;
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (e) {

  }

  applyTranslationsToDOM();

  langChangeListeners.forEach(listener => {
    try {
      listener(currentLang);
    } catch (err) {
      console.error('Error in language change listener:', err);
    }
  });
}

function initI18n() {
  let saved = null;
  try {
    saved = localStorage.getItem(I18N_STORAGE_KEY);
  } catch (e) {}

  if (saved === 'en' || saved === 'tr') {
    currentLang = saved;
  } else {

    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('en')) {
      currentLang = 'en';
    } else {
      currentLang = 'tr';
    }
  }

  document.querySelectorAll('.lang-option, .lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetLang = btn.getAttribute('data-lang');
      if (targetLang) {
        setLang(targetLang);
        const dropdown = document.getElementById('langDropdown');
        if (dropdown) dropdown.classList.remove('open');
      }
    });
  });

  const trigger = document.getElementById('langTrigger');
  const dropdown = document.getElementById('langDropdown');
  if (trigger && dropdown) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  applyTranslationsToDOM();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18n);
} else {
  initI18n();
}
