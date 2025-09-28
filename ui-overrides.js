/*
  UI overrides: language switcher and dark-toggle label sync.
  This file is intentionally small and independent so it can update UI texts
  without modifying the larger script files.
*/
(function() {
  const translations = {
    fr: {
      title: 'Amesis Scaling Maps v1.05',
      subtitle: 'Logiciel de redimensionnement de cartographie.',
      table_map1: 'Tableau',
      width: 'Largeur X:',
      height: 'Hauteur Y:',
      palette: 'Palette:',
      alpha: 'Alpha:',
      links: 'Liaisons:',
      points: 'Points:',
      copyBtn: 'Copier Map1 → Map2',
      map2_table: 'Map 2 Tableau',
      viz: 'Visualisation 3D (isométrique)',
      dark_on: 'Mode sombre : On',
      dark_off: 'Mode sombre : Off'
    },
    en: {
      title: 'Amesis Scaling Maps v1.05',
      subtitle: 'Mapping resizing software.',
      table_map1: 'Table',
      width: 'Width X:',
      height: 'Height Y:',
      palette: 'Palette:',
      alpha: 'Alpha:',
      links: 'Links:',
      points: 'Points',
      copyBtn: 'Copy Map1 → Map2',
      map2_table: 'Map 2 Table',
      viz: '3D Visualization (isometric)',
      dark_on: 'Dark mode: On',
      dark_off: 'Dark mode: Off'
    }
  };

  let currentLang = 'fr';

  function applyTranslations(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    // data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang][key] !== undefined) el.textContent = translations[lang][key];
    });
    // dynamic titles with dimensions
    const tabTitle = document.getElementById('tab-title');
    const sizeX = document.getElementById('sizeX');
    const sizeY = document.getElementById('sizeY');
    if (tabTitle) {
      const xs = sizeX ? sizeX.value : '6';
      const ys = sizeY ? sizeY.value : '6';
      tabTitle.textContent = `${translations[lang].table_map1} ${xs}×${ys} Map 1`;
    }
    const tabTitle2 = document.getElementById('tab-title2');
    const sizeX2 = document.getElementById('sizeX2');
    const sizeY2 = document.getElementById('sizeY2');
    if (tabTitle2) {
      const xs2 = sizeX2 ? sizeX2.value : '6';
      const ys2 = sizeY2 ? sizeY2.value : '6';
      tabTitle2.textContent = `${translations[lang].map2_table} ${xs2}×${ys2}`;
    }
    const subtitle = document.getElementById('subtitle');
    if (subtitle) subtitle.textContent = translations[lang].subtitle;
    const copyBtn = document.getElementById('copyMapBtn');
    if (copyBtn) copyBtn.textContent = translations[lang].copyBtn;
    // dark toggle label
    updateDarkLabel();
  }

  function updateDarkLabel() {
    const toggle = document.getElementById('darkToggle');
    if (!toggle) return;
    const dark = document.body.classList.contains('dark');
    toggle.textContent = dark ? translations[currentLang].dark_on : translations[currentLang].dark_off;
  }

  // Hook language buttons
  const langFr = document.getElementById('langFr');
  const langEn = document.getElementById('langEn');
  if (langFr) langFr.addEventListener('click', () => { applyTranslations('fr'); });
  if (langEn) langEn.addEventListener('click', () => { applyTranslations('en'); });

  // Observe body class changes to update dark label
  const bodyObserver = new MutationObserver(() => updateDarkLabel());
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Update titles when size inputs change
  ['sizeX','sizeY','sizeX2','sizeY2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => applyTranslations(currentLang));
  });

  // Initialize
  applyTranslations(currentLang);
})();