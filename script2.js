(function() {
  // Second independent Carto instance (targets elements with '2' suffix)
  let sizeX2 = 16;
  let sizeY2 = 8;
  let elevationScale2 = 1.0;
  // How many decimals to display in table2
  let decimalPlaces2 = 2;
  let data2 = Array.from({ length: sizeY2 }, () =>
    Array.from({ length: sizeX2 }, () => 0)
  );

  const palette2 = {
    min: { r: 144, g: 238, b: 144 },     // Light green (min)
    betweenMin: { r: 255, g: 255, b: 255 }, // White (between min & mid)
    mid: { r: 255, g: 255, b: 0 },       // Yellow (mid)
    betweenMax: { r: 0, g: 0, b: 255 },  // Blue (between mid & max)
    max: { r: 255, g: 0, b: 0 },         // Red (max)
    line: { r: 128, g: 128, b: 128 },    // Gray
    point: { r: 0, g: 0, b: 0 }, // legacy key (kept)
    // Default requested: white 3D background and light gray table font
    bg: { r: 255, g: 255, b: 255 }, // white background for 3D canvas by default
    fontColor: { r: 191, g: 191, b: 191 }, // light gray default font
    alpha: 1.0
  };

  function id2(base){ return base + '2'; }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  function rgbaString(r,g,b,a){ return `rgba(${r}, ${g}, ${b}, ${a})`; }
  function mix(a,b,t){ return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) }; }
  function gradientColor2(value, minV, maxV){
    if (maxV === minV) return palette2.min;
    const t = Math.max(0, Math.min(1, (value - minV) / (maxV - minV)));
    // Four segments: [0,0.25], (0.25,0.5], (0.5,0.75], (0.75,1]
    if (t <= 0.25) {
      const u = t / 0.25;
      return mix(palette2.min, palette2.betweenMin, u);
    } else if (t <= 0.5) {
      const u = (t - 0.25) / 0.25;
      return mix(palette2.betweenMin, palette2.mid, u);
    } else if (t <= 0.75) {
      const u = (t - 0.5) / 0.25;
      return mix(palette2.mid, palette2.betweenMax, u);
    } else {
      const u = (t - 0.75) / 0.25;
      return mix(palette2.betweenMax, palette2.max, u);
    }
  }

  // Format number for display according to decimalPlaces2 and per-table decimal separator (decimalSep2)
  function formatNumberDisplay2(n) {
    if (!Number.isFinite(n)) return '';
    const sep = localStorage.getItem('decimalSep2') || '.';
    const s = Number(n).toFixed(decimalPlaces2);
    return sep === ',' ? s.replace('.', ',') : s;
  }
  
  /**
   * Convert a zero-based column index to an Excel-style column label:
   * 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ...
   * @param {number} index - zero-based column index
   * @returns {string} column label
   */
  function columnLabel2(index) {
    let label = '';
    let i = index + 1; // work in 1-based
    while (i > 0) {
      const rem = (i - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      i = Math.floor((i - 1) / 26);
    }
    return label;
  }

  const table2 = document.getElementById(id2('grid'));
  const canvas2 = document.getElementById(id2('iso'));
  const ctx2 = canvas2 ? canvas2.getContext('2d') : null;

  function renderTable2(){
    if(!table2) return;
    // Make header cells editable: top-left corner contains two editable annotation slots (diagonally split)
    // Add data-r/data-c attributes so headers are selectable and participate in copy/paste.
    const head = '<thead>' +
      '<tr>' +
        // Corner cell: two editable spans (top-right / bottom-left handled by CSS)
        '<th class="table-header corner" data-r="-1" data-c="-1">' +
          '<span class="corner-annot top" contenteditable="true" data-annot="top">C#</span>' +
          '<span class="corner-annot bottom" contenteditable="true" data-annot="bottom">L#</span>' +
        '</th>' +
        Array.from({length: sizeX2}, (_, i) => `<th contenteditable="true" class="table-header" data-r="-1" data-c="${i}">${columnLabel2(i)}</th>`).join('') +
      '</tr>' +
    '</thead>';
    const body = '<tbody>' +
      data2.map((row, r) => (
        '<tr>' + `<th contenteditable="true" class="table-header" data-r="${r}" data-c="-1">${r+1}</th>` + row.map((v, c) => `<td contenteditable="true" inputmode="numeric" data-r="${r}" data-c="${c}">${formatNumberDisplay2(v)}</td>`).join('') + '</tr>'
      )).join('') +
    '</tbody>';
    table2.innerHTML = head + body;
  }

  function resizeCanvas2(){
      if(!canvas2 || !ctx2) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas2.parentElement.getBoundingClientRect();
      canvas2.width = Math.max(1, rect.width * dpr);
      canvas2.height = Math.max(1, rect.height * dpr);
      ctx2.setTransform(dpr,0,0,dpr,0,0);
    }
    
    /**
     * Compute a zoom and origin so the whole grid fits into the canvas viewport for instance 2.
     * Centers the grid and applies a small upward offset so the surface is fully visible.
     * @param {number} cols
     * @param {number} rows
     * @param {number} baseTile - base tile size (without zoom)
     * @param {number} rot - rotation in radians
     */
    function computeAndSetInitialView2(cols, rows, baseTile, rot) {
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
    
      const canvasW = canvas2.width / (window.devicePixelRatio || 1);
      const canvasH = canvas2.height / (window.devicePixelRatio || 1);
      const margin = 0.88; // keep some padding
      let desiredZoom = Math.min((canvasW * margin) / bboxW, (canvasH * margin) / bboxH);
      desiredZoom = Math.max(0.4, Math.min(3.5, desiredZoom));
      zoom2 = desiredZoom;
    
      const centerXUnit = (minX + maxX) / 2;
      const centerYUnit = (minY + maxY) / 2;
      originX2 = canvasW / 2 - centerXUnit * zoom2;
      originY2 = canvasH / 2 - centerYUnit * zoom2 - baseTile * 0.25 * zoom2;
    }

  let zoom2 = 1.0;
  // Start rotated -90 degrees (counter-clockwise) to match Map1 initial orientation
  let rotation2 = -Math.PI / 2;
  let originX2 = null;
  let originY2 = null;

  function drawIso2(){
    if(!canvas2 || !ctx2) return;
    resizeCanvas2();
    const dark = document.body.classList.contains('dark');
    ctx2.clearRect(0,0,canvas2.width,canvas2.height);
    ctx2.save();
    // Use palette2.bg controlled by the "Points" color picker for instance 2
    ctx2.fillStyle = rgbaString(palette2.bg.r, palette2.bg.g, palette2.bg.b, 1.0);
    ctx2.fillRect(0,0,canvas2.width,canvas2.height);
    ctx2.restore();

    const cols = sizeX2, rows = sizeY2;
    const maxV = Math.max(1, ...data2.flat());
    const base = Math.min(canvas2.width, canvas2.height)/8;
    const tile = base * zoom2;
    // Reduced further to lower the overall 3D relief height
    const hScale = tile * 0.03 * elevationScale2;

    if(originX2 === null || originY2 === null){
      // Compute an initial view that fits the whole grid into the canvas for Map2
      computeAndSetInitialView2(cols, rows, base, rotation2);
    }

    function isoPoint2(r,c,z){
      const cx = c - (cols - 1)/2;
      const cy = r - (rows - 1)/2;
      const xr = cx * Math.cos(rotation2) - cy * Math.sin(rotation2);
      const yr = cx * Math.sin(rotation2) + cy * Math.cos(rotation2);
      const x = (xr - yr) * (tile / 2);
      const y = (xr + yr) * (tile / 4) - z * hScale;
      return [originX2 + x, originY2 + y];
    }

    const points = Array.from({ length: rows }, () => Array(cols));
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const v = data2[r][c];
        points[r][c] = { p: isoPoint2(r,c,v), v };
      }
    }

    const tris = [];
    for(let r=0;r<rows-1;r++){
      for(let c=0;c<cols-1;c++){
        const a = points[r][c], b = points[r][c+1], d = points[r+1][c], e = points[r+1][c+1];
        const tri1 = { pts: [a.p,b.p,e.p], v:(a.v+b.v+e.v)/3, y:(a.p[1]+b.p[1]+e.p[1])/3 };
        const tri2 = { pts: [a.p,e.p,d.p], v:(a.v+e.v+d.v)/3, y:(a.p[1]+e.p[1]+d.p[1])/3 };
        tris.push(tri1, tri2);
      }
    }
    tris.sort((t1,t2)=>t1.y-t2.y);

    for(const t of tris){
      ctx2.beginPath();
      ctx2.moveTo(t.pts[0][0], t.pts[0][1]);
      ctx2.lineTo(t.pts[1][0], t.pts[1][1]);
      ctx2.lineTo(t.pts[2][0], t.pts[2][1]);
      ctx2.closePath();
      const color = gradientColor2(t.v, Math.min(...data2.flat()), maxV);
      ctx2.fillStyle = rgbaString(color.r, color.g, color.b, palette2.alpha);
      ctx2.globalAlpha = 0.9;
      ctx2.fill();
      ctx2.globalAlpha = 1.0;
    }

    ctx2.lineWidth = 1.2;
    ctx2.strokeStyle = rgbaString(palette2.line.r, palette2.line.g, palette2.line.b, 1.0);
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const { p: [x,y] } = points[r][c];
        if(c+1<cols){
          const { p: [x2,y2] } = points[r][c+1];
          ctx2.beginPath(); ctx2.moveTo(x,y); ctx2.lineTo(x2,y2); ctx2.stroke();
        }
        if(r+1<rows){
          const { p: [x3,y3] } = points[r+1][c];
          ctx2.beginPath(); ctx2.moveTo(x,y); ctx2.lineTo(x3,y3); ctx2.stroke();
        }
      }
    }

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const { p: [x,y], v } = points[r][c];
        const col = gradientColor2(v, Math.min(...data2.flat()), maxV);
        ctx2.fillStyle = rgbaString(col.r, col.g, col.b, 1.0);
        ctx2.beginPath(); ctx2.arc(x,y, Math.max(1.5, tile*0.04), 0, Math.PI*2); ctx2.fill();
      }
    }
// Draw axis lines, ticks and labels on the ground plane (z = 0) for Map2
try {
  // Read header texts for table2
  const allTh2 = table2 ? Array.from(table2.querySelectorAll('thead tr th')).map(th => (th.textContent || '').trim()) : [];
  const rowHeaderEls2 = table2 ? Array.from(table2.querySelectorAll('tbody tr')).map(tr => tr.querySelector('th')) : [];
  const rowHeaders2 = rowHeaderEls2.map(th => (th ? (th.textContent || '').trim() : ''));

  // Compute base origin and basis vectors on plane z=0 (using isoPoint2)
  const originPt2 = isoPoint2(0, 0, 0);
  const ptC12 = isoPoint2(0, 1, 0);
  const ptR12 = isoPoint2(1, 0, 0);
  const vC2 = [ptC12[0] - originPt2[0], ptC12[1] - originPt2[1]];
  const vR2 = [ptR12[0] - originPt2[0], ptR12[1] - originPt2[1]];

  // Offset axes slightly outward for legibility (walk opposite along the orthogonal axis)
  let offsetAmount2 = Math.max(12, tile * 0.5);
  offsetAmount2 = offsetAmount2 * 0.5;
  const normR2 = Math.hypot(vR2[0], vR2[1]) || 1;
  const normC2 = Math.hypot(vC2[0], vC2[1]) || 1;
  const offR2 = [-vR2[0] / normR2 * offsetAmount2, -vR2[1] / normR2 * offsetAmount2];
  const offC2 = [-vC2[0] / normC2 * offsetAmount2, -vC2[1] / normC2 * offsetAmount2];

  // Perpendiculars for tick drawing
  const perpC2 = [-vC2[1] / normC2, vC2[0] / normC2];
  const perpR2 = [-vR2[1] / normR2, vR2[0] / normR2];

  // Invert background color for axis/labels contrast
  const inv2 = { r: 255 - palette2.bg.r, g: 255 - palette2.bg.g, b: 255 - palette2.bg.b };
  const axisColor2 = `rgb(${inv2.r}, ${inv2.g}, ${inv2.b})`;

  ctx2.save();
  ctx2.strokeStyle = axisColor2;
  ctx2.fillStyle = axisColor2;
  ctx2.lineWidth = 1.2;
  ctx2.font = `${Math.max(10, Math.round(tile * 0.12))}px Arial`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';

  // Axis start positions (moved outward previously via offR2/offC2)
  const axisStartCol2 = [originPt2[0] + offR2[0], originPt2[1] + offR2[1]];
  const axisDirCol2 = [vC2[0], vC2[1]];
  const axisStartRow2 = [originPt2[0] + offC2[0], originPt2[1] + offC2[1]];
  const axisDirRow2 = [vR2[0], vR2[1]];

  // Helper: get a point on the ground plane (z=0)
  function planePoint2(r, c) { return isoPoint2(r, c, 0); }

  // Draw axis lines
  ctx2.beginPath();
  ctx2.moveTo(axisStartCol2[0], axisStartCol2[1]);
  ctx2.lineTo(axisStartCol2[0] + axisDirCol2[0] * (cols - 1), axisStartCol2[1] + axisDirCol2[1] * (cols - 1));
  ctx2.stroke();

  ctx2.beginPath();
  ctx2.moveTo(axisStartRow2[0], axisStartRow2[1]);
  ctx2.lineTo(axisStartRow2[0] + axisDirRow2[0] * (rows - 1), axisStartRow2[1] + axisDirRow2[1] * (rows - 1));
  ctx2.stroke();

  // Helper: project a ground point onto an axis
  function projectOntoAxis2(pt, axisStart, axisDir) {
    const dx = pt[0] - axisStart[0];
    const dy = pt[1] - axisStart[1];
    const denom = axisDir[0] * axisDir[0] + axisDir[1] * axisDir[1] || 1;
    const t = (dx * axisDir[0] + dy * axisDir[1]) / denom;
    return [axisStart[0] + axisDir[0] * t, axisStart[1] + axisDir[1] * t];
  }

  const tickLen2 = Math.max(6, tile * 0.08);
  const OUTER_LABEL_MULT2 = 1.6;

  // Column ticks on column grid LINES: use midpoints (c + 0.5), project to unoffset column-axis then add offR2
  for (let c = 0; c < Math.max(0, cols - 1); c++) {
    const groundMid = planePoint2(0, c + 0.5);
    const baseProj = projectOntoAxis2(groundMid, originPt2, vC2);
    const p = [baseProj[0] + offR2[0], baseProj[1] + offR2[1]];
    ctx2.beginPath();
    ctx2.moveTo(p[0] - perpC2[0] * (tickLen2 / 2), p[1] - perpC2[1] * (tickLen2 / 2));
    ctx2.lineTo(p[0] + perpC2[0] * (tickLen2 / 2), p[1] + perpC2[1] * (tickLen2 / 2));
    ctx2.stroke();
  }

  // Column labels (C#) placed on the axis at integer column centers — project + offR2 outward
  for (let c = 0; c < cols; c++) {
    const groundCenter = planePoint2(0, c);
    const baseProj = projectOntoAxis2(groundCenter, originPt2, vC2);
    const p = [baseProj[0] + offR2[0] * OUTER_LABEL_MULT2, baseProj[1] + offR2[1] * OUTER_LABEL_MULT2];
    const label = (allTh2[c + 1] !== undefined && allTh2[c + 1] !== '') ? allTh2[c + 1] : `C${c + 1}`;
    ctx2.save();
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText(label, p[0], p[1]);
    ctx2.restore();
  }

  // Row ticks & labels (left vertical black axis)
  for (let r = 0; r < Math.max(0, rows - 1); r++) {
    const groundMid = planePoint2(r + 0.5, 0);
    const baseProj = projectOntoAxis2(groundMid, originPt2, vR2);
    const p = [baseProj[0] + offC2[0], baseProj[1] + offC2[1]];
    ctx2.beginPath();
    ctx2.moveTo(p[0] - perpR2[0] * (tickLen2 / 2), p[1] - perpR2[1] * (tickLen2 / 2));
    ctx2.lineTo(p[0] + perpR2[0] * (tickLen2 / 2), p[1] + perpR2[1] * (tickLen2 / 2));
    ctx2.stroke();
  }

  for (let r = 0; r < rows; r++) {
    const groundCenter = planePoint2(r, 0);
    const baseProj = projectOntoAxis2(groundCenter, originPt2, vR2);
    const p = [baseProj[0] + offC2[0] * OUTER_LABEL_MULT2, baseProj[1] + offC2[1] * OUTER_LABEL_MULT2];
    const label = (rowHeaders2[r] !== undefined && rowHeaders2[r] !== '') ? rowHeaders2[r] : String(r + 1);
    ctx2.save();
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText(label, p[0], p[1]);
    ctx2.restore();
  }

  ctx2.restore();
} catch (err) {
  // If anything fails, don't break the whole draw — just skip axis drawing for Map2
  console.warn('drawIso2: axis drawing skipped due to error', err);
}
  }

  // Color controls for instance 2 (includes font color and background via cPoint)
  function initColorControls2(){
    const cMin = document.getElementById(id2('cMin'));
    const cBetweenMin = document.getElementById(id2('cBetweenMin'));
    const cMid = document.getElementById(id2('cMid'));
    const cBetweenMax = document.getElementById(id2('cBetweenMax'));
    const cMax = document.getElementById(id2('cMax'));
    const cLine = document.getElementById(id2('cLine'));
    const cPoint = document.getElementById(id2('cPoint'));
    const cFont = document.getElementById(id2('cFont'));
    const alpha = document.getElementById(id2('alpha'));
 
    if(cMin) cMin.value = '#90EE90';
    if(cBetweenMin) cBetweenMin.value = '#FFFFFF';
    if(cMid) cMid.value = '#FFFF00';
    if(cBetweenMax) cBetweenMax.value = '#0000FF';
    if(cMax) cMax.value = '#FF0000';
    if(cLine) cLine.value = '#808080';
    // default background for instance 2 (now white)
    if(cPoint) cPoint.value = '#ffffff';
    // default font color (light gray)
    const defaultFontHex = '#bfbfbf';
    if(cFont) cFont.value = defaultFontHex;
    // initialize palette2 from inputs
    if(cPoint){ const bg = hexToRgb(cPoint.value); if(bg) palette2.bg = bg; }
    if(cFont){ const f = hexToRgb(cFont.value); if(f) palette2.fontColor = f; }
    if(cMin){ const m = hexToRgb(cMin.value); if(m) palette2.min = m; }
    if(cBetweenMin){ const bm = hexToRgb(cBetweenMin.value); if(bm) palette2.betweenMin = bm; }
    if(cMid){ const md = hexToRgb(cMid.value); if(md) palette2.mid = md; }
    if(cBetweenMax){ const bx = hexToRgb(cBetweenMax.value); if(bx) palette2.betweenMax = bx; }
    if(cMax){ const mx = hexToRgb(cMax.value); if(mx) palette2.max = mx; }
 
    updateColorButtons2();
 
    if(cMin) cMin.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.min=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cBetweenMin) cBetweenMin.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.betweenMin=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cMid) cMid.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.mid=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cBetweenMax) cBetweenMax.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.betweenMax=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cMax) cMax.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.max=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cLine) cLine.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.line=rgb; updateColorButtons2(); drawIso2(); }});
    // cPoint sets canvas background
    if(cPoint) cPoint.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.bg=rgb; updateColorButtons2(); drawIso2(); }});
    // font picker for table2
    if(cFont) cFont.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.fontColor = rgb; updateColorButtons2(); if(table2) table2.style.color = rgbaString(rgb.r, rgb.g, rgb.b, 1.0); colorizeTable2(); }});
    if(alpha) alpha.addEventListener('input',(e)=>{ palette2.alpha = parseFloat(e.target.value); colorizeTable2(); drawIso2(); });
    const bMin = document.getElementById(id2('cMinBtn')); if(bMin) bMin.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMin')); if(el) el.click(); });
    const bBetweenMin = document.getElementById(id2('cBetweenMinBtn')); if(bBetweenMin) bBetweenMin.addEventListener('click', ()=>{ const el = document.getElementById(id2('cBetweenMin')); if(el) el.click(); });
    const bMid = document.getElementById(id2('cMidBtn')); if(bMid) bMid.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMid')); if(el) el.click(); });
    const bBetweenMax = document.getElementById(id2('cBetweenMaxBtn')); if(bBetweenMax) bBetweenMax.addEventListener('click', ()=>{ const el = document.getElementById(id2('cBetweenMax')); if(el) el.click(); });
    const bMax = document.getElementById(id2('cMaxBtn')); if(bMax) bMax.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMax')); if(el) el.click(); });
    const bLine = document.getElementById(id2('cLineBtn')); if(bLine) bLine.addEventListener('click', ()=>{ const el = document.getElementById(id2('cLine')); if(el) el.click(); });
    const bPoint = document.getElementById(id2('cPointBtn')); if(bPoint) bPoint.addEventListener('click', ()=>{ const el = document.getElementById(id2('cPoint')); if(el) el.click(); });
    const bFont = document.getElementById(id2('cFontBtn')); if(bFont) bFont.addEventListener('click', ()=>{ const el = document.getElementById(id2('cFont')); if(el) el.click(); });
  }
  function updateColorButtons2(){
    const btnMin = document.getElementById(id2('cMinBtn'));
    const btnBetweenMin = document.getElementById(id2('cBetweenMinBtn'));
    const btnMid = document.getElementById(id2('cMidBtn'));
    const btnBetweenMax = document.getElementById(id2('cBetweenMaxBtn'));
    const btnMax = document.getElementById(id2('cMaxBtn'));
    const btnLine = document.getElementById(id2('cLineBtn'));
    const btnPoint = document.getElementById(id2('cPointBtn'));
    const btnFont = document.getElementById(id2('cFontBtn'));
    if(btnMin) btnMin.style.backgroundColor = `rgb(${palette2.min.r}, ${palette2.min.g}, ${palette2.min.b})`;
    if(btnBetweenMin) btnBetweenMin.style.backgroundColor = `rgb(${palette2.betweenMin.r}, ${palette2.betweenMin.g}, ${palette2.betweenMin.b})`;
    if(btnMid) btnMid.style.backgroundColor = `rgb(${palette2.mid.r}, ${palette2.mid.g}, ${palette2.mid.b})`;
    if(btnBetweenMax) btnBetweenMax.style.backgroundColor = `rgb(${palette2.betweenMax.r}, ${palette2.betweenMax.g}, ${palette2.betweenMax.b})`;
    if(btnMax) btnMax.style.backgroundColor = `rgb(${palette2.max.r}, ${palette2.max.g}, ${palette2.max.b})`;
    if(btnLine) btnLine.style.backgroundColor = `rgb(${palette2.line.r}, ${palette2.line.g}, ${palette2.line.b})`;
    // Show background color on points button
    if(btnPoint) btnPoint.style.backgroundColor = `rgb(${palette2.bg.r}, ${palette2.bg.g}, ${palette2.bg.b})`;
    if(btnFont) btnFont.style.backgroundColor = `rgb(${palette2.fontColor.r}, ${palette2.fontColor.g}, ${palette2.fontColor.b})`;
  }
  function colorizeTable2(){
    // Apply font color to table2
    if(table2) table2.style.color = rgbaString(palette2.fontColor.r, palette2.fontColor.g, palette2.fontColor.b, 1.0);

    const cells = table2.querySelectorAll('td[contenteditable]');

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
      const v = parsed[i];
      // If value is not a number, clear background
      if (v === null) {
        cell.style.backgroundColor = '';
        return;
      }
      const col = gradientColor2(v, minV, maxV);
      cell.style.backgroundColor = rgbaString(col.r, col.g, col.b, palette2.alpha);
    });
  }

  // Table interactions for instance 2
  function bindTable2Events(){
    if(!table2) return;
    // Focus / edit handlers: allow headers and data cells to be edited.
    table2.addEventListener('focusin', (e)=>{
      const cell = e.target.closest('[data-r][data-c][contenteditable]');
      if(!cell) return;
      cell.dataset.oldValue = cell.textContent;
      clearSelection2();
      selectCell2(cell);
    });
    table2.addEventListener('keydown', (e)=>{
      const cell = e.target.closest('[data-r][data-c][contenteditable]');
      if(!cell) return;
      if(e.key === 'Enter'){ e.preventDefault(); cell.blur(); }
      if(e.key === 'Escape'){ e.preventDefault(); cell.textContent = cell.dataset.oldValue || ''; cell.blur(); }
    });
    table2.addEventListener('blur', (e)=>{
      const cell = e.target.closest('[data-r][data-c][contenteditable]');
      if(!cell) return;
      const rAttr = cell.getAttribute('data-r');
      const cAttr = cell.getAttribute('data-c');
      const r = parseInt(rAttr, 10);
      const c = parseInt(cAttr, 10);
      const val = cell.textContent.trim();
      const num = parseFloat(val.replace(/,/g,'.'));
      // If data cell, validate and write into data2, else keep header text as-is.
      if (!Number.isNaN(r) && !Number.isNaN(c) && r >= 0 && c >= 0) {
        if(!Number.isFinite(num)){ cell.textContent = cell.dataset.oldValue || formatNumberDisplay2(0); return; }
        const clamped = Math.max(-9999, Math.min(9999, num));
        data2[r][c] = Number(clamped.toFixed(6));
        cell.textContent = formatNumberDisplay2(data2[r][c]);
        colorizeTable2();
        drawIso2();
      } else {
        // header edited: leave as entered
      }
    }, true);
  
    table2.addEventListener('mousedown', (e)=>{
      const cell = e.target.closest('[data-r][data-c]');
      if(!cell) return;
      clearSelection2();
      startCell2 = cell;
      selectCell2(cell);
      isSelecting2 = true;
    });
    table2.addEventListener('mousemove', (e)=>{
      if(!isSelecting2 || !startCell2) return;
      const cell = e.target.closest('[data-r][data-c]');
      if(cell) selectRange2(startCell2, cell);
    });
    table2.addEventListener('mouseup', ()=>{ isSelecting2=false; startCell2=null; });
    document.addEventListener('mousedown', (e)=>{ if(!table2.contains(e.target)) clearSelection2(); });
  }

  let selectedCells2 = new Set();
  let isSelecting2 = false;
  let startCell2 = null;
  function selectCell2(td){ selectedCells2.add(td); td.classList.add('selected'); }
  function deselectCell2(td){ selectedCells2.delete(td); td.classList.remove('selected'); }
  function clearSelection2(){ selectedCells2.forEach(td=>td.classList.remove('selected')); selectedCells2.clear(); }
  function selectRange2(start,end){
    clearSelection2();
    const startR = +start.dataset.r, startC = +start.dataset.c;
    const endR = +end.dataset.r, endC = +end.dataset.c;
    const minR = Math.min(startR,endR), maxR = Math.max(startR,endR);
    const minC = Math.min(startC,endC), maxC = Math.max(startC,endC);
    for(let r=minR;r<=maxR;r++){
      for(let c=minC;c<=maxC;c++){
        const el = table2.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if(el) selectCell2(el);
      }
    }
  }

  // Copy/paste for instance 2
  function copySelected2(){
    const cells = Array.from(selectedCells2);
    if(cells.length===0) return;
    const minR = Math.min(...cells.map(td=>+td.dataset.r));
    const maxR = Math.max(...cells.map(td=>+td.dataset.r));
    const minC = Math.min(...cells.map(td=>+td.dataset.c));
    const maxC = Math.max(...cells.map(td=>+td.dataset.c));
    const rows = [];
    for(let r=minR;r<=maxR;r++){
      const row = [];
      for(let c=minC;c<=maxC;c++){
        const el = table2.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        row.push(el ? el.textContent : '');
      }
      rows.push(row.join('\t'));
    }
    navigator.clipboard.writeText(rows.join('\n'));
  }
  function pasteSelected2(){
    navigator.clipboard.readText().then(text=>{
      // Parse clipboard into a 2D array
      const rows = text.split('\n').map(r => r.replace(/\r/g, '').split('\t').map(v => v));
      // Currently selected cells (ordered)
      const selCells = Array.from(selectedCells2).sort((a,b)=>(+a.dataset.r - +b.dataset.r) || (+a.dataset.c - +b.dataset.c));
  
      // Helper to write a value into a target element
      function writeToTarget(target, rawVal) {
        if (!target) return;
        const tag = (target.tagName || '').toLowerCase();
        if (tag === 'td') {
          const num = parseFloat((rawVal || '').toString().trim().replace(/,/g,'.'));
          if (Number.isFinite(num)) {
            const clamped = Math.max(-9999, Math.min(9999, num));
            const r = +target.dataset.r, c = +target.dataset.c;
            data2[r][c] = Number(clamped.toFixed(6));
            target.textContent = formatNumberDisplay2(data2[r][c]);
          } else {
            // Non-numeric into a td: leave as-is
          }
        } else {
          // th header -> paste raw text
          target.textContent = rawVal;
        }
      }
  
      if (selCells.length === 0) {
        // No selection: paste starting at top-left (0,0)
        const startR = 0, startC = 0;
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            const target = table2.querySelector(`[data-r="${startR + r}"][data-c="${startC + c}"]`);
            writeToTarget(target, rows[r][c]);
          }
        }
      } else if (selCells.length === 1) {
        // Single anchor cell: map clipboard matrix starting at that cell
        const anchor = selCells[0];
        const startR = parseInt(anchor.getAttribute('data-r'), 10);
        const startC = parseInt(anchor.getAttribute('data-c'), 10);
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            const target = table2.querySelector(`[data-r="${startR + r}"][data-c="${startC + c}"]`);
            writeToTarget(target, rows[r][c]);
          }
        }
      } else {
        // Multiple selected cells: if clipboard dims match bounding box, paste by position; otherwise fill selected cells sequentially.
        const minR = Math.min(...selCells.map(el=>+el.dataset.r));
        const maxR = Math.max(...selCells.map(el=>+el.dataset.r));
        const minC = Math.min(...selCells.map(el=>+el.dataset.c));
        const maxC = Math.max(...selCells.map(el=>+el.dataset.c));
        const boxRows = maxR - minR + 1;
        const boxCols = maxC - minC + 1;
  
        if (rows.length === boxRows && rows[0].length === boxCols) {
          for (let r = 0; r < boxRows; r++) {
            for (let c = 0; c < boxCols; c++) {
              const target = table2.querySelector(`[data-r="${minR + r}"][data-c="${minC + c}"]`);
              writeToTarget(target, rows[r][c]);
            }
          }
        } else {
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
  
      colorizeTable2();
      drawIso2();
    });
  }

  // Canvas interactions for instance 2
  if(canvas2 && ctx2){
    canvas2.addEventListener('wheel', (e)=>{
      e.preventDefault();
      const rect = canvas2.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.max(0.4, Math.min(3.5, zoom2 * factor));
      const scale = newZoom / zoom2;
      if(originX2 === null || originY2 === null){
        originX2 = (canvas2.width / (window.devicePixelRatio || 1)) / 2;
        originY2 = (canvas2.height / (window.devicePixelRatio || 1)) / 2;
      }
      originX2 = mouseX - scale * (mouseX - originX2);
      originY2 = mouseY - scale * (mouseY - originY2);
      zoom2 = newZoom;
      drawIso2();
    }, { passive: false });

    let dragging2=false, lastX2=0;
    canvas2.addEventListener('pointerdown',(e)=>{ dragging2=true; lastX2=e.clientX; canvas2.setPointerCapture(e.pointerId); });
    canvas2.addEventListener('pointermove',(e)=>{ if(!dragging2) return; const dx = e.clientX - lastX2; lastX2 = e.clientX; rotation2 -= dx*0.01; drawIso2(); });
    canvas2.addEventListener('pointerup',(e)=>{ dragging2=false; canvas2.releasePointerCapture(e.pointerId); });
  }

  // Size controls for instance 2
  const sizeInputX2 = document.getElementById(id2('sizeX'));
  const sizeInputY2 = document.getElementById(id2('sizeY'));
  // Ensure the numeric inputs reflect the JS state at startup
  if (sizeInputX2) sizeInputX2.value = sizeX2;
  if (sizeInputY2) sizeInputY2.value = sizeY2;
  if(sizeInputX2) sizeInputX2.addEventListener('change', ()=> regenerateDataXY2(Number(sizeInputX2.value), Number(sizeInputY2.value)));
  if(sizeInputY2) sizeInputY2.addEventListener('change', ()=> regenerateDataXY2(Number(sizeInputX2.value), Number(sizeInputY2.value)));
  
  // Swap axes button for Map2: transpose data2, swap sizeX2/sizeY2, preserve headers and refresh views.
  const swapBtn2 = document.getElementById('swapAxes2');
  function swapAxes2() {
    if (!table2) return;
    // Capture existing headers
    const theadThs2 = Array.from(table2.querySelectorAll('thead tr th'));
    const oldColHeaders2 = theadThs2.slice(1).map(th => (th.textContent || '').trim());
    const oldRowHeaders2 = Array.from(table2.querySelectorAll('tbody tr th')).map(th => (th.textContent || '').trim());
  
    const oldCols = sizeX2, oldRows = sizeY2;
    // Build transposed data: new rows = oldCols, new cols = oldRows
    const newData2 = Array.from({ length: oldCols }, (_, c) =>
      Array.from({ length: oldRows }, (_, r) => (data2[r] && data2[r][c] !== undefined) ? data2[r][c] : 0)
    );
  
    data2 = newData2;
    // Swap sizes
    sizeX2 = oldRows;
    sizeY2 = oldCols;
    // Update inputs to reflect swapped sizes
    if (sizeInputX2) sizeInputX2.value = sizeX2;
    if (sizeInputY2) sizeInputY2.value = sizeY2;
    // Re-render table2 and apply headers swapped (old row headers -> column headers, old column headers -> row headers)
    renderTable2();
    const newTheadThs2 = Array.from(table2.querySelectorAll('thead tr th'));
    for (let i = 1; i < newTheadThs2.length; i++) {
      const txt = oldRowHeaders2[i - 1] !== undefined && oldRowHeaders2[i - 1] !== '' ? oldRowHeaders2[i - 1] : columnLabel2(i - 1);
      newTheadThs2[i].textContent = txt;
    }
    const newRowThs2 = Array.from(table2.querySelectorAll('tbody tr th'));
    for (let r = 0; r < newRowThs2.length; r++) {
      const txt = oldColHeaders2[r] !== undefined && oldColHeaders2[r] !== '' ? oldColHeaders2[r] : String(r + 1);
      newRowThs2[r].textContent = txt;
    }
  
    // Update map2 title
    const tab2 = document.getElementById(id2('tab-title'));
    if (tab2) tab2.textContent = `Tableau ${sizeX2}×${sizeY2}`;
  
    colorizeTable2();
    // Force recompute of camera/origin so the view recenters and fits
    originX2 = null; originY2 = null;
    drawIso2();
  }
  if (swapBtn2) swapBtn2.addEventListener('click', swapAxes2);
  
  function regenerateDataXY2(nx, ny){
    const clampedX = Math.max(2, Math.min(50, Math.floor(nx)));
    const clampedY = Math.max(2, Math.min(50, Math.floor(ny)));
    sizeX2 = clampedX; sizeY2 = clampedY;
    data2 = Array.from({ length: sizeY2 }, ()=> Array.from({ length: sizeX2 }, ()=>0));
    const tab = document.getElementById(id2('tab-title'));
    if(tab) tab.textContent = `Tableau ${sizeX2}×${sizeY2}`;
    renderTable2();
    colorizeTable2();
    originX2 = null; originY2 = null;
    drawIso2();
  }

  const elevationInput2 = document.getElementById(id2('elevationScale'));
  if(elevationInput2) elevationInput2.addEventListener('input', (e)=>{ elevationScale2 = parseFloat(e.target.value); drawIso2(); });

  // Global keyboard handlers (copy/paste/reset) - apply only if selection belongs to this instance
  document.addEventListener('keydown', (e)=>{
    if(!(e.ctrlKey || e.metaKey)) return;
    if(e.key === 'c'){ e.preventDefault(); copySelected2(); }
    if(e.key === 'v'){ e.preventDefault(); pasteSelected2(); }
    if(e.key === 'b'){ e.preventDefault(); zoom2 = Math.min(1.0, 10 / Math.max(sizeX2, sizeY2)); rotation2 = 0; originX2=null; originY2=null; drawIso2(); }
  });

  // Function: import and rescale Map1 -> Map2 using bilinear interpolation
  function importFromMap1() {
    const srcTable = document.getElementById('grid');
    if (!srcTable) return;
    // Build source grid from table cells
    const srcCells = srcTable.querySelectorAll('td[data-r][data-c]');
    const srcRows = Math.max(...Array.from(srcCells).map(td => +td.dataset.r)) + 1;
    const srcCols = Math.max(...Array.from(srcCells).map(td => +td.dataset.c)) + 1;
    const src = Array.from({ length: srcRows }, () => Array(srcCols).fill(0));
    srcCells.forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      const v = Number(td.textContent.trim()) || 0;
      src[r][c] = v;
    });

    // If either dimension is 1, handle as simple copy/average
    const dstRows = sizeY2, dstCols = sizeX2;
    if (dstRows <= 0 || dstCols <= 0) return;

    // Helper: sample bilinear from src at floating coordinates (y,x)
    function sampleBilinear(y, x) {
      // clamp coordinates
      const x0 = Math.floor(Math.max(0, Math.min(srcCols - 1, x)));
      const x1 = Math.min(srcCols - 1, x0 + 1);
      const y0 = Math.floor(Math.max(0, Math.min(srcRows - 1, y)));
      const y1 = Math.min(srcRows - 1, y0 + 1);
      const dx = x - x0;
      const dy = y - y0;
      const v00 = src[y0][x0];
      const v10 = src[y0][x1];
      const v01 = src[y1][x0];
      const v11 = src[y1][x1];
      const v0 = v00 * (1 - dx) + v10 * dx;
      const v1 = v01 * (1 - dx) + v11 * dx;
      return v0 * (1 - dy) + v1 * dy;
    }

    // Map each destination cell to source-space coordinates and interpolate
    for (let r = 0; r < dstRows; r++) {
      for (let c = 0; c < dstCols; c++) {
        // target (c,r) maps to source coords:
        // scale factor: (srcCols-1)/(dstCols-1), handle single-dimension cases
        const sx = dstCols === 1 ? (srcCols - 1) / 2 : c * (srcCols - 1) / Math.max(1, dstCols - 1);
        const sy = dstRows === 1 ? (srcRows - 1) / 2 : r * (srcRows - 1) / Math.max(1, dstRows - 1);
        const val = sampleBilinear(sy, sx);
        // clamp but preserve decimals (no rounding)
        const clampedVal = Math.max(-9999, Math.min(9999, val));
        // ensure data2 has correct shape
        if (!data2[r]) data2[r] = Array(dstCols).fill(0);
        data2[r][c] = Number(clampedVal.toFixed(6));
      }
    }

    // Update table DOM for grid2 (cells exist if renderTable2 created them)
    renderTable2(); // re-render table2 to match data2 structure
    // After renderTable2, populate values from data2
    const dstCells = table2.querySelectorAll('td[data-r][data-c]');
    dstCells.forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      td.textContent = formatNumberDisplay2((data2[r] && data2[r][c] !== undefined) ? data2[r][c] : 0);
    });

    colorizeTable2();
    drawIso2();
  }

  // Wire copy button in toolbar
  const copyBtn = document.getElementById('copyMapBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      importFromMap1();
    });
  }

  // Initialization
  renderTable2();
  initColorControls2();
  bindTable2Events();
  colorizeTable2();
  drawIso2();

  // Decimal control buttons for Map2 (+ / -) and separator toggle (per-table)
  const decPlusBtn2 = document.getElementById('decPlus2');
  const decMinusBtn2 = document.getElementById('decMinus2');
  const decSepToggle2 = document.getElementById('decSepToggle2');
  if (decPlusBtn2) decPlusBtn2.addEventListener('click', () => {
    decimalPlaces2 = Math.min(6, decimalPlaces2 + 1);
    renderTable2();
    colorizeTable2();
    drawIso2();
  });
  if (decMinusBtn2) decMinusBtn2.addEventListener('click', () => {
    decimalPlaces2 = Math.max(0, decimalPlaces2 - 1);
    renderTable2();
    colorizeTable2();
    drawIso2();
  });
  if (decSepToggle2) {
    // initialize label from per-table setting
    const sepInit = localStorage.getItem('decimalSep2') || '.';
    decSepToggle2.textContent = `🔁 ${sepInit}`;
    decSepToggle2.addEventListener('click', () => {
      const current = localStorage.getItem('decimalSep2') || '.';
      const next = current === '.' ? ',' : '.';
      localStorage.setItem('decimalSep2', next);
      decSepToggle2.textContent = `🔁 ${next}`;
      // re-render only this table
      renderTable2();
      colorizeTable2();
      drawIso2();
    });
  }
  /* per-table separator handling — no global listener here */

  // Redraw on global events (resizer/app-level) so instance 2 updates when container sizes change
  window.addEventListener('redraw', () => {
    drawIso2();
  });
})();