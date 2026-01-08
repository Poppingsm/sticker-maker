document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // DOM要素の取得
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

  // 状態管理
  let textLayers = [];
  let selectedIndex = -1;
  let activeHandle = null;
  let isDragging = false;
  
  let dragStart = { x: 0, y: 0 };
  let initialProps = {}; 

  // ===========================================================
  // ★チューニング設定（ここをいじると操作感が変わります）
  // ===========================================================
  const VISUAL_HANDLE_SIZE = 8;    // 【見た目】ハンドルの半径
  const HIT_HANDLE_RADIUS = 30;    // 【判定】ハンドルのクリック判定半径（見た目よりかなり大きく設定）
  const BOX_PADDING = 20;          // 【余白】文字と選択枠の間の余白（広いほうがつかみやすい）
  const ROTATE_HANDLE_OFFSET = 50; // 回転ハンドルの距離
  const COLOR_PRIMARY = "#00a8ff"; // 選択枠の色
  // ===========================================================

  // -----------------------------------------------------------
  // 描画関連
  // -----------------------------------------------------------

  function getTextMetrics(layer) {
    ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
    const metrics = ctx.measureText(layer.text);
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    
    return {
      width: metrics.width,
      height: actualHeight || layer.fontSize, 
      ascent: metrics.actualBoundingBoxAscent
    };
  }

  function drawSticker() {
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    textLayers.forEach((layer, index) => {
      ctx.save();
      
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.angle);
      ctx.scale(layer.scale, layer.scale);

      const metrics = getTextMetrics(layer);
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth / layer.scale;
        ctx.lineJoin = "round";
        ctx.strokeText(layer.text, 0, 0);
      }

      ctx.fillStyle = layer.color;
      ctx.save();
      ctx.scale(layer.stretchX, 1); 
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();

      if (index === selectedIndex) {
        drawSelectionUI(metrics.width * layer.stretchX, metrics.height);
      }

      ctx.restore();
    });
  }

  function drawSelectionUI(w, h) {
    // 判定用にパディングを使用
    const pad = BOX_PADDING;
    const halfW = w / 2;
    const halfH = h / 2;

    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.lineWidth = 1.5 / textLayers[selectedIndex].scale;
    ctx.setLineDash([5, 3]);

    // 枠線
    ctx.strokeRect(-halfW - pad, -halfH - pad, w + pad * 2, h + pad * 2);
    ctx.setLineDash([]);

    const drawHandle = (x, y, type) => {
      ctx.fillStyle = (type === 'rotate') ? "#fff" : COLOR_PRIMARY;
      ctx.strokeStyle = COLOR_PRIMARY;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 見た目は VISUAL_HANDLE_SIZE を使用
      const size = VISUAL_HANDLE_SIZE / textLayers[selectedIndex].scale;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // ハンドル位置
    drawHandle(-halfW - pad, -halfH - pad, 'tl'); // 左上
    drawHandle(halfW + pad, -halfH - pad, 'tr');  // 右上
    drawHandle(halfW + pad, halfH + pad, 'br');   // 右下
    drawHandle(-halfW - pad, halfH + pad, 'bl');  // 左下

    drawHandle(-halfW - pad, 0, 'ml'); // 左
    drawHandle(halfW + pad, 0, 'mr');  // 右

    ctx.beginPath();
    ctx.moveTo(0, -halfH - pad);
    ctx.lineTo(0, -halfH - pad - ROTATE_HANDLE_OFFSET / textLayers[selectedIndex].scale);
    ctx.stroke();
    drawHandle(0, -halfH - pad - ROTATE_HANDLE_OFFSET / textLayers[selectedIndex].scale, 'rotate');
  }

  // -----------------------------------------------------------
  // 座標計算・当たり判定（強化版）
  // -----------------------------------------------------------

  function getLocalCoords(mx, my, layer) {
    const dx = mx - layer.x;
    const dy = my - layer.y;
    return {
      x: dx * Math.cos(-layer.angle) - dy * Math.sin(-layer.angle),
      y: dx * Math.sin(-layer.angle) + dy * Math.cos(-layer.angle)
    };
  }

  // ★変更点：判定用の半径（HIT_HANDLE_RADIUS）を使用
  function isHitHandle(loc, hx, hy, scale) {
    // スケールで割ることで、縮小表示時でも画面上のクリック範囲を維持
    const hitSize = HIT_HANDLE_RADIUS / scale; 
    return Math.hypot(loc.x - hx, loc.y - hy) < hitSize;
  }

  function getHitAction(mx, my, layer) {
    const loc = getLocalCoords(mx, my, layer);
    const m = getTextMetrics(layer);
    const w = m.width * layer.stretchX;
    const h = m.height;
    
    // ★変更点：パディングを定数化
    const pad = BOX_PADDING;
    const halfW = w / 2 + pad;
    const halfH = h / 2 + pad;
    const scale = layer.scale;

    // 回転
    const rOffset = ROTATE_HANDLE_OFFSET / scale;
    if (isHitHandle(loc, 0, -halfH - rOffset, scale)) return 'rotate';

    // 四隅
    if (isHitHandle(loc, -halfW, -halfH, scale)) return 'tl';
    if (isHitHandle(loc, halfW, -halfH, scale)) return 'tr';
    if (isHitHandle(loc, halfW, halfH, scale)) return 'br';
    if (isHitHandle(loc, -halfW, halfH, scale)) return 'bl';

    // 左右
    if (isHitHandle(loc, -halfW, 0, scale)) return 'w-resize';
    if (isHitHandle(loc, halfW, 0, scale)) return 'w-resize';

    // 本体（ドラッグ移動）
    // 枠内であればどこでもつかめる
    if (loc.x >= -halfW && loc.x <= halfW && loc.y >= -halfH && loc.y <= halfH) {
      return 'move';
    }

    return null;
  }

  // -----------------------------------------------------------
  // イベントリスナー
  // -----------------------------------------------------------

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (selectedIndex !== -1) {
      const layer = textLayers[selectedIndex];
      const action = getHitAction(mx, my, layer);
      if (action) {
        activeHandle = action;
        isDragging = true;
        dragStart = { x: mx, y: my };
        initialProps = { 
          x: layer.x, y: layer.y, angle: layer.angle, 
          scale: layer.scale, stretchX: layer.stretchX 
        };
        return;
      }
    }

    let foundIndex = -1;
    for (let i = textLayers.length - 1; i >= 0; i--) {
      if (getHitAction(mx, my, textLayers[i]) === 'move') {
        foundIndex = i;
        break;
      }
    }

    selectedIndex = foundIndex;
    if (selectedIndex !== -1) {
      activeHandle = 'move';
      isDragging = true;
      dragStart = { x: mx, y: my };
      const layer = textLayers[selectedIndex];
      initialProps = { x: layer.x, y: layer.y, angle: layer.angle, scale: layer.scale, stretchX: layer.stretchX };
      syncForm(layer);
    }
    drawSticker();
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (!isDragging && selectedIndex !== -1) {
      const action = getHitAction(mx, my, textLayers[selectedIndex]);
      canvas.style.cursor = getCursorStyle(action);
    }

    if (!isDragging || selectedIndex === -1) return;

    const layer = textLayers[selectedIndex];
    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;

    if (activeHandle === 'move') {
      layer.x = initialProps.x + dx;
      layer.y = initialProps.y + dy;
    } 
    else if (activeHandle === 'rotate') {
      const angle = Math.atan2(my - layer.y, mx - layer.x);
      let newAngle = angle + Math.PI / 2;
      if (e.shiftKey) {
        const snap = Math.PI / 12;
        newAngle = Math.round(newAngle / snap) * snap;
      }
      layer.angle = newAngle;
    } 
    else if (['tl', 'tr', 'bl', 'br'].includes(activeHandle)) {
      const currentDist = Math.hypot(mx - layer.x, my - layer.y);
      const startDist = Math.hypot(dragStart.x - layer.x, dragStart.y - layer.y);
      // 距離が近すぎると計算が荒れるのでガード
      if (startDist > 0) {
        layer.scale = Math.max(0.1, initialProps.scale * (currentDist / startDist));
      }
    }
    else if (activeHandle === 'w-resize') {
       const localMouse = getLocalCoords(mx, my, layer);
       const m = getTextMetrics(layer);
       // 元の幅の半分
       const baseHalfW = m.width / 2; 
       
       if (baseHalfW > 0) {
           // マウス位置の絶対値 / 元の幅の半分 = 倍率
           // パディング分(BOX_PADDING)を引いて計算することで、ハンドルの内側への追従性を高める
           const mouseX = Math.abs(localMouse.x);
           const newStretch = Math.max(0.1, mouseX / baseHalfW);
           layer.stretchX = newStretch;
       }
    }

    drawSticker();
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    activeHandle = null;
  });

  // -----------------------------------------------------------
  // ユーティリティ
  // -----------------------------------------------------------

  function getCursorStyle(action) {
    if (!action) return "default";
    if (action === 'move') return "move";
    if (action === 'rotate') return "grab";
    if (['tl', 'br'].includes(action)) return "nwse-resize";
    if (['tr', 'bl'].includes(action)) return "nesw-resize";
    if (action === 'w-resize') return "ew-resize";
    return "default";
  }

  function syncForm(l) {
    textInput.value = l.text; textColorInput.value = l.color;
    strokeColorInput.value = l.strokeColor; strokeWidthInput.value = l.strokeWidth;
    fontSizeInput.value = l.fontSize; fontSelect.value = l.fontFamily;
  }

  addBtn.addEventListener("click", () => {
    textLayers.push({
      text: textInput.value || "TEXT",
      color: textColorInput.value,
      strokeColor: strokeColorInput.value,
      strokeWidth: parseInt(strokeWidthInput.value),
      fontSize: parseInt(fontSizeInput.value),
      fontFamily: fontSelect.value,
      x: canvas.width / 2,
      y: canvas.height / 2,
      angle: 0,
      scale: 1,
      stretchX: 1
    });
    selectedIndex = textLayers.length - 1;
    drawSticker();
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
  
  deleteBtn.addEventListener("click", () => {
    if (selectedIndex !== -1) {
      textLayers.splice(selectedIndex, 1);
      selectedIndex = -1;
      drawSticker();
    }
  });

  saveBtn.addEventListener("click", () => {
    const savedIndex = selectedIndex;
    selectedIndex = -1;
    drawSticker();
    const link = document.createElement("a");
    link.download = "sticker.png";
    link.href = canvas.toDataURL();
    link.click();
    selectedIndex = savedIndex;
    drawSticker();
  });

  // 初期化
  addBtn.click();
});
