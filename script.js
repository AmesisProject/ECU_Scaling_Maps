(function() {
  // Centralized version constant (use this to bump the app version everywhere)
  const VERSION = 'v1.02';
  // expose globally so other small scripts (ui-overrides.js, script2.js) can read it
  window.VERSION = VERSION;

  let sizeX = 6;
  let sizeY = 6;
  let elevationScale = 1.0;
  // Initialize Map1 with a pattern: each row = [1, 2, 3, ... sizeX]
  let data = Array.from({ length: sizeY }, () =>
    Array.from({ length: sizeX }, (_, idx) => idx + 1)
  );

  // Color palette management
  const palette = {
    min: { r: 144, g: 238, b: 144 }, // Light green
    mid: { r: 255, g: 255, b: 0 },   // Yellow
    max: { r: 255, g: 0, b: 0 },     // Red
    line: { r: 128, g: 128, b: 128 }, // Gray
    point: { r: 0, g: 0, b: 0 },     // Black
    alpha: 1.0
  };

  // Simple internationalization strings (FR/EN)
  const translations = {
    fr: {
      title: 'Amesis Scaling Maps v1.02',
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
      title: 'Amesis Scaling Maps v1.02',
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

  // Apply translations to elements carrying data-i18n attributes
  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang][key] !== undefined) {
        el.textContent = translations[lang][key];
      }
    });
    // Update specific labels that contain dynamic parts
    const tabTitleEl = document.getElementById('tab-title');
    if (tabTitleEl) tabTitleEl.textContent = `${translations[lang].table_map1} ${sizeX}×${sizeY} Map 1`;
    const tabTitle2El = document.getElementById('tab-title2');
    if (tabTitle2El) tabTitle2El.textContent = `${translations[lang].map2_table} ${sizeX2 ? sizeX2 : 6}×${sizeY2 ? sizeY2 : 6}`;
    // Update dark toggle text according to current state
    const dark = document.body.classList.contains('dark');
    const toggleBtn = document.getElementById('darkToggle');
    if (toggleBtn) toggleBtn.textContent = dark ? translations[lang].dark_on : translations[lang].dark_off;
    // Update copy button text if present
    const copyBtn = document.getElementById('copyMapBtn');
    if (copyBtn) copyBtn.textContent = translations[lang].copyBtn;
  }

  /**
   * Converts a hexadecimal color string to an RGB object.
   * @param {string} hex - The hexadecimal color string (e.g., "#RRGGBB").
   * @returns {object|null} An object with r, g, b properties, or null if invalid.
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Creates an RGBA color string.
   * @param {number} r - Red component (0-255).
   * @param {number} g - Green component (0-255).
   * @param {number} b - Blue component (0-255).
   * @param {number} a - Alpha component (0-1).
   * @returns {string} The RGBA color string.
   */
  function rgbaString(r, g, b, a) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * Mixes two RGB colors based on a blending factor.
   * @param {object} a - The first RGB color object.
   * @param {object} b - The second RGB color object.
   * @param {number} t - The blending factor (0-1).
   * @returns {object} The mixed RGB color object.
   */
  function mix(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
  }

  /**
   * Calculates a color from the palette based on a value within a min/max range.
   * Uses a three-point gradient (min, mid, max).
   * @param {number} value - The data value.
   * @param {number} minV - The minimum possible data value.
   * @param {number} maxV - The maximum possible data value.
   * @returns {object} The calculated RGB color object.
   */
  function gradientColor(value, minV, maxV) {
    if (maxV === minV) return palette.min;
    const t = Math.max(0, Math.min(1, (value - minV) / (maxV - minV)));
    if (t < 0.5) {
      return mix(palette.min, palette.mid, t * 2);
    } else {
      return mix(palette.mid, palette.max, (t - 0.5) * 2);
    }
  }

  const table = document.getElementById('grid');
  /**
   * Renders the HTML table based on the current sizeX, sizeY, and data.
   */
  function renderTable() {
    const head = '<thead>' +
      '<tr>' + '<th></th>' + Array.from({length: sizeX}, (_, i) => `<th>C${i+1}</th>`).join('') + '</tr>' +
    '</thead>';
    const body = '<tbody>' +
      data.map((row, r) => (
        '<tr>' + `<th>L${r+1}</th>` + row.map((v, c) => `<td contenteditable="true" inputmode="numeric" data-r="${r}" data-c="${c}">${v}</td>`).join('') + '</tr>'
      )).join('') +
    '</tbody>';
    table.innerHTML = head + body;
  }

  // Simple isometric renderer on Canvas
  const canvas = document.getElementById('iso');
  const ctx = canvas.getContext('2d');

  /**
   * Resizes the canvas to match its parent element's dimensions,
   * accounting for device pixel ratio for sharp rendering.
   */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing by DPR
  }

  /**
   * Linear interpolation between two values.
   * @param {number} a - Start value.
   * @param {number} b - End value.
   * @param {number} t - Interpolation factor (0-1).
   * @returns {number} The interpolated value.
   */
  function lerp(a, b, t) { return a + (b - a) * t; }

  /**
   * Determines the color for a given value, considering the max value and dark mode.
   * This function is used for the table cells.
   * @param {number} value - The data value.
   * @param {number} maxV - The maximum possible data value.
   * @param {boolean} dark - True if dark mode is active.
   * @returns {string} The RGBA color string.
   */
  function colorFor(value, maxV, dark) {
    const minV = Math.min(...data.flat());
    const color = gradientColor(value, minV, maxV);
    return rgbaString(color.r, color.g, color.b, palette.alpha);
  }

  /**
   * Determines the color for a given value, specifically for 3D surfaces.
   * Surfaces use transparency, while lines and points remain opaque.
   * @param {number} value - The data value.
   * @param {number} maxV - The maximum possible data value.
   * @param {boolean} dark - True if dark mode is active.
   * @returns {string} The RGBA color string.
   */
  function colorFor3D(value, maxV, dark) {
    const minV = Math.min(...data.flat());
    const color = gradientColor(value, minV, maxV);
    // Surfaces 3D utilisent la transparence; lignes et points restent opaques
    return rgbaString(color.r, color.g, color.b, palette.alpha);
  }

  // Camera state variables for 3D visualization
  let zoom = 1.0;
  let rotation = 0; // radians, rotation around the Z-axis (vertical)
  let originX = null; // X-coordinate of the isometric origin on the canvas (CSS px, after DPR scaling)
  let originY = null; // Y-coordinate of the isometric origin on the canvas (CSS px, after DPR scaling)

  /**
   * Main function to draw the isometric 3D visualization on the canvas.
   */
  function drawIso() {
    resizeCanvas();
    const dark = document.body.classList.contains('dark');

    // Clear canvas and draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = dark ? '#0b0d12' : '#eef2f8'; // Dark or light background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const cols = sizeX, rows = sizeY;
    // Determine the maximum value in the data for color scaling, ensuring it's at least 1 to avoid division by zero.
    const maxV = Math.max(1, ...data.flat());
    // Calculate a base tile size relative to the smaller canvas dimension.
    const base = Math.min(canvas.width, canvas.height) / 8;
    // Calculate the zoomed tile size.
    const tile = base * zoom;
    // Calculate the height scale for elevation based on tile size and elevationScale factor.
    const hScale = tile * 0.35 * elevationScale;

    // Initialize origin if not set (e.g., on first load or after major resize)
    if (originX === null || originY === null) {
      originX = (canvas.width / (window.devicePixelRatio || 1)) / 2;
      originY = (canvas.height / (window.devicePixelRatio || 1)) / 2 - tile * 0.5;
    }

    /**
     * Converts grid coordinates (row, column, elevation) to isometric canvas coordinates.
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @param {number} z - Elevation value.
     * @returns {Array<number>} An array [x, y] representing the isometric canvas coordinates.
     */
    function isoPoint(r, c, z) {
      // Center grid around (0,0) before applying rotation.
      const cx = c - (cols - 1) / 2;
      const cy = r - (rows - 1) / 2;

      // Rotate coordinates in the ground plane.
      const xr = cx * Math.cos(rotation) - cy * Math.sin(rotation);
      const yr = cx * Math.sin(rotation) + cy * Math.cos(rotation);

      // Apply isometric projection transformation.
      const x = (xr - yr) * (tile / 2);
      const y = (xr + yr) * (tile / 4) - z * hScale;

      // Translate to the canvas origin.
      return [originX + x, originY + y];
    }

    // Build a 2D array of points, where each point stores its isometric canvas coordinates and original value.
    const points = Array.from({ length: rows }, () => Array(cols));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = data[r][c];
        points[r][c] = { p: isoPoint(r, c, v), v };
      }
    }

    // Build filled surface (triangles) between points for 3D rendering.
    // Each square on the grid is divided into two triangles.
    const tris = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = points[r][c];
        const b = points[r][c + 1];
        const d = points[r + 1][c];
        const e = points[r + 1][c + 1];
        // Triangle 1: top-left, top-right, bottom-right
        const tri1 = { pts: [a.p, b.p, e.p], v: (a.v + b.v + e.v) / 3, y: (a.p[1] + b.p[1] + e.p[1]) / 3 };
        // Triangle 2: top-left, bottom-right, bottom-left
        const tri2 = { pts: [a.p, e.p, d.p], v: (a.v + e.v + d.v) / 3, y: (a.p[1] + e.p[1] + d.p[1]) / 3 };
        tris.push(tri1, tri2);
      }
    }
    // Sort triangles by their average Y-coordinate to ensure correct drawing order (painter's algorithm for depth).
    tris.sort((t1, t2) => t1.y - t2.y);

    // Draw the filled surfaces (triangles).
    for (const t of tris) {
      ctx.beginPath();
      ctx.moveTo(t.pts[0][0], t.pts[0][1]);
      ctx.lineTo(t.pts[1][0], t.pts[1][1]);
      ctx.lineTo(t.pts[2][0], t.pts[2][1]);
      ctx.closePath();
      const fillCol = colorFor3D(t.v, maxV, document.body.classList.contains('dark'));
      ctx.fillStyle = fillCol;
      ctx.globalAlpha = 0.9; // Apply slight transparency to surfaces
      ctx.fill();
      ctx.globalAlpha = 1.0; // Reset alpha for subsequent drawings
    }

    // Draw wireframe mesh (lines between neighbors)
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgbaString(palette.line.r, palette.line.g, palette.line.b, 1.0); // Use opaque line color
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { p: [x, y] } = points[r][c];
        // Draw line to the right neighbor
        if (c + 1 < cols) {
          const { p: [x2, y2] } = points[r][c + 1];
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        }
        // Draw line to the bottom neighbor
        if (r + 1 < rows) {
          const { p: [x3, y3] } = points[r + 1][c];
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x3, y3); ctx.stroke();
        }
      }
    }

    // Draw points at each grid intersection.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { p: [x, y], v } = points[r][c];
        const col = colorFor3D(v, maxV, dark); // Use 3D color for points
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, tile * 0.04), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Color controls initialization and event handlers
  /**
   * Initializes the color pickers and their associated buttons,
   * and sets up event listeners for color changes and alpha slider.
   */
  function initColorControls() {
    // Set default colors for the color input elements
    document.getElementById('cMin').value = '#90EE90';
    document.getElementById('cMid').value = '#FFFF00';
    document.getElementById('cMax').value = '#FF0000';
    document.getElementById('cLine').value = '#808080';
    document.getElementById('cPoint').value = '#000000';
    
    // Update the visual representation of the color buttons
    updateColorButtons();
    
    // Event handlers for color input changes
    document.getElementById('cMin').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.min = rgb;
        updateColorButtons();
        colorizeTable();
        drawIso();
      }
    });
    
    document.getElementById('cMid').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.mid = rgb;
        updateColorButtons();
        colorizeTable();
        drawIso();
      }
    });
    
    document.getElementById('cMax').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.max = rgb;
        updateColorButtons();
        colorizeTable();
        drawIso();
      }
    });
    
    document.getElementById('cLine').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.line = rgb;
        updateColorButtons();
        drawIso();
      }
    });
    
    document.getElementById('cPoint').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.point = rgb;
        updateColorButtons();
        drawIso();
      }
    });
    
    // Alpha slider event handler
    document.getElementById('alpha').addEventListener('input', (e) => {
      palette.alpha = parseFloat(e.target.value);
      document.getElementById('alphaVal').textContent = palette.alpha.toFixed(2);
      colorizeTable();
      drawIso(); // Apply alpha to 3D view surfaces only
    });
    
    // Button click handlers to trigger hidden color input clicks
    document.getElementById('cMinBtn').addEventListener('click', () => {
      document.getElementById('cMin').click();
    });
    
    document.getElementById('cMidBtn').addEventListener('click', () => {
      document.getElementById('cMid').click();
    });
    
    document.getElementById('cMaxBtn').addEventListener('click', () => {
      document.getElementById('cMax').click();
    });
    
    document.getElementById('cLineBtn').addEventListener('click', () => {
      document.getElementById('cLine').click();
    });
    
    document.getElementById('cPointBtn').addEventListener('click', () => {
      document.getElementById('cPoint').click();
    });
  }
  
  /**
   * Updates the background color of the color palette buttons
   * to reflect the currently selected colors.
   */
  function updateColorButtons() {
    document.getElementById('cMinBtn').style.backgroundColor = `rgb(${palette.min.r}, ${palette.min.g}, ${palette.min.b})`;
    document.getElementById('cMidBtn').style.backgroundColor = `rgb(${palette.mid.r}, ${palette.mid.g}, ${palette.mid.b})`;
    document.getElementById('cMaxBtn').style.backgroundColor = `rgb(${palette.max.r}, ${palette.max.g}, ${palette.max.b})`;
    document.getElementById('cLineBtn').style.backgroundColor = `rgb(${palette.line.r}, ${palette.line.g}, ${palette.line.b})`;
    document.getElementById('cPointBtn').style.backgroundColor = `rgb(${palette.point.r}, ${palette.point.g}, ${palette.point.b})`;
  }
  
  /**
   * Applies gradient colors to the table cells based on their numerical values
   * and the current color palette and alpha setting.
   */
  function colorizeTable() {
    const cells = table.querySelectorAll('td[contenteditable]');
    const values = Array.from(cells).map(cell => Number(cell.textContent));
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    
    cells.forEach(cell => {
      const value = Number(cell.textContent);
      const color = gradientColor(value, minV, maxV);
      cell.style.backgroundColor = rgbaString(color.r, color.g, color.b, palette.alpha);
    });
  }

  // Initial setup and rendering
  renderTable();
  initColorControls();
  colorizeTable();
  drawIso();

  // Elevation scale slider event listener
  document.getElementById('elevationScale').addEventListener('input', (e) => {
    elevationScale = parseFloat(e.target.value);
    drawIso();
  });

  // Resizable panels functionality (supports multiple containers/resizers)
  const resizers = Array.from(document.querySelectorAll('.resizer'));
  let isResizing = false;
  let currentContainer = null;

  resizers.forEach(r => {
    r.addEventListener('mousedown', (e) => {
      isResizing = true;
      currentContainer = r.closest('.container');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing || !currentContainer) return;
    const rect = currentContainer.getBoundingClientRect();
    // Determine left and right panel indices (common structure: [section.card, .resizer, section.card])
    const leftIdx = 0;
    const rightIdx = currentContainer.children.length > 2 ? 2 : 1;
    const leftWidth = Math.max(200, Math.min(e.clientX - rect.left, rect.width - 200 - 5));
    const rightWidth = rect.width - leftWidth - (currentContainer.querySelector('.resizer') ? currentContainer.querySelector('.resizer').getBoundingClientRect().width : 5);
    if (currentContainer.children[leftIdx]) currentContainer.children[leftIdx].style.flexBasis = leftWidth + 'px';
    if (currentContainer.children[rightIdx]) currentContainer.children[rightIdx].style.flexBasis = rightWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    currentContainer = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Notify all instances to redraw (some instances listen for this)
    window.dispatchEvent(new Event('redraw'));
  });

  window.addEventListener('resize', () => {
    // re-center only if origin was never set; otherwise preserve user-adjusted origin
    if (originX === null || originY === null) {
      originX = null; originY = null; // force init in next draw
    }
    drawIso();
    // notify other instances to redraw as well
    window.dispatchEvent(new Event('redraw'));
  });

  // Editable cells: commit on Enter/blur, cancel on Escape
  table.addEventListener('focusin', (e) => {
    const td = e.target.closest('td[contenteditable]');
    if (!td) return;
    td.dataset.oldValue = td.textContent; // Store old value for potential escape
    clearSelection();
    selectCell(td);
  });
  table.addEventListener('keydown', (e) => {
    const td = e.target.closest('td[contenteditable]');
    if (!td) return;
    if (e.key === 'Enter') { e.preventDefault(); td.blur(); } // Commit on Enter
    if (e.key === 'Escape') { e.preventDefault(); td.textContent = td.dataset.oldValue || ''; td.blur(); } // Cancel on Escape
  });
  table.addEventListener('blur', (e) => {
    const td = e.target.closest('td[contenteditable]');
    if (!td) return;
    const r = Number(td.getAttribute('data-r'));
    const c = Number(td.getAttribute('data-c'));
    const val = td.textContent.trim();
    const num = Number(val.replace(/,/g, '.')); // Allow comma as decimal separator
    if (!Number.isFinite(num)) { td.textContent = td.dataset.oldValue || '0'; return; } // Revert if not a valid number
    const clamped = Math.max(-9999, Math.min(9999, Math.round(num))); // Clamp and round value
    data[r][c] = clamped; // Update data model
    td.textContent = String(clamped); // Update cell display
    colorizeTable(); // Recolor table
    drawIso(); // Redraw 3D view
  }, true);


  // Dark mode toggle functionality
  const toggleBtn = document.getElementById('darkToggle');
  /**
   * Synchronizes the dark mode toggle button's text and aria-pressed state
   * with the current dark mode status of the body.
   */
  function syncToggleState() {
    const dark = document.body.classList.contains('dark');
    toggleBtn.setAttribute('aria-pressed', String(dark));
    toggleBtn.textContent = dark ? 'Désactiver le mode sombre' : 'Activer le mode sombre';
  }
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    syncToggleState();
    drawIso(); // Redraw 3D view to apply dark mode styles
  });
  syncToggleState(); // Initial sync on load

  // Size control functionality
  const sizeInputX = document.getElementById('sizeX');
  const sizeInputY = document.getElementById('sizeY');
  const subtitle = document.getElementById('subtitle');
  const tabTitle = document.getElementById('tab-title');
  /**
   * Regenerates the data grid and updates the UI based on new X and Y dimensions.
   * @param {number} nx - New width (X dimension).
   * @param {number} ny - New height (Y dimension).
   */
  function regenerateDataXY(nx, ny) {
    const clampedX = Math.max(2, Math.min(50, Math.floor(nx))); // Clamp X between 2 and 50
    const clampedY = Math.max(2, Math.min(50, Math.floor(ny))); // Clamp Y between 2 and 50
    sizeX = clampedX; sizeY = clampedY;
    // Initialize new grid with the pattern requested: each row = [1, 2, 3, ..., sizeX]
    data = Array.from({ length: sizeY }, () =>
      Array.from({ length: sizeX }, (_, idx) => idx + 1)
    );
    subtitle.textContent = `Cartographie ${sizeX}×${sizeY} avec aperçu 3D isométrique. (v0.03)`;
    tabTitle.textContent = `Tableau ${sizeX}×${sizeY}`;
    renderTable();
    colorizeTable();
    // Keep origin in view on major size change by resetting it
    originX = null; originY = null;
    drawIso();
  }
  sizeInputX.addEventListener('change', () => regenerateDataXY(Number(sizeInputX.value), Number(sizeInputY.value)));
  sizeInputY.addEventListener('change', () => regenerateDataXY(Number(sizeInputX.value), Number(sizeInputY.value)));

  // Zoom with mouse wheel functionality
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // Prevent page scrolling
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // Mouse X relative to canvas
    const mouseY = e.clientY - rect.top;   // Mouse Y relative to canvas
    const factor = Math.exp(-e.deltaY * 0.0015); // Calculate zoom factor
    const newZoom = Math.max(0.4, Math.min(3.5, zoom * factor)); // Clamp zoom level
    const scale = newZoom / zoom;
    // Scale around mouse pointer: adjust origin so the mouse stays anchored
    if (originX === null || originY === null) {
      originX = (canvas.width / (window.devicePixelRatio || 1)) / 2;
      originY = (canvas.height / (window.devicePixelRatio || 1)) / 2;
    }
    originX = mouseX - scale * (mouseX - originX);
    originY = mouseY - scale * (mouseY - originY);
    zoom = newZoom;
    drawIso(); // Redraw with new zoom
  }, { passive: false });

  // Rotation with drag functionality
  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotation -= dx * 0.01; // Invert rotation direction for intuitive drag
    drawIso(); // Redraw with new rotation
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false; canvas.releasePointerCapture(e.pointerId);
  });

  // Cell selection functionality
  let selectedCells = new Set();
  let isSelecting = false;
  let startCell = null;

  /**
   * Adds a cell to the selected set and applies a 'selected' class.
   * @param {HTMLElement} td - The table cell element.
   */
  function selectCell(td) {
    selectedCells.add(td);
    td.classList.add('selected');
  }

  /**
   * Removes a cell from the selected set and removes the 'selected' class.
   * @param {HTMLElement} td - The table cell element.
   */
  function deselectCell(td) {
    selectedCells.delete(td);
    td.classList.remove('selected');
  }

  /**
   * Clears all currently selected cells.
   */
  function clearSelection() {
    selectedCells.forEach(td => td.classList.remove('selected'));
    selectedCells.clear();
  }

  /**
   * Selects a range of cells from a starting cell to an ending cell.
   * @param {HTMLElement} start - The starting table cell.
   * @param {HTMLElement} end - The ending table cell.
   */
  function selectRange(start, end) {
    clearSelection();
    const startR = +start.dataset.r;
    const startC = +start.dataset.c;
    const endR = +end.dataset.r;
    const endC = +end.dataset.c;
    const minR = Math.min(startR, endR);
    const maxR = Math.max(startR, endR);
    const minC = Math.min(startC, endC);
    const maxC = Math.max(startC, endC);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const td = table.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
        if (td) {
          selectCell(td);
        }
      }
    }
  }

  table.addEventListener('mousedown', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    clearSelection();
    startCell = td;
    selectCell(td);
    isSelecting = true;
  });

  table.addEventListener('mousemove', (e) => {
    if (!isSelecting || !startCell) return;
    const td = e.target.closest('td');
    if (td) {
      selectRange(startCell, td);
    }
  });

  table.addEventListener('mouseup', () => {
    isSelecting = false;
    startCell = null;
  });

  document.addEventListener('mousedown', (e) => {
    if (!table.contains(e.target)) {
      clearSelection();
    }
  });

  // Copy paste functionality
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey)) { // Check for Ctrl or Cmd key
      if (e.key === 'c') { // Copy
        e.preventDefault();
        if (selectedCells.size == 0) {
          // If no cells are selected, select all cells for copy
          for (let r = 0; r < sizeY; r++) {
            for (let c = 0; c < sizeX; c++) {
              const td = table.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
              if (td) selectCell(td);
            }
          }
        }
        copySelected();
      } else if (e.key === 'v') { // Paste
        e.preventDefault();
        if (selectedCells.size == 0) {
          // If no cells are selected, select all cells for paste
          for (let r = 0; r < sizeY; r++) {
            for (let c = 0; c < sizeX; c++) {
              const td = table.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
              if (td) selectCell(td);
            }
          }
        }
        pasteSelected();
      } else if (e.key === 'b') { // Reset view (zoom, rotation, origin)
        e.preventDefault();
        zoom = Math.min(1.0, 10 / Math.max(sizeX, sizeY)); // Adjust zoom based on grid size
        rotation = 0;
        originX = null;
        originY = null;
        drawIso();
      }
    }
  });

  /**
   * Copies the content of selected cells to the clipboard as tab-separated values.
   */
  function copySelected() {
    const cells = Array.from(selectedCells);
    // Determine the bounding box of selected cells
    const minR = Math.min(...cells.map(td => +td.dataset.r));
    const maxR = Math.max(...cells.map(td => +td.dataset.r));
    const minC = Math.min(...cells.map(td => +td.dataset.c));
    const maxC = Math.max(...cells.map(td => +td.dataset.c));
    const rows = [];
    // Iterate through the bounding box to construct the copied data
    for (let r = minR; r <= maxR; r++) {
      const row = [];
      for (let c = minC; c <= maxC; c++) {
        const td = table.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
        row.push(td ? td.textContent : ''); // Add cell content or empty string
      }
      rows.push(row.join('\t')); // Join columns with tabs
    }
    navigator.clipboard.writeText(rows.join('\n')); // Join rows with newlines and write to clipboard
  }

  /**
   * Pastes tab-separated values from the clipboard into the selected cells.
   * If multiple cells are selected, it fills them sequentially.
   */
  function pasteSelected() {
    navigator.clipboard.readText().then(text => {
      // Split clipboard text into rows and then into values
      const rows = text.split('\n').map(r => r.replace(/\r/g, '').split('\t'));
      // Sort selected cells to ensure consistent paste order
      const cells = Array.from(selectedCells).sort((a, b) => (+a.dataset.r - +b.dataset.r) || (+a.dataset.c - +b.dataset.c));
      let idx = 0;
      for (const row of rows) {
        for (const val of row) {
          if (idx < cells.length) {
            const td = cells[idx];
            const num = Number(val.trim().replace(/,/g, '.')); // Parse number, allowing comma as decimal
            if (Number.isFinite(num)) {
              const clamped = Math.max(-9999, Math.min(9999, Math.round(num))); // Clamp and round
              const r = +td.dataset.r;
              const c = +td.dataset.c;
              data[r][c] = clamped; // Update data model
              td.textContent = String(clamped); // Update cell display
            }
            idx++;
          }
        }
      }
      colorizeTable(); // Recolor table
      drawIso(); // Redraw 3D view
    });
  }
})();