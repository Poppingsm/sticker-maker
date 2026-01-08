document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // 要素取得（略）
  const textInput = document.getElementById("text");
  const fontSelect = document.getElementById("font");
  const textColorInput = document.getElementById("textColor");
  const strokeColorInput = document.getElementById("strokeColor");
  const strokeWidthInput = document.getElementById("strokeWidth");
  const bgColorInput = document.getElementById("bgColor");
  const fontSizeInput = document.getElementById("fontSize");
  const addBtn = document.getElementById("addText");
  const deleteBtn = document.getElementById("deleteText");
  const saveBtn = document.getElementById("saveImage");

  let textLayers = [];
  let selectedIndex = -1;
  let isDragging = false, isRotating = false, isResizing = false;
  let resizeMode = ""; 
  let offsetX = 0, offsetY = 0;
  let startMouseAngle = 0, startLayerAngle = 0;
  let showGuideX = false, showGuideY = false, showGuideAngle = false;

  const HANDLE_RADIUS = 8;
  const OFFSET = 5;

  // ★ 文字の実寸サイズを計算するヘルパー関数
  function getTextMetrics(layer) {
    ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
    const metrics = ctx.measureText(layer.text);
    // 描画上の正確な高さを取得
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    return {
      width: metrics.width,
      height: actualHeight || layer.fontSize * 0.7, // フォントによって高さが0になる場合のフォールバック
      ascent: metrics.actualBoundingBoxAscent
    };
  }

  function drawSticker() {
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ガイド描画（略）
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
    if (showGuideX) { ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke(); }
    if (showGuideY) { ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke(); }
    ctx.restore();

    textLayers.forEach((layer, index) => {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.angle || 0);

      const metrics = getTextMetrics(layer);
      const curW = metrics.width * layer.scaleX;
      const curH = metrics.height * layer.scaleY;

      // --- 文字（スケールあり） ---
      ctx.save();
      ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle"; 

      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth / Math.max(layer.scaleX, layer.scaleY); // 縁取りもスケール影響を補正
        ctx.lineJoin = "round";
        ctx.strokeText(layer.text, 0, 0);
      }
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();

      // --- 枠・丸（スケールなし） ---
      if (index === selectedIndex) {
        ctx.strokeStyle = showGuideAngle ? "red" : "white";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1; 
        // 矩形を文字の実寸に合わせて描画
        ctx.strokeRect(-curW/2 - OFFSET, -curH/2 - OFFSET, curW + (OFFSET*2), curH + (OFFSET*2));
        
        ctx.setLineDash([]);
        // ハンドル位置を実寸サイズ（curW, curH）に基づいて固定
        drawHandle(0, -curH/2 - 35, "#4CAF50");       // 回転
        drawHandle(curW/2 + OFFSET, 0, "white");      // 横幅（右）
        drawHandle(0, curH/2 + OFFSET, "white");      // 縦幅（下）
        drawHandle(curW/2 + OFFSET, curH/2 + OFFSET, "white"); // 角
      }
      ctx.restore();
    });
  }

  function drawHandle(x, y, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function getLocalCoords(mx, my, layer) {
    const dx = mx - layer.x, dy = my - layer.y;
    const cos = Math.cos(-layer.angle), sin = Math.sin(-layer.angle);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  function checkHandle(loc, hX, hY) {
    return Math.hypot(loc.x - hX, loc.y - hY) <= HANDLE_RADIUS + 2;
  }

  function updateCursor(mx, my) {
    if (selectedIndex === -1) { canvas.style.cursor = "default"; return; }
    const s = textLayers[selectedIndex];
    const loc = getLocalCoords(mx, my, s);
    const m = getTextMetrics(s);
    const w = m.width * s.scaleX, h = m.height * s.scaleY;

    if (checkHandle(loc, 0, -h/2 - 35)) canvas.style.cursor = "pointer";
    else if (checkHandle(loc, w/2 + OFFSET, 0)) canvas.style.cursor = "ew-resize";
    else if (checkHandle(loc, 0, h/2 + OFFSET)) canvas.style.cursor = "ns-resize";
    else if (checkHandle(loc, w/2 + OFFSET, h/2 + OFFSET)) canvas.style.cursor = "nwse-resize";
    else if (Math.abs(loc.x) < w/2 && Math.abs(loc.y) < h/2) canvas.style.cursor = "move";
    else canvas.style.cursor = "default";
  }

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (selectedIndex !== -1) {
      const s = textLayers[selectedIndex];
      const loc = getLocalCoords(mx, my, s);
      const m = getTextMetrics(s);
      const w = m.width * s.scaleX, h = m.height * s.scaleY;

      if (checkHandle(loc, 0, -h/2 - 35)) {
        isRotating = true; startMouseAngle = Math.atan2(mx - s.x, my - s.y); startLayerAngle = s.angle; return;
      }
      if (checkHandle(loc, w/2 + OFFSET, 0)) { isResizing = true; resizeMode = "width"; return; }
      if (checkHandle(loc, 0, h/2 + OFFSET)) { isResizing = true; resizeMode = "height"; return; }
      if (checkHandle(loc, w/2 + OFFSET, h/2 + OFFSET)) { isResizing = true; resizeMode = "both"; return; }
    }

    let found = false;
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const l = textLayers[i];
      const loc = getLocalCoords(mx, my, l);
      const m = getTextMetrics(l);
      const w = m.width * l.scaleX, h = m.height * l.scaleY;
      if (Math.abs(loc.x) < w/2 + OFFSET && Math.abs(loc.y) < h/2 + OFFSET) {
        selectedIndex = i; isDragging = true; offsetX = mx - l.x; offsetY = my - l.y;
        syncForm(l);
        found = true; break;
      }
    }
    if (!found) selectedIndex = -1;
    drawSticker();
  });

  function syncForm(l) {
    textInput.value = l.text; textColorInput.value = l.color;
    strokeColorInput.value = l.strokeColor; strokeWidthInput.value = l.strokeWidth;
    fontSizeInput.value = l.fontSize; fontSelect.value = l.fontFamily;
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    showGuideX = showGuideY = showGuideAngle = false;

    if (!isDragging && !isRotating && !isResizing) updateCursor(mx, my);

    if (isResizing) {
      const s = textLayers[selectedIndex];
      const loc = getLocalCoords(mx, my, s);
      const m = getTextMetrics(s);
      if (resizeMode === "width" || resizeMode === "both") s.scaleX = (Math.abs(loc.x) * 2) / m.width;
      if (resizeMode === "height" || resizeMode === "both") s.scaleY = (Math.abs(loc.y) * 2) / m.height;
    } else if (isRotating) {
      const s = textLayers[selectedIndex];
      let angle = startLayerAngle + (Math.atan2(mx - s.x, my - s.y) - startMouseAngle);
      if (Math.abs(angle % (Math.PI/2)) < 0.05) { angle = Math.round(angle / (Math.PI/2)) * (Math.PI/2); showGuideAngle = true; }
      s.angle = angle;
    } else if (isDragging) {
      const s = textLayers[selectedIndex];
      let tx = mx - offsetX, ty = my - offsetY;
      if (Math.abs(tx - canvas.width/2) < 10) { tx = canvas.width/2; showGuideX = true; }
      if (Math.abs(ty - canvas.height/2) < 10) { ty = canvas.height/2; showGuideY = true; }
      s.x = tx; s.y = ty;
    }
    drawSticker();
  });

  canvas.addEventListener("mouseup", () => { isDragging = isRotating = isResizing = false; drawSticker(); });

  // その他のイベント（略）
  addBtn.addEventListener("click", () => {
    textLayers.push({
      text: textInput.value || "TEXT", color: textColorInput.value,
      strokeColor: strokeColorInput.value, strokeWidth: parseInt(strokeWidthInput.value),
      fontSize: parseInt(fontSizeInput.value), fontFamily: fontSelect.value,
      x: canvas.width/2, y: canvas.height/2, angle: 0, scaleX: 1, scaleY: 1
    });
    selectedIndex = textLayers.length - 1; drawSticker();
  });

  [textInput, fontSelect, textColorInput, strokeColorInput, strokeWidthInput, fontSizeInput].forEach(el => {
    el.addEventListener("input", () => {
      if (selectedIndex !== -1) {
        const l = textLayers[selectedIndex];
        l.text = textInput.value; l.color = textColorInput.value;
        l.strokeColor = strokeColorInput.value; l.strokeWidth = parseInt(strokeWidthInput.value);
        l.fontSize = parseInt(fontSizeInput.value); l.fontFamily = fontSelect.value;
        drawSticker();
      }
    });
  });

  bgColorInput.addEventListener("input", drawSticker);
  deleteBtn.addEventListener("click", () => { if (selectedIndex !== -1) { textLayers.splice(selectedIndex, 1); selectedIndex = -1; drawSticker(); } });
  saveBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "sticker.png";
    link.href = canvas.toDataURL();
    link.click();
  });
  addBtn.click();
});