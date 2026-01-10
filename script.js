document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // DOM要素（既存）
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

  // --- 追加DOM要素 ---
  // HTMLに以下のIDを持つ要素があることを前提としています
  const imageInput = document.getElementById("imageInput"); // <input type="file">
  const opacityInput = document.getElementById("opacity");   // <input type="range" min="0" max="1" step="0.1">
  const removeBgBtn = document.getElementById("removeBg");   // <button>背景透過</button>

  // 状態管理
  let layers = []; // textLayersから名称変更（画像も含むため）
  let selectedIndex = -1;
  let activeHandle = null;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let initialProps = {}; 

  const VISUAL_HANDLE_SIZE = 8;
  const HIT_HANDLE_RADIUS = 25;
  const BOX_PADDING = 15;
  const ROTATE_HANDLE_OFFSET = 40;
  const COLOR_PRIMARY = "#00a8ff";

  // -----------------------------------------------------------
  // 共通計算ロジック
  // -----------------------------------------------------------

  function getLayerGeometry(layer) {
    if (layer.type === 'image') {
      // 画像の場合のサイズ計算
      const w = layer.img.width * layer.stretchX;
      const h = layer.img.height * layer.stretchY;
      return { w, h, halfW: w / 2, halfH: h / 2 };
    } else {
      // テキストの場合のサイズ計算
      ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
      const metrics = ctx.measureText(layer.text);
      const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const rawH = actualHeight || layer.fontSize;
      const w = metrics.width * layer.stretchX;
      const h = rawH * layer.stretchY;
      return { w, h, halfW: w / 2, halfH: h / 2 };
    }
  }

  // -----------------------------------------------------------
  // 描画
  // -----------------------------------------------------------

  function drawSticker() {
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    layers.forEach((layer, index) => {
      ctx.save();
      
      // 移動・回転・全体スケール
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.angle);
      ctx.scale(layer.scale, layer.scale);
      
      // 透明度の適用
      ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;

      const geo = getLayerGeometry(layer);

      if (layer.type === 'image') {
        // 画像描画
        ctx.drawImage(layer.img, -geo.halfW, -geo.halfH, geo.w, geo.h);
      } else {
        // テキスト描画
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.strokeColor;
          ctx.lineWidth = layer.strokeWidth / layer.scale;
          ctx.lineJoin = "round";
          ctx.save();
          ctx.scale(layer.stretchX, layer.stretchY);
          ctx.strokeText(layer.text, 0, 0);
          ctx.restore();
        }

        ctx.fillStyle = layer.color;
        ctx.save();
        ctx.scale(layer.stretchX, layer.stretchY);
        ctx.fillText(layer.text, 0, 0);
        ctx.restore();
      }

      // 選択UI
      if (index === selectedIndex) {
        drawSelectionUI(geo, layer.scale);
      }

      ctx.restore();
    });
  }

  function drawSelectionUI(geo, scale) {
    const pad = BOX_PADDING;
    const hw = geo.halfW;
    const hh = geo.halfH;

    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(-hw - pad, -hh - pad, (hw + pad) * 2, (hh + pad) * 2);
    ctx.setLineDash([]);

    const drawHandle = (x, y, type) => {
      ctx.fillStyle = (type === 'rotate') ? "#fff" : COLOR_PRIMARY;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      const r = VISUAL_HANDLE_SIZE / scale;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    drawHandle(-hw - pad, -hh - pad, 'tl');
    drawHandle(hw + pad, -hh - pad, 'tr');
    drawHandle(hw + pad, hh + pad, 'br');
    drawHandle(-hw - pad, hh + pad, 'bl');
    drawHandle(-hw - pad, 0, 'w-resize');
    drawHandle(hw + pad, 0, 'w-resize');
    drawHandle(0, -hh - pad, 'h-resize');
    drawHandle(0, hh + pad, 'h-resize');

    const rDist = ROTATE_HANDLE_OFFSET / scale;
    ctx.beginPath();
    ctx.moveTo(0, -hh - pad);
    ctx.lineTo(0, -hh - pad - rDist);
    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.stroke();
    drawHandle(0, -hh - pad - rDist, 'rotate');
  }

  // -----------------------------------------------------------
  // 当たり判定・座標計算（変更なし）
  // -----------------------------------------------------------

  function getLocalCoords(mx, my, layer) {
    const dx = mx - layer.x;
    const dy = my - layer.y;
    return {
      x: dx * Math.cos(-layer.angle) - dy * Math.sin(-layer.angle),
      y: dx * Math.sin(-layer.angle) + dy * Math.cos(-layer.angle)
    };
  }

  function checkHit(locX, locY, targetX, targetY, scale) {
    const dist = Math.hypot(locX - targetX, locY - targetY);
    const threshold = HIT_HANDLE_RADIUS / scale; 
    return dist < threshold;
  }

  function getHitAction(mx, my, layer) {
    const loc = getLocalCoords(mx, my, layer);
    const geo = getLayerGeometry(layer);
    const pad = BOX_PADDING;
    const hw = geo.halfW + pad;
    const hh = geo.halfH + pad;
    const s = layer.scale;

    const rDist = ROTATE_HANDLE_OFFSET / s;
    if (checkHit(loc.x, loc.y, 0, -hh - rDist, s)) return 'rotate';
    if (checkHit(loc.x, loc.y, -hw, -hh, s)) return 'tl';
    if (checkHit(loc.x, loc.y, hw, -hh, s)) return 'tr';
    if (checkHit(loc.x, loc.y, hw, hh, s)) return 'br';
    if (checkHit(loc.x, loc.y, -hw, hh, s)) return 'bl';
    if (checkHit(loc.x, loc.y, -hw, 0, s)) return 'w-resize';
    if (checkHit(loc.x, loc.y, hw, 0, s)) return 'w-resize';
    if (checkHit(loc.x, loc.y, 0, -hh, s)) return 'h-resize';
    if (checkHit(loc.x, loc.y, 0, hh, s)) return 'h-resize';

    if (loc.x >= -hw && loc.x <= hw && loc.y >= -hh && loc.y <= hh) return 'move';
    return null;
  }

  // -----------------------------------------------------------
  // イベントリスナー
  // -----------------------------------------------------------

  // 画像の読み込み
  if (imageInput) {
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          layers.push({
            type: 'image',
            img: img,
            originalImg: img, // 背景透過処理用
            x: canvas.width / 2,
            y: canvas.height / 2,
            angle: 0,
            scale: 0.5,
            stretchX: 1,
            stretchY: 1,
            opacity: 1.0
          });
          selectedIndex = layers.length - 1;
          drawSticker();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 背景透過（白を透明に）
  if (removeBgBtn) {
    removeBgBtn.addEventListener("click", () => {
      if (selectedIndex === -1 || layers[selectedIndex].type !== 'image') return;
      
      const layer = layers[selectedIndex];
      const img = layer.originalImg;
      
      const offCanvas = document.createElement("canvas");
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext("2d");
      offCtx.drawImage(img, 0, 0);
      
      const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // RGBがすべて240以上なら白と判定してアルファを0にする
        if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
          data[i+3] = 0;
        }
      }
      
      offCtx.putImageData(imageData, 0, 0);
      const newImg = new Image();
      newImg.onload = () => {
        layer.img = newImg;
        drawSticker();
      };
      newImg.src = offCanvas.toDataURL();
    });
  }

  // 不透明度変更
  if (opacityInput) {
    opacityInput.addEventListener("input", () => {
      if (selectedIndex !== -1) {
        layers[selectedIndex].opacity = parseFloat(opacityInput.value);
        drawSticker();
      }
    });
  }

  // マウスイベント（layersを参照するように変更）
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (selectedIndex !== -1) {
      const action = getHitAction(mx, my, layers[selectedIndex]);
      if (action) { startDrag(selectedIndex, mx, my, action); return; }
    }

    let found = -1;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (getHitAction(mx, my, layers[i]) === 'move') { found = i; break; }
    }

    if (found !== -1) {
      startDrag(found, mx, my, 'move');
      syncForm(layers[found]);
    } else {
      selectedIndex = -1;
      drawSticker();
    }
  });

  function startDrag(index, mx, my, action) {
    selectedIndex = index;
    activeHandle = action;
    isDragging = true;
    dragStart = { x: mx, y: my };
    const l = layers[index];
    initialProps = { x: l.x, y: l.y, angle: l.angle, scale: l.scale, stretchX: l.stretchX, stretchY: l.stretchY };
    if (opacityInput) opacityInput.value = l.opacity || 1.0;
    drawSticker();
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (!isDragging) {
      if (selectedIndex !== -1) {
        canvas.style.cursor = getCursorStyle(getHitAction(mx, my, layers[selectedIndex]));
      } else { canvas.style.cursor = "default"; }
      return;
    }

    const layer = layers[selectedIndex];
    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;

    switch (activeHandle) {
      case 'move':
        layer.x = initialProps.x + dx;
        layer.y = initialProps.y + dy;
        break;
      case 'rotate':
        layer.angle = Math.atan2(my - layer.y, mx - layer.x) + Math.PI / 2;
        break;
      case 'tl': case 'tr': case 'bl': case 'br':
        const curDist = Math.hypot(mx - layer.x, my - layer.y);
        const startDist = Math.hypot(dragStart.x - layer.x, dragStart.y - layer.y);
        if (startDist > 0) layer.scale = Math.max(0.1, initialProps.scale * (curDist / startDist));
        break;
      case 'w-resize':
        const locX = getLocalCoords(mx, my, layer).x;
        const geoW = getLayerGeometry(layer);
        const baseW = (layer.type === 'image') ? layer.img.width : ctx.measureText(layer.text).width;
        if (baseW > 0) layer.stretchX = Math.max(0.1, Math.abs(locX) / (baseW / 2));
        break;
      case 'h-resize':
        const locY = getLocalCoords(mx, my, layer).y;
        const baseH = (layer.type === 'image') ? layer.img.height : (layer.fontSize || 20);
        if (baseH > 0) layer.stretchY = Math.max(0.1, Math.abs(locY) / (baseH / 2));
        break;
    }
    drawSticker();
  });

  canvas.addEventListener("mouseup", () => { isDragging = false; activeHandle = null; });

  // -----------------------------------------------------------
  // ユーティリティ
  // -----------------------------------------------------------
  function getCursorStyle(action) {
    if (!action) return "default";
    const styles = { move: "move", rotate: "grab", "w-resize": "ew-resize", "h-resize": "ns-resize" };
    return styles[action] || "pointer";
  }

  function syncForm(l) {
    if (l.type !== 'image') {
      textInput.value = l.text;
      fontSizeInput.value = l.fontSize;
      // ... 他のテキスト用入力同期
    }
  }

  addBtn.addEventListener("click", () => {
    layers.push({
      type: 'text',
      text: textInput.value || "TEXT",
      color: textColorInput.value,
      strokeColor: strokeColorInput.value,
      strokeWidth: parseInt(strokeWidthInput.value),
      fontSize: parseInt(fontSizeInput.value),
      fontFamily: fontSelect.value,
      x: canvas.width / 2, y: canvas.height / 2,
      angle: 0, scale: 1, stretchX: 1, stretchY: 1, opacity: 1.0
    });
    selectedIndex = layers.length - 1;
    drawSticker();
  });

  saveBtn.addEventListener("click", () => {
    const saved = selectedIndex;
    selectedIndex = -1;
    drawSticker();
    const link = document.createElement("a");
    link.download = "sticker.png";
    link.href = canvas.toDataURL();
    link.click();
    selectedIndex = saved;
    drawSticker();
  });

  bgColorInput.addEventListener("input", drawSticker);
  deleteBtn.addEventListener("click", () => {
    if (selectedIndex !== -1) {
      layers.splice(selectedIndex, 1);
      selectedIndex = -1;
      drawSticker();
    }
  });

  addBtn.click();
});
