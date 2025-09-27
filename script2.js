(function() {
  // Second independent Carto instance (targets elements with '2' suffix)
  let sizeX2 = 6;
  let sizeY2 = 6;
  let elevationScale2 = 1.0;
  let data2 = Array.from({ length: sizeY2 }, () =>
    Array.from({ length: sizeX2 }, () => 0)
  );

  const palette2 = {
    min: { r: 144, g: 238, b: 144 },
    mid: { r: 255, g: 255, b: 0 },
    max: { r: 255, g: 0, b: 0 },
    line: { r: 128, g: 128, b: 128 },
    point: { r: 0, g: 0, b: 0 },
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
    if(maxV === minV) return palette2.min;
    const t = Math.max(0, Math.min(1, (value - minV) / (maxV - minV)));
    if(t < 0.5) return mix(palette2.min, palette2.mid, t*2);
    return mix(palette2.mid, palette2.max, (t-0.5)*2);
  }

  const table2 = document.getElementById(id2('grid'));
  const canvas2 = document.getElementById(id2('iso'));
  const ctx2 = canvas2 ? canvas2.getContext('2d') : null;

  function renderTable2(){
    if(!table2) return;
    const head = '<thead>' +
      '<tr>' + '<th></th>' + Array.from({length: sizeX2}, (_, i) => `<th>C${i+1}</th>`).join('') + '</tr>' +
    '</thead>';
    const body = '<tbody>' +
      data2.map((row, r) => (
        '<tr>' + `<th>L${r+1}</th>` + row.map((v, c) => `<td contenteditable="true" inputmode="numeric" data-r="${r}" data-c="${c}">${v}</td>`).join('') + '</tr>'
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

  let zoom2 = 1.0;
  let rotation2 = 0;
  let originX2 = null;
  let originY2 = null;

  function drawIso2(){
    if(!canvas2 || !ctx2) return;
    resizeCanvas2();
    const dark = document.body.classList.contains('dark');
    ctx2.clearRect(0,0,canvas2.width,canvas2.height);
    ctx2.save();
    ctx2.fillStyle = dark ? '#0b0d12' : '#eef2f8';
    ctx2.fillRect(0,0,canvas2.width,canvas2.height);
    ctx2.restore();

    const cols = sizeX2, rows = sizeY2;
    const maxV = Math.max(1, ...data2.flat());
    const base = Math.min(canvas2.width, canvas2.height)/8;
    const tile = base * zoom2;
    const hScale = tile * 0.35 * elevationScale2;

    if(originX2 === null || originY2 === null){
      originX2 = (canvas2.width / (window.devicePixelRatio || 1)) / 2;
      originY2 = (canvas2.height / (window.devicePixelRatio || 1)) / 2 - tile * 0.5;
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
  }

  // Color controls for instance 2
  function initColorControls2(){
    const cMin = document.getElementById(id2('cMin'));
    const cMid = document.getElementById(id2('cMid'));
    const cMax = document.getElementById(id2('cMax'));
    const cLine = document.getElementById(id2('cLine'));
    const cPoint = document.getElementById(id2('cPoint'));
    const alpha = document.getElementById(id2('alpha'));

    if(cMin) cMin.value = '#90EE90';
    if(cMid) cMid.value = '#FFFF00';
    if(cMax) cMax.value = '#FF0000';
    if(cLine) cLine.value = '#808080';
    if(cPoint) cPoint.value = '#000000';
    updateColorButtons2();

    if(cMin) cMin.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.min=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cMid) cMid.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.mid=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cMax) cMax.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.max=rgb; updateColorButtons2(); colorizeTable2(); drawIso2(); }});
    if(cLine) cLine.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.line=rgb; updateColorButtons2(); drawIso2(); }});
    if(cPoint) cPoint.addEventListener('change',(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb){ palette2.point=rgb; updateColorButtons2(); drawIso2(); }});
    if(alpha) alpha.addEventListener('input',(e)=>{ palette2.alpha = parseFloat(e.target.value); const av = document.getElementById(id2('alphaVal')); if(av) av.textContent = palette2.alpha.toFixed(2); colorizeTable2(); drawIso2(); });
    const bMin = document.getElementById(id2('cMinBtn')); if(bMin) bMin.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMin')); if(el) el.click(); });
    const bMid = document.getElementById(id2('cMidBtn')); if(bMid) bMid.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMid')); if(el) el.click(); });
    const bMax = document.getElementById(id2('cMaxBtn')); if(bMax) bMax.addEventListener('click', ()=>{ const el = document.getElementById(id2('cMax')); if(el) el.click(); });
    const bLine = document.getElementById(id2('cLineBtn')); if(bLine) bLine.addEventListener('click', ()=>{ const el = document.getElementById(id2('cLine')); if(el) el.click(); });
    const bPoint = document.getElementById(id2('cPointBtn')); if(bPoint) bPoint.addEventListener('click', ()=>{ const el = document.getElementById(id2('cPoint')); if(el) el.click(); });
  }
  function updateColorButtons2(){
    const btnMin = document.getElementById(id2('cMinBtn'));
    const btnMid = document.getElementById(id2('cMidBtn'));
    const btnMax = document.getElementById(id2('cMaxBtn'));
    const btnLine = document.getElementById(id2('cLineBtn'));
    const btnPoint = document.getElementById(id2('cPointBtn'));
    if(btnMin) btnMin.style.backgroundColor = `rgb(${palette2.min.r}, ${palette2.min.g}, ${palette2.min.b})`;
    if(btnMid) btnMid.style.backgroundColor = `rgb(${palette2.mid.r}, ${palette2.mid.g}, ${palette2.mid.b})`;
    if(btnMax) btnMax.style.backgroundColor = `rgb(${palette2.max.r}, ${palette2.max.g}, ${palette2.max.b})`;
    if(btnLine) btnLine.style.backgroundColor = `rgb(${palette2.line.r}, ${palette2.line.g}, ${palette2.line.b})`;
    if(btnPoint) btnPoint.style.backgroundColor = `rgb(${palette2.point.r}, ${palette2.point.g}, ${palette2.point.b})`;
  }
  function colorizeTable2(){
    const cells = table2.querySelectorAll('td[contenteditable]');
    const values = Array.from(cells).map(cell=>Number(cell.textContent));
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    cells.forEach(cell=>{
      const v = Number(cell.textContent);
      const col = gradientColor2(v, minV, maxV);
      cell.style.backgroundColor = rgbaString(col.r, col.g, col.b, palette2.alpha);
    });
  }

  // Table interactions for instance 2
  function bindTable2Events(){
    if(!table2) return;
    table2.addEventListener('focusin', (e)=>{
      const td = e.target.closest('td[contenteditable]');
      if(!td) return;
      td.dataset.oldValue = td.textContent;
      clearSelection2();
      selectCell2(td);
    });
    table2.addEventListener('keydown', (e)=>{
      const td = e.target.closest('td[contenteditable]');
      if(!td) return;
      if(e.key === 'Enter'){ e.preventDefault(); td.blur(); }
      if(e.key === 'Escape'){ e.preventDefault(); td.textContent = td.dataset.oldValue || ''; td.blur(); }
    });
    table2.addEventListener('blur', (e)=>{
      const td = e.target.closest('td[contenteditable]');
      if(!td) return;
      const r = Number(td.getAttribute('data-r'));
      const c = Number(td.getAttribute('data-c'));
      const val = td.textContent.trim();
      const num = Number(val.replace(/,/g,'.'));
      if(!Number.isFinite(num)){ td.textContent = td.dataset.oldValue || '0'; return; }
      const clamped = Math.max(-9999, Math.min(9999, Math.round(num)));
      data2[r][c] = clamped;
      td.textContent = String(clamped);
      colorizeTable2();
      drawIso2();
    }, true);

    table2.addEventListener('mousedown', (e)=>{
      const td = e.target.closest('td');
      if(!td) return;
      clearSelection2();
      startCell2 = td;
      selectCell2(td);
      isSelecting2 = true;
    });
    table2.addEventListener('mousemove', (e)=>{
      if(!isSelecting2 || !startCell2) return;
      const td = e.target.closest('td');
      if(td) selectRange2(startCell2, td);
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
        const td = table2.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
        if(td) selectCell2(td);
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
        const td = table2.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
        row.push(td ? td.textContent : '');
      }
      rows.push(row.join('\t'));
    }
    navigator.clipboard.writeText(rows.join('\n'));
  }
  function pasteSelected2(){
    navigator.clipboard.readText().then(text=>{
      const rows = text.split('\n').map(r=>r.replace(/\r/g,'').split('\t'));
      const cells = Array.from(selectedCells2).sort((a,b)=>(+a.dataset.r - +b.dataset.r) || (+a.dataset.c - +b.dataset.c));
      let idx = 0;
      for(const row of rows){
        for(const val of row){
          if(idx < cells.length){
            const td = cells[idx];
            const num = Number(val.trim().replace(/,/g,'.'));
            if(Number.isFinite(num)){
              const clamped = Math.max(-9999, Math.min(9999, Math.round(num)));
              const r = +td.dataset.r, c = +td.dataset.c;
              data2[r][c] = clamped;
              td.textContent = String(clamped);
            }
            idx++;
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
  if(sizeInputX2) sizeInputX2.addEventListener('change', ()=> regenerateDataXY2(Number(sizeInputX2.value), Number(sizeInputY2.value)));
  if(sizeInputY2) sizeInputY2.addEventListener('change', ()=> regenerateDataXY2(Number(sizeInputX2.value), Number(sizeInputY2.value)));
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
        // clamp/round same as original behavior
        const clamped = Math.max(-9999, Math.min(9999, Math.round(val)));
        // ensure data2 has correct shape
        if (!data2[r]) data2[r] = Array(dstCols).fill(0);
        data2[r][c] = clamped;
      }
    }

    // Update table DOM for grid2 (cells exist if renderTable2 created them)
    renderTable2(); // re-render table2 to match data2 structure
    // After renderTable2, populate values from data2
    const dstCells = table2.querySelectorAll('td[data-r][data-c]');
    dstCells.forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      td.textContent = String((data2[r] && data2[r][c] !== undefined) ? data2[r][c] : 0);
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

  // Redraw on global events (resizer/app-level) so instance 2 updates when container sizes change
  window.addEventListener('redraw', () => {
    drawIso2();
  });
})();