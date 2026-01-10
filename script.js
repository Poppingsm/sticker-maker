document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // DOM要素
  const textInput = document.getElementById("text"), fontSelect = document.getElementById("fontFamily");
  const textColorInput = document.getElementById("textColor"), strokeColorInput = document.getElementById("strokeColor");
  const strokeWidthInput = document.getElementById("strokeWidth"), bgColorInput = document.getElementById("bgColor");
  const addBtn = document.getElementById("addText"), deleteBtn = document.getElementById("deleteText"), saveBtn = document.getElementById("saveImage");
  const imageInput = document.getElementById("imageInput"), opacityInput = document.getElementById("opacity");
  const aiRemoveBgBtn = document.getElementById("aiRemoveBg"), undoBtn = document.getElementById("undoBtn");
  const frontBtn = document.getElementById("bringToFront"), backBtn = document.getElementById("sendToBack");

  let layers = [];
  let history = []; // Undo用の履歴
  let selectedIndex = -1;
  let isDragging = false, isRotating = false, isResizing = false, isExporting = false; 
  let resizeMode = "", offsetX = 0, offsetY = 0, startMouseAngle = 0, startLayerAngle = 0;
  let showGuideX = false, showGuideY = false;

  const HANDLE_RADIUS = 12, OFFSET = 5, SNAP_LIMIT = 10, GRID_SIZE = 25, MAX_HISTORY = 20;

  // --- 履歴保存機能 ---
  function saveHistory() {
    // 履歴をディープコピーして保存（画像は参照のまま）
    const state = layers.map(l => ({...l}));
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
  }

  undoBtn.addEventListener("click", () => {
    if (history.length > 0) {
      layers = history.pop();
      selectedIndex = -1;
      drawSticker();
    }
  });

  // ショートカットキー対応
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      undoBtn.click();
    }
  });

  // --- 高精度AI背景除去 ---
  const selfieSegmentation = new SelfieSegmentation({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`});
  selfieSegmentation.setOptions({ modelSelection: 1 }); // 高精度モデル

  async function removeBackgroundAI(layer) {
    saveHistory(); // 実行前に保存
    const tempCanvas = document.createElement("canvas");
    const tCtx = tempCanvas.getContext("2d");
    tempCanvas.width = layer.originalImg.width;
    tempCanvas.height = layer.originalImg.height;

    selfieSegmentation.onResults((results) => {
      tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // 1. マスクの描画（ぼかしを加えて精度を上げる）
      tCtx.filter = 'blur(2px)'; // ソフトエッジ処理
      tCtx.drawImage(results.segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // 2. 合成
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.filter = 'none';
      tCtx.drawImage(results.image, 0, 0, tempCanvas.width, tempCanvas.height);
      
      const newImg = new Image();
      newImg.onload = () => { layer.img = newImg; drawSticker(); };
      newImg.src = tempCanvas.toDataURL();
    });

    await selfieSegmentation.send({image: layer.originalImg});
  }

  aiRemoveBgBtn.addEventListener("click", async () => {
    if (selectedIndex === -1 || layers[selectedIndex].type !== 'image') return;
    aiRemoveBgBtn.innerText = "高精度解析中...";
    await removeBackgroundAI(layers[selectedIndex]);
    aiRemoveBgBtn.innerText = "✨ 高精度AI切り抜き";
  });

  // --- 描画コア ---
  function getLayerMetrics(layer) {
    if (layer.type === 'image') return { width: layer.img.width, height: layer.img.height };
    ctx.font = `bold ${layer.fontSize || 60}px ${layer.fontFamily}`;
    const m = ctx.measureText(layer.text);
    return { width: m.width, height: layer.fontSize * 0.8 || 48 };
  }

  function drawGrid() {
    if (isExporting) return;
    ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.5;
    for (let x = GRID_SIZE; x < canvas.width; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = GRID_SIZE; y < canvas.height; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.restore();
  }

  function drawSticker() {
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    if (isDragging && !isExporting) {
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
      if (showGuideX) { ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke(); }
      if (showGuideY) { ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke(); }
      ctx.restore();
    }
    layers.forEach((layer, index) => {
      ctx.save(); ctx.translate(layer.x, layer.y); ctx.rotate(layer.angle || 0); ctx.globalAlpha = layer.opacity || 1.0;
      const m = getLayerMetrics(layer), curW = m.width * layer.scaleX, curH = m.height * layer.scaleY;
      if (layer.type === 'image') { ctx.drawImage(layer.img, -curW/2, -curH/2, curW, curH); }
      else {
        ctx.save(); ctx.scale(layer.scaleX, layer.scaleY); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold ${layer.fontSize || 60}px ${layer.fontFamily}`;
        if (layer.strokeWidth > 0) { ctx.strokeStyle = layer.strokeColor; ctx.lineWidth = layer.strokeWidth / Math.max(layer.scaleX, layer.scaleY); ctx.lineJoin = "round"; ctx.strokeText(layer.text, 0, 0); }
        ctx.fillStyle = layer.color; ctx.fillText(layer.text, 0, 0); ctx.restore();
      }
      if (index === selectedIndex && !isExporting) {
        ctx.globalAlpha = 1.0; ctx.strokeStyle = "#007bff"; ctx.setLineDash([5, 5]); ctx.strokeRect(-curW/2 - OFFSET, -curH/2 - OFFSET, curW + (OFFSET*2), curH + (OFFSET*2)); ctx.setLineDash([]);
        drawCircle(0, -curH/2 - 40, "#4CAF50"); drawCircle(curW/2 + OFFSET, 0, "white"); drawCircle(0, curH/2 + OFFSET, "white"); drawCircle(curW/2 + OFFSET, curH/2 + OFFSET, "#007bff");
      }
      ctx.restore();
    });
  }

  function drawCircle(x, y, color) { ctx.fillStyle = color; ctx.strokeStyle = "black"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }

  // --- イベント ---
  function handleDown(mx, my) {
    if (selectedIndex !== -1) {
      const s = layers[selectedIndex], m = getLayerMetrics(s), w = m.width*s.scaleX, h = m.height*s.scaleY;
      const loc = { x: (mx-s.x)*Math.cos(-s.angle)-(my-s.y)*Math.sin(-s.angle), y: (mx-s.x)*Math.sin(-s.angle)+(my-s.y)*Math.cos(-s.angle) };
      if (Math.hypot(loc.x, loc.y - (-h/2 - 40)) < 20) { isRotating = true; startMouseAngle = Math.atan2(mx - s.x, my - s.y); startLayerAngle = s.angle; return; }
      if (Math.hypot(loc.x - (w/2 + OFFSET), loc.y) < 20) { isResizing = true; resizeMode = "width"; return; }
      if (Math.hypot(loc.x, loc.y - (h/2 + OFFSET)) < 20) { isResizing = true; resizeMode = "height"; return; }
      if (Math.hypot(loc.x - (w/2 + OFFSET), loc.y - (h/2 + OFFSET)) < 20) { isResizing = true; resizeMode = "both"; return; }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i], m = getLayerMetrics(l), loc = { x: (mx-l.x)*Math.cos(-l.angle)-(my-l.y)*Math.sin(-l.angle), y: (mx-l.x)*Math.sin(-l.angle)+(my-l.y)*Math.cos(-l.angle) };
      if (Math.abs(loc.x) < (m.width*l.scaleX)/2 + OFFSET && Math.abs(loc.y) < (m.height*l.scaleY)/2 + OFFSET) {
        saveHistory(); // ドラッグ開始前に保存
        selectedIndex = i; isDragging = true; offsetX = mx - l.x; offsetY = my - l.y; drawSticker(); return;
      }
    }
    selectedIndex = -1; drawSticker();
  }

  function handleMove(mx, my) {
    if (selectedIndex === -1) return;
    const s = layers[selectedIndex];
    if (isDragging) {
      let tx = mx - offsetX, ty = my - offsetY; showGuideX = showGuideY = false;
      if (Math.abs(tx - canvas.width/2) < SNAP_LIMIT) { tx = canvas.width/2; showGuideX = true; }
      if (Math.abs(ty - canvas.height/2) < SNAP_LIMIT) { ty = canvas.height/2; showGuideY = true; }
      s.x = tx; s.y = ty;
    } else if (isRotating) { s.angle = startLayerAngle + (Math.atan2(mx - s.x, my - s.y) - startMouseAngle);
    } else if (isResizing) {
      const loc = { x: (mx-s.x)*Math.cos(-s.angle)-(my-s.y)*Math.sin(-s.angle), y: (mx-s.x)*Math.sin(-s.angle)+(my-s.y)*Math.cos(-s.angle) };
      const m = getLayerMetrics(s);
      if (resizeMode === "width" || resizeMode === "both") s.scaleX = Math.max(0.1, (Math.abs(loc.x)*2)/m.width);
      if (resizeMode === "height" || resizeMode === "both") s.scaleY = Math.max(0.1, (Math.abs(loc.y)*2)/m.height);
    }
    drawSticker();
  }

  canvas.addEventListener("mousedown", (e) => handleDown(e.offsetX, e.offsetY));
  window.addEventListener("mousemove", (e) => { if(isDragging||isRotating||isResizing){ const r=canvas.getBoundingClientRect(); handleMove(e.clientX-r.left, e.clientY-r.top); } });
  window.addEventListener("mouseup", () => { isDragging = isRotating = isResizing = false; showGuideX = showGuideY = false; drawSticker(); });

  imageInput.addEventListener("change", (e) => { const r = new FileReader(); r.onload = (f) => { const i = new Image(); i.onload = () => { saveHistory(); layers.push({type:'image', img:i, originalImg:i, x:250, y:250, angle:0, scaleX:0.5, scaleY:0.5, opacity:1}); selectedIndex=layers.length-1; drawSticker(); }; i.src = f.target.result; }; r.readAsDataURL(e.target.files[0]); });
  addBtn.addEventListener("click", () => { saveHistory(); layers.push({type:'text', text:textInput.value, color:textColorInput.value, strokeColor:strokeColorInput.value, strokeWidth:parseInt(strokeWidthInput.value), fontSize:60, fontFamily:fontSelect.value, x:250, y:250, angle:0, scaleX:1, scaleY:1, opacity:1}); selectedIndex = layers.length-1; drawSticker(); });
  deleteBtn.addEventListener("click", () => { if(selectedIndex !== -1) { saveHistory(); layers.splice(selectedIndex,1); selectedIndex=-1; drawSticker(); } });
  frontBtn.addEventListener("click", () => { if(selectedIndex !== -1) { saveHistory(); const t = layers.splice(selectedIndex, 1)[0]; layers.push(t); selectedIndex = layers.length-1; drawSticker(); } });
  backBtn.addEventListener("click", () => { if(selectedIndex !== -1) { saveHistory(); const t = layers.splice(selectedIndex, 1)[0]; layers.unshift(t); selectedIndex = 0; drawSticker(); } });
  saveBtn.addEventListener("click", () => { isExporting = true; const prev = selectedIndex; selectedIndex = -1; drawSticker(); const a = document.createElement("a"); a.href = canvas.toDataURL(); a.download = "sticker.png"; a.click(); isExporting = false; selectedIndex = prev; drawSticker(); });

  [textInput, textColorInput, strokeColorInput, strokeWidthInput, fontSelect, opacityInput, bgColorInput].forEach(el => el.addEventListener("change", () => { 
    saveHistory(); // 値が確定したタイミングで保存
    if(selectedIndex!==-1 && layers[selectedIndex].type==='text'){
      const l=layers[selectedIndex]; l.text=textInput.value; l.color=textColorInput.value; l.strokeColor=strokeColorInput.value; l.strokeWidth=parseInt(strokeWidthInput.value); l.fontFamily=fontSelect.value;
    }
    if(selectedIndex!==-1) layers[selectedIndex].opacity = opacityInput.value;
    drawSticker();
  }));

  addBtn.click();
});