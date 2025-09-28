(function() {
  // Centralized version constant (use this to bump the app version everywhere)
  const VERSION = 'v1.05';
  // expose globally so other small scripts (ui-overrides.js, script2.js) can read it
  window.VERSION = VERSION;

  let sizeX = 16;
  let sizeY = 8;
  let elevationScale = 1.0;
  // How many decimals to display in the table (controlled by + / - buttons)
  let decimalPlaces = 2;
  // Decimal separator for display (per-table: 'decimalSep1' for Map1)
  let decimalSep = localStorage.getItem('decimalSep1') || '.';
  // Initialize Map1 with a pattern: each row = [1, 2, 3, ... sizeX]
  let data = Array.from({ length: sizeY }, () =>
    Array.from({ length: sizeX }, (_, idx) => idx + 1)
  );

  // Color palette management (now 5-stop: min, betweenMin, mid, betweenMax, max)
  const palette = {
    min: { r: 135, g: 206, b: 235 },    // Sky blue (min) - #87CEEB
    betweenMin: { r: 50, g: 205, b: 50 }, // Green (between min & mid) - #32CD32
    mid: { r: 255, g: 255, b: 0 },      // Yellow (mid) - #FFFF00
    betweenMax: { r: 255, g: 0, b: 0 }, // Red (between mid & max) - #FF0000
    max: { r: 153, g: 50, b: 204 },     // Mauve / purple (max) - #9932CC
    line: { r: 128, g: 128, b: 128 },   // Gray
    // legacy key kept
    point: { r: 0, g: 0, b: 0 },
    // Defaults requested: 3D background = white, table font = light gray
    bg: { r: 255, g: 255, b: 255 },     // White background by default
    fontColor: { r: 191, g: 191, b: 191 }, // Light gray default font
    alpha: 1.0
  };

  // Simple internationalization strings (FR/EN)
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
   * Uses a five-stop gradient: min -> betweenMin -> mid -> betweenMax -> max.
   * Breakpoints at 0, 0.25, 0.5, 0.75, 1.0
   * @param {number} value - The data value.
   * @param {number} minV - The minimum possible data value.
   * @param {number} maxV - The maximum possible data value.
   * @returns {object} The calculated RGB color object.
   */
  function gradientColor(value, minV, maxV) {
    if (maxV === minV) return palette.min;
    const t = Math.max(0, Math.min(1, (value - minV) / (maxV - minV)));
    // Four segments: [0,0.25], (0.25,0.5], (0.5,0.75], (0.75,1]
    if (t <= 0.25) {
      const u = t / 0.25;
      return mix(palette.min, palette.betweenMin, u);
    } else if (t <= 0.5) {
      const u = (t - 0.25) / 0.25;
      return mix(palette.betweenMin, palette.mid, u);
    } else if (t <= 0.75) {
      const u = (t - 0.5) / 0.25;
      return mix(palette.mid, palette.betweenMax, u);
    } else {
      const u = (t - 0.75) / 0.25;
      return mix(palette.betweenMax, palette.max, u);
    }
  }

  // Format number for display according to current decimalPlaces and decimalSep
  function formatNumberDisplay(n) {
    if (!Number.isFinite(n)) return '';
    const s = Number(n).toFixed(decimalPlaces);
    return decimalSep === ',' ? s.replace('.', ',') : s;
  }
  
  /**
   * Convert a zero-based column index to an Excel-style column label:
   * 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ...
   * @param {number} index - zero-based column index
   * @returns {string} column label
   */
  function columnLabel(index) {
    let label = '';
    let i = index + 1; // work in 1-based
    while (i > 0) {
      const rem = (i - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      i = Math.floor((i - 1) / 26);
    }
    return label;
  }
  
  const table = document.getElementById('grid');
  /**
   * Renders the HTML table based on the current sizeX, sizeY, and data.
   */
function renderTable() {
  // Make header cells editable: top-left cell contains two editable annotation slots (diagonally split) + column headers (C#)
  // Prefill the two annotations so top shows "C#" (column-label area) and bottom shows "L#" (row-label area).
  // Add data-r/data-c attributes to header cells so they are selectable and included in copy/paste.
  const head = '<thead>' +
    '<tr>' +
      // Corner cell: two editable spans (top-right / bottom-left handled by CSS)
      '<th class="table-header corner" data-r="-1" data-c="-1">' +
        '<span class="corner-annot top" contenteditable="true" data-annot="top">C#</span>' +
        '<span class="corner-annot bottom" contenteditable="true" data-annot="bottom">L#</span>' +
      '</th>' +
      Array.from({length: sizeX}, (_, i) => `<th contenteditable="true" class="table-header" data-r="-1" data-c="${i}">${columnLabel(i)}</th>`).join('') +
    '</tr>' +
  '</thead>';
  // Row headers (L#) are editable as well; data cells remain td with data-r/data-c
  const body = '<tbody>' +
    data.map((row, r) => (
      '<tr>' + `<th contenteditable="true" class="table-header" data-r="${r}" data-c="-1">${r+1}</th>` + row.map((v, c) => `<td contenteditable="true" inputmode="numeric" data-r="${r}" data-c="${c}">${formatNumberDisplay(v)}</td>`).join('') + '</tr>'
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
   * Compute a zoom and origin so the whole grid fits into the canvas viewport.
   * Centers the grid and applies a small upward offset so the surface is fully visible.
   * @param {number} cols
   * @param {number} rows
   * @param {number} baseTile - base tile size (without zoom)
   * @param {number} rot - rotation in radians
   */
  function computeAndSetInitialView(cols, rows, baseTile, rot) {
    // Build unit-space projected points (tile = baseTile, no origin)
    const points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c - (cols - 1) / 2;
        const cy = r - (rows - 1) / 2;
        const xr = cx * Math.cos(rot) - cy * Math.sin(rot);
        const yr = cx * Math.sin(rot) + cy * Math.cos(rot);
        const x = (xr - yr) * (baseTile / 2);
        const y = (xr + yr) * (baseTile / 4);
        points.push([x, y]);
      }
    }
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
  
    const canvasW = canvas.width / (window.devicePixelRatio || 1);
    const canvasH = canvas.height / (window.devicePixelRatio || 1);
    const margin = 0.88; // keep some padding
    let desiredZoom = Math.min((canvasW * margin) / bboxW, (canvasH * margin) / bboxH);
    desiredZoom = Math.max(0.4, Math.min(3.5, desiredZoom));
    zoom = desiredZoom;
  
    // Center bbox in canvas; apply small upward offset so the whole surface is clearly visible
    const centerXUnit = (minX + maxX) / 2;
    const centerYUnit = (minY + maxY) / 2;
    originX = canvasW / 2 - centerXUnit * zoom;
    // Move upward a little to create space for axes/labels (fraction of baseTile)
    originY = canvasH / 2 - centerYUnit * zoom - baseTile * 0.25 * zoom;
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
  // Start rotated -90 degrees (counter-clockwise) per user request
  let rotation = -Math.PI / 2; // radians, rotation around the Z-axis (vertical)
  let originX = null; // X-coordinate of the isometric origin on the canvas (CSS px, after DPR scaling)
  let originY = null; // Y-coordinate of the isometric origin on the canvas (CSS px, after DPR scaling)

  /**
   * Main function to draw the isometric 3D visualization on the canvas.
   */
  function drawIso() {
    resizeCanvas();
    const dark = document.body.classList.contains('dark');

    // Clear canvas and draw background (use palette.bg controlled by the "Points" color picker)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = rgbaString(palette.bg.r, palette.bg.g, palette.bg.b, 1.0);
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
    // Further reduced to 0.06 to lower the overall 3D relief height
    const hScale = tile * 0.06 * elevationScale;

    // Initialize origin if not set (e.g., on first load or after major resize)
    if (originX === null || originY === null) {
      // Compute an initial view that fits the whole grid into the canvas
      computeAndSetInitialView(cols, rows, base, rotation);
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
    
    // Draw axis lines, ticks and labels on the ground plane (z = 0).
    // Axes are drawn parallel to the grid when viewed from above by using isoPoint at z=0
    // and building the axis vectors from the grid basis (step along r and c).
    try {
      // Read header texts
      const allTh = Array.from(table.querySelectorAll('thead tr th')).map(th => (th.textContent || '').trim()); // allTh[0] is corner, allTh[1] = C1...
      const rowHeaderEls = Array.from(table.querySelectorAll('tbody tr')).map(tr => tr.querySelector('th'));
      const rowHeaders = rowHeaderEls.map(th => (th ? (th.textContent || '').trim() : '')); // rowHeaders[0] = L1
      
      // Compute base origin and basis vectors on plane z=0
      const originPt = isoPoint(0, 0, 0);            // grid (0,0) at z=0
      const ptC1 = isoPoint(0, 1, 0);               // one step in +c direction
      const ptR1 = isoPoint(1, 0, 0);               // one step in +r direction
      const vC = [ptC1[0] - originPt[0], ptC1[1] - originPt[1]]; // column direction in canvas space
      const vR = [ptR1[0] - originPt[0], ptR1[1] - originPt[1]]; // row direction in canvas space

      // Offset axes slightly outward for legibility (walk opposite along the orthogonal axis)
      let offsetAmount = Math.max(12, tile * 0.5);
      // Bring the axes halfway closer to the cartography (halve the offset)
      offsetAmount = offsetAmount * 0.5;
      // outward offsets: move X-axis outward by -vR, and Y-axis outward by -vC
      const normR = Math.hypot(vR[0], vR[1]) || 1;
      const normC = Math.hypot(vC[0], vC[1]) || 1;
      const offR = [-vR[0] / normR * offsetAmount, -vR[1] / normR * offsetAmount];
      const offC = [-vC[0] / normC * offsetAmount, -vC[1] / normC * offsetAmount];

      // For ticks we want them exactly on the grid lines — compute perpendicular vectors to the axis directions
      const perpC = [-vC[1] / normC, vC[0] / normC]; // perpendicular to column direction
      const perpR = [-vR[1] / normR, vR[0] / normR]; // perpendicular to row direction

      // Invert background color for axis/labels contrast
      const inv = { r: 255 - palette.bg.r, g: 255 - palette.bg.g, b: 255 - palette.bg.b };
      const axisColor = `rgb(${inv.r}, ${inv.g}, ${inv.b})`;

      ctx.save();
      ctx.strokeStyle = axisColor;
      ctx.fillStyle = axisColor;
      ctx.lineWidth = 1.2;
      ctx.font = `${Math.max(10, Math.round(tile * 0.12))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
  
      // Axis start positions (moved outward previously via offR/offC).
      const axisStartCol = [originPt[0] + offR[0], originPt[1] + offR[1]];
      const axisDirCol = [vC[0], vC[1]];
      const axisStartRow = [originPt[0] + offC[0], originPt[1] + offC[1]];
      const axisDirRow = [vR[0], vR[1]];
      // Helper: get a point on the ground plane (z=0) — kept as a tiny wrapper for clarity
      function planePoint(r, c) { return isoPoint(r, c, 0); }
  
      // Draw axis lines
      ctx.beginPath();
      ctx.moveTo(axisStartCol[0], axisStartCol[1]);
      ctx.lineTo(axisStartCol[0] + axisDirCol[0] * (cols - 1), axisStartCol[1] + axisDirCol[1] * (cols - 1));
      ctx.stroke();
  
      ctx.beginPath();
      ctx.moveTo(axisStartRow[0], axisStartRow[1]);
      ctx.lineTo(axisStartRow[0] + axisDirRow[0] * (rows - 1), axisStartRow[1] + axisDirRow[1] * (rows - 1));
      ctx.stroke();
  
      // Helper: project a ground point onto an axis (returns the projection point on the axis line).
      function projectOntoAxis(pt, axisStart, axisDir) {
        const dx = pt[0] - axisStart[0];
        const dy = pt[1] - axisStart[1];
        const denom = axisDir[0] * axisDir[0] + axisDir[1] * axisDir[1] || 1;
        const t = (dx * axisDir[0] + dy * axisDir[1]) / denom;
        return [axisStart[0] + axisDir[0] * t, axisStart[1] + axisDir[1] * t];
      }
  
      const tickLen = Math.max(6, tile * 0.08);
  
      
  
// --- Column ticks & labels (top horizontal black axis) ---
// Column ticks on column grid LINES: use midpoints (c + 0.5), project to unoffset column-axis then add offR
for (let c = 0; c < Math.max(0, cols - 1); c++) {
  const groundMid = planePoint(0, c + 0.5);
  const baseProj = projectOntoAxis(groundMid, originPt, vC);
  const p = [baseProj[0] + offR[0], baseProj[1] + offR[1]];
  ctx.beginPath();
  ctx.moveTo(p[0] - perpC[0] * (tickLen / 2), p[1] - perpC[1] * (tickLen / 2));
  ctx.lineTo(p[0] + perpC[0] * (tickLen / 2), p[1] + perpC[1] * (tickLen / 2));
  ctx.stroke();
}

// Column labels (C#) placed on the axis at integer column centers — project + offR outward
for (let c = 0; c < cols; c++) {
  const groundCenter = planePoint(0, c);
  const baseProj = projectOntoAxis(groundCenter, originPt, vC);
  // push labels further outward so they sit off the black axis line (multiplier 1.6)
  const OUTER_LABEL_MULT = 1.6;
  const p = [baseProj[0] + offR[0] * OUTER_LABEL_MULT, baseProj[1] + offR[1] * OUTER_LABEL_MULT];
  const label = (allTh[c + 1] !== undefined && allTh[c + 1] !== '') ? allTh[c + 1] : `C${c + 1}`;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, p[0], p[1]);
  ctx.restore();
}
      // Ticks on row grid LINES: use midpoints (r + 0.5), project to unoffset row-axis then add offC
      for (let r = 0; r < Math.max(0, rows - 1); r++) {
        const groundMid = planePoint(r + 0.5, 0);
        const baseProj = projectOntoAxis(groundMid, originPt, vR);
        const p = [baseProj[0] + offC[0], baseProj[1] + offC[1]];
        ctx.beginPath();
        ctx.moveTo(p[0] - perpR[0] * (tickLen / 2), p[1] - perpR[1] * (tickLen / 2));
        ctx.lineTo(p[0] + perpR[0] * (tickLen / 2), p[1] + perpR[1] * (tickLen / 2));
        ctx.stroke();
      }
  
      // Row labels (L#) placed on the axis at integer row centers (rotated) — use projection + offC
      for (let r = 0; r < rows; r++) {
        const groundCenter = planePoint(r, 0);
        const baseProj = projectOntoAxis(groundCenter, originPt, vR);
        // push labels further outward so they sit off the black axis line (multiplier 1.6)
        const OUTER_LABEL_MULT = 1.6;
        const p = [baseProj[0] + offC[0] * OUTER_LABEL_MULT, baseProj[1] + offC[1] * OUTER_LABEL_MULT];
        const label = (rowHeaders[r] !== undefined && rowHeaders[r] !== '') ? rowHeaders[r] : String(r + 1);
        ctx.save();
        // Draw label upright (facing the viewer) at projected position, centered
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, p[0], p[1]);
        ctx.restore();
      }
  
      ctx.restore();
    } catch (e) {
      console.warn('drawIso: axis drawing skipped due to error', e);
    }
  }

  // Color controls initialization and event handlers
  /**
   * Initializes the color pickers and their associated buttons,
   * and sets up event listeners for color changes and alpha slider.
   */
  function initColorControls() {
    // Set default colors for the color input elements (5-stop palette)
    document.getElementById('cMin').value = '#90EE90';          // green
    document.getElementById('cBetweenMin').value = '#FFFFFF';  // white
    document.getElementById('cMid').value = '#FFFF00';          // yellow
    document.getElementById('cBetweenMax').value = '#0000FF';  // blue
    document.getElementById('cMax').value = '#FF0000';          // red
    document.getElementById('cLine').value = '#808080';
    // cPoint now controls the 3D background — default to white per request
    document.getElementById('cPoint').value = '#ffffff';
    // Table font color default: light gray
    const defaultFontHex = '#bfbfbf';
    document.getElementById('cFont').value = defaultFontHex;
    // set palette.fontColor accordingly
    const fontRgb = hexToRgb(document.getElementById('cFont').value);
    if (fontRgb) palette.fontColor = fontRgb;
    // set palette.bg from cPoint
    const bgRgb = hexToRgb(document.getElementById('cPoint').value);
    if (bgRgb) palette.bg = bgRgb;
    // Ensure canvas shows the selected background immediately as a fallback
    try { if (canvas) canvas.style.backgroundColor = rgbaString(palette.bg.r, palette.bg.g, palette.bg.b, 1.0); } catch(e){}
    
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
    
    document.getElementById('cBetweenMin').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.betweenMin = rgb;
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
    
    document.getElementById('cBetweenMax').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.betweenMax = rgb;
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
    
    // cPoint now sets the 3D background color
    document.getElementById('cPoint').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.bg = rgb;
        updateColorButtons();
        drawIso();
      }
    });
 
    // Table font color control
    document.getElementById('cFont').addEventListener('change', (e) => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) {
        palette.fontColor = rgb;
        updateColorButtons();
        // Apply immediately to tables
        table.style.color = rgbaString(rgb.r, rgb.g, rgb.b, 1.0);
        colorizeTable();
      }
    });
    
    // Alpha slider event handler
    document.getElementById('alpha').addEventListener('input', (e) => {
      palette.alpha = parseFloat(e.target.value);
      colorizeTable();
      drawIso(); // Apply alpha to 3D view surfaces only
    });
    
    // Button click handlers to trigger hidden color input clicks
    document.getElementById('cMinBtn').addEventListener('click', () => {
      document.getElementById('cMin').click();
    });
    
    document.getElementById('cBetweenMinBtn').addEventListener('click', () => {
      document.getElementById('cBetweenMin').click();
    });
    
    document.getElementById('cMidBtn').addEventListener('click', () => {
      document.getElementById('cMid').click();
    });
    
    document.getElementById('cBetweenMaxBtn').addEventListener('click', () => {
      document.getElementById('cBetweenMax').click();
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
 
    // Font color button
    document.getElementById('cFontBtn').addEventListener('click', () => {
      document.getElementById('cFont').click();
    });
  }
  
  /**
   * Updates the background color of the color palette buttons
   * to reflect the currently selected colors.
   */
  function updateColorButtons() {
    const minBtn = document.getElementById('cMinBtn');
    const betweenMinBtn = document.getElementById('cBetweenMinBtn');
    const midBtn = document.getElementById('cMidBtn');
    const betweenMaxBtn = document.getElementById('cBetweenMaxBtn');
    const maxBtn = document.getElementById('cMaxBtn');
    const lineBtn = document.getElementById('cLineBtn');
    const pointBtn = document.getElementById('cPointBtn');
    const fontBtn = document.getElementById('cFontBtn');
 
    if (minBtn) minBtn.style.backgroundColor = `rgb(${palette.min.r}, ${palette.min.g}, ${palette.min.b})`;
    if (betweenMinBtn) betweenMinBtn.style.backgroundColor = `rgb(${palette.betweenMin.r}, ${palette.betweenMin.g}, ${palette.betweenMin.b})`;
    if (midBtn) midBtn.style.backgroundColor = `rgb(${palette.mid.r}, ${palette.mid.g}, ${palette.mid.b})`;
    if (betweenMaxBtn) betweenMaxBtn.style.backgroundColor = `rgb(${palette.betweenMax.r}, ${palette.betweenMax.g}, ${palette.betweenMax.b})`;
    if (maxBtn) maxBtn.style.backgroundColor = `rgb(${palette.max.r}, ${palette.max.g}, ${palette.max.b})`;
    if (lineBtn) lineBtn.style.backgroundColor = `rgb(${palette.line.r}, ${palette.line.g}, ${palette.line.b})`;
    // cPoint shows the background color now
    if (pointBtn) pointBtn.style.backgroundColor = `rgb(${palette.bg.r}, ${palette.bg.g}, ${palette.bg.b})`;
    if (fontBtn) fontBtn.style.backgroundColor = `rgb(${palette.fontColor.r}, ${palette.fontColor.g}, ${palette.fontColor.b})`;
  }
  
  /**
   * Applies gradient colors to the table cells based on their numerical values
   * and the current color palette and alpha setting.
   */
  function colorizeTable() {
    // Apply font color to entire table (so headers & cells match)
    table.style.color = rgbaString(palette.fontColor.r, palette.fontColor.g, palette.fontColor.b, 1.0);

    const cells = table.querySelectorAll('td[contenteditable]');

    // Parse numbers from cell text, supporting ',' as decimal separator
    const parsed = Array.from(cells).map(cell => {
      const txt = (cell.textContent || '').trim();
      const num = parseFloat(txt.replace(',', '.'));
      return Number.isFinite(num) ? num : null;
    });

    // Determine min/max among valid parsed numbers; fallback to 0/1 if none valid
    const validValues = parsed.filter(v => v !== null);
    const minV = validValues.length ? Math.min(...validValues) : 0;
    const maxV = validValues.length ? Math.max(...validValues) : 1;

    cells.forEach((cell, i) => {
      const value = parsed[i];
      // If value is not a number, clear background
      if (value === null) {
        cell.style.backgroundColor = '';
        return;
      }
      const color = gradientColor(value, minV, maxV);
      cell.style.backgroundColor = rgbaString(color.r, color.g, color.b, palette.alpha);
    });
  }

  // Initial setup and rendering
  renderTable();
  initColorControls();
  colorizeTable();
  drawIso();

  // Ensure decSepToggle label reflects stored separator for this table (per-table key)
  const decSepToggleInit = document.getElementById('decSepToggle');
  if (decSepToggleInit) decSepToggleInit.textContent = `🔁 ${localStorage.getItem('decimalSep1') || decimalSep}`;

  // Decimal control buttons for Map1 (+ / -) and separator toggle
  const decPlusBtn = document.getElementById('decPlus');
  const decMinusBtn = document.getElementById('decMinus');
  const decSepToggle = document.getElementById('decSepToggle');
  if (decPlusBtn) decPlusBtn.addEventListener('click', () => {
    decimalPlaces = Math.min(6, decimalPlaces + 1);
    renderTable();
    colorizeTable();
    drawIso();
  });
  if (decMinusBtn) decMinusBtn.addEventListener('click', () => {
    decimalPlaces = Math.max(0, decimalPlaces - 1);
    renderTable();
    colorizeTable();
    drawIso();
  });
  if (decSepToggle) {
    // initialize label
    decSepToggle.textContent = `🔁 ${decimalSep}`;
    decSepToggle.addEventListener('click', () => {
      decimalSep = decimalSep === '.' ? ',' : '.';
      localStorage.setItem('decimalSep', decimalSep);
      decSepToggle.textContent = `🔁 ${decimalSep}`;
      // re-render local table and notify other instances
      renderTable();
      colorizeTable();
      drawIso();
      window.dispatchEvent(new Event('decimalSepChanged'));
    });
  }

  // Horizontal resizers: allow dragging between the top controls/title and the canvas (per viz-wrap)
  (function initHorizontalResizers() {
    let isHResizing = false;
    let activeWrap = null;
    const resizers = Array.from(document.querySelectorAll('.h-resizer'));
    let startY = 0;
    let startTopHeight = 0;

    function onMouseMove(e) {
      if (!isHResizing || !activeWrap) return;
      const rect = activeWrap.getBoundingClientRect();
      const dy = e.clientY - startY;
      const newTop = Math.max(20, Math.min(rect.height - 60, startTopHeight + dy)); // clamp to sensible limits
      // Set three rows: top controls (newTop), resizer (8px), canvas (remaining)
      activeWrap.style.gridTemplateRows = `${newTop}px 8px 1fr`;
      // trigger redraw so canvas resizes
      window.dispatchEvent(new Event('redraw'));
    }

    function onMouseUp() {
      isHResizing = false;
      activeWrap = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    resizers.forEach(r => {
      r.addEventListener('mousedown', (ev) => {
        const wrap = r.closest('.viz-wrap');
        if (!wrap) return;
        isHResizing = true;
        activeWrap = wrap;
        const rect = wrap.getBoundingClientRect();
        // compute current top row height from the actual top child element (more reliable)
        const topEl = wrap.children && wrap.children[0] ? wrap.children[0] : null;
        const topRect = topEl ? topEl.getBoundingClientRect() : null;
        startTopHeight = topRect ? topRect.height : rect.height * 0.15;
        startY = ev.clientY;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });
  })();

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
    const cell = e.target.closest('[data-r][data-c][contenteditable]');
    if (!cell) return;
    cell.dataset.oldValue = cell.textContent; // Store old value for potential escape
    clearSelection();
    selectCell(cell);
  });
  table.addEventListener('keydown', (e) => {
    const cell = e.target.closest('[data-r][data-c][contenteditable]');
    if (!cell) return;
    if (e.key === 'Enter') { e.preventDefault(); cell.blur(); } // Commit on Enter
    if (e.key === 'Escape') { e.preventDefault(); cell.textContent = cell.dataset.oldValue || ''; cell.blur(); } // Cancel on Escape
  });
  table.addEventListener('blur', (e) => {
    const cell = e.target.closest('[data-r][data-c][contenteditable]');
    if (!cell) return;
    const rAttr = cell.getAttribute('data-r');
    const cAttr = cell.getAttribute('data-c');
    const r = parseInt(rAttr, 10);
    const c = parseInt(cAttr, 10);
    const val = cell.textContent.trim();
    const num = parseFloat(val.replace(/,/g, '.')); // Allow comma as decimal separator

    // If this is a data cell (both r and c >= 0), validate and store in data grid.
    if (!Number.isNaN(r) && !Number.isNaN(c) && r >= 0 && c >= 0) {
      if (!Number.isFinite(num)) { cell.textContent = cell.dataset.oldValue || formatNumberDisplay(0); return; } // Revert if not a valid number
      const clamped = Math.max(-9999, Math.min(9999, num));
      data[r][c] = Number(clamped.toFixed(6));
      cell.textContent = formatNumberDisplay(data[r][c]);
      colorizeTable(); // Recolor table
      drawIso(); // Redraw 3D view
    } else {
      // Header cell (row/col/corner) — accept raw text, no numeric validation or data[] write.
      // Leave the content as the user entered it.
    }
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
  // Ensure the numeric inputs reflect the JS state at startup
  if (sizeInputX) sizeInputX.value = sizeX;
  if (sizeInputY) sizeInputY.value = sizeY;
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
  
  // Swap axes button: transpose the data grid, swap sizeX/sizeY, preserve header texts and refresh views.
  const swapBtn = document.getElementById('swapAxes');
  function swapAxes() {
    if (!table) return;
    // Capture existing headers
    const theadThs = Array.from(table.querySelectorAll('thead tr th'));
    const oldColHeaders = theadThs.slice(1).map(th => (th.textContent || '').trim());
    const oldRowHeaders = Array.from(table.querySelectorAll('tbody tr th')).map(th => (th.textContent || '').trim());
    // Capture corner annotations (top/bottom) so they can be swapped as well
    const cornerTh = table.querySelector('thead tr th.corner');
    const oldCornerTop = cornerTh ? (cornerTh.querySelector('.corner-annot.top')?.textContent || '').trim() : '';
    const oldCornerBottom = cornerTh ? (cornerTh.querySelector('.corner-annot.bottom')?.textContent || '').trim() : '';
  
    const oldCols = sizeX, oldRows = sizeY;
    // Build transposed data: new rows = oldCols, new cols = oldRows
    const newData = Array.from({ length: oldCols }, (_, c) =>
      Array.from({ length: oldRows }, (_, r) => (data[r] && data[r][c] !== undefined) ? data[r][c] : 0)
    );
  
    data = newData;
    // Swap sizes
    sizeX = oldRows;
    sizeY = oldCols;
    // Update inputs to reflect swapped sizes
    if (sizeInputX) sizeInputX.value = sizeX;
    if (sizeInputY) sizeInputY.value = sizeY;
    // Re-render table and apply headers swapped (old row headers -> column headers, old column headers -> row headers)
    renderTable();
    const newTheadThs = Array.from(table.querySelectorAll('thead tr th'));
    for (let i = 1; i < newTheadThs.length; i++) {
      const txt = oldRowHeaders[i - 1] !== undefined && oldRowHeaders[i - 1] !== '' ? oldRowHeaders[i - 1] : columnLabel(i - 1);
      newTheadThs[i].textContent = txt;
    }
    const newRowThs = Array.from(table.querySelectorAll('tbody tr th'));
    for (let r = 0; r < newRowThs.length; r++) {
      const txt = oldColHeaders[r] !== undefined && oldColHeaders[r] !== '' ? oldColHeaders[r] : String(r + 1);
      newRowThs[r].textContent = txt;
    }
    // Swap corner annotations: top <-> bottom (so "C#" / "L#" follow axes swap)
    const newCornerTh = table.querySelector('thead tr th.corner');
    if (newCornerTh) {
      const topEl = newCornerTh.querySelector('.corner-annot.top');
      const bottomEl = newCornerTh.querySelector('.corner-annot.bottom');
      if (topEl) topEl.textContent = oldCornerBottom || topEl.textContent;
      if (bottomEl) bottomEl.textContent = oldCornerTop || bottomEl.textContent;
    }
  
    // Update titles/subtitle
    if (subtitle) subtitle.textContent = `Cartographie ${sizeX}×${sizeY} avec aperçu 3D isométrique. (v0.03)`;
    if (tabTitle) tabTitle.textContent = `Tableau ${sizeX}×${sizeY}`;
  
    colorizeTable();
    // Force recompute of camera/origin so the view recenters and fits
    originX = null; originY = null;
    drawIso();
  }
  if (swapBtn) swapBtn.addEventListener('click', swapAxes);

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
        const el = table.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el) {
          selectCell(el);
        }
      }
    }
  }

  table.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('[data-r][data-c]');
    if (!cell) return;
    clearSelection();
    startCell = cell;
    selectCell(cell);
    isSelecting = true;
  });

  table.addEventListener('mousemove', (e) => {
    if (!isSelecting || !startCell) return;
    const cell = e.target.closest('[data-r][data-c]');
    if (cell) {
      selectRange(startCell, cell);
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
          // If no cells are selected, select all data cells for copy
          for (let r = 0; r < sizeY; r++) {
            for (let c = 0; c < sizeX; c++) {
              const el = table.querySelector(`[data-r="${r}"][data-c="${c}"]`);
              if (el) selectCell(el);
            }
          }
        }
        copySelected();
      } else if (e.key === 'v') { // Paste
        e.preventDefault();
        if (selectedCells.size == 0) {
          // If no cells are selected, select all data cells for paste
          for (let r = 0; r < sizeY; r++) {
            for (let c = 0; c < sizeX; c++) {
              const el = table.querySelector(`[data-r="${r}"][data-c="${c}"]`);
              if (el) selectCell(el);
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
        const el = table.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        row.push(el ? el.textContent : ''); // Add cell content or empty string
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
      // Parse clipboard into a 2D array of values (rows x cols)
      const rows = text.split('\n').map(r => r.replace(/\r/g, '').split('\t').map(v => v));
      // Sort currently selected cells
      const selCells = Array.from(selectedCells).sort((a, b) => (+a.dataset.r - +b.dataset.r) || (+a.dataset.c - +b.dataset.c));
  
      // Helper to write a raw value into a target element.
      // For data cells (td) we parse numeric values and write into data[]; for headers (th) we write raw text.
      function writeToTarget(target, rawVal) {
        if (!target) return;
        const tag = (target.tagName || '').toLowerCase();
        if (tag === 'td') {
          const num = parseFloat((rawVal || '').toString().trim().replace(/,/g, '.'));
          if (Number.isFinite(num)) {
            const clamped = Math.max(-9999, Math.min(9999, num));
            const r = +target.dataset.r;
            const c = +target.dataset.c;
            data[r][c] = Number(clamped.toFixed(6));
            target.textContent = formatNumberDisplay(data[r][c]);
          } else {
            // If clipboard cell is non-numeric, leave the td text unchanged (or optionally clear).
            target.textContent = target.textContent;
          }
        } else {
          // Header cell (th) — paste raw text
          target.textContent = rawVal;
        }
      }
  
      if (selCells.length === 0) {
        // No selection: paste matrix into table starting at 0,0
        const startR = 0, startC = 0;
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            const target = table.querySelector(`[data-r="${startR + r}"][data-c="${startC + c}"]`);
            writeToTarget(target, rows[r][c]);
          }
        }
      } else if (selCells.length === 1) {
        // Single anchor cell: use it as the origin and map the clipboard matrix onto the grid
        const anchor = selCells[0];
        const startR = parseInt(anchor.getAttribute('data-r'), 10);
        const startC = parseInt(anchor.getAttribute('data-c'), 10);
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            const target = table.querySelector(`[data-r="${startR + r}"][data-c="${startC + c}"]`);
            writeToTarget(target, rows[r][c]);
          }
        }
      } else {
        // Multiple selected cells: try to paste into the bounding box if clipboard size matches, otherwise fill selected cells sequentially.
        const minR = Math.min(...selCells.map(el => +el.dataset.r));
        const maxR = Math.max(...selCells.map(el => +el.dataset.r));
        const minC = Math.min(...selCells.map(el => +el.dataset.c));
        const maxC = Math.max(...selCells.map(el => +el.dataset.c));
        const boxRows = maxR - minR + 1;
        const boxCols = maxC - minC + 1;
  
        if (rows.length === boxRows && rows[0].length === boxCols) {
          // Dimensions match the selected bounding box -> paste by position
          for (let r = 0; r < boxRows; r++) {
            for (let c = 0; c < boxCols; c++) {
              const target = table.querySelector(`[data-r="${minR + r}"][data-c="${minC + c}"]`);
              writeToTarget(target, rows[r][c]);
            }
          }
        } else {
          // Otherwise paste sequentially into the sorted selected cells
          let idx = 0;
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
              if (idx < selCells.length) {
                writeToTarget(selCells[idx], rows[r][c]);
                idx++;
              }
            }
          }
        }
      }
  
      colorizeTable(); // Recolor table
      drawIso(); // Redraw 3D view
    });
  }
})();