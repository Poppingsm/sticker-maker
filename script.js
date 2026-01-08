document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // DOM要素
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
  // 設定（チューニング）
  // ===========================================================
  const VISUAL_HANDLE_SIZE = 8;    // 見た目のハンドルサイズ
  const HIT_HANDLE_RADIUS = 25;    // クリック判定の半径（大きめに設定）
  const BOX_PADDING = 15;          // 枠線と文字の余白
  const ROTATE_HANDLE_OFFSET = 40; // 回転ハンドルの距離
  const COLOR_PRIMARY = "#00a8ff"; // UIカラー
  // ===========================================================

  // -----------------------------------------------------------
  // 共通計算ロジック（描画と判定のズレを防ぐ）
  // -----------------------------------------------------------

  // レイヤーの現在の表示サイズ（スケール・ストレッチ適用済みのローカルサイズ）を取得
  function getLayerGeometry(layer) {
    ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
    const metrics = ctx.measureText(layer.text);
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    // 高さがない場合のフォールバック
    const rawH = actualHeight || layer.fontSize;
    
    // stretchX, stretchY を適用したサイズ
    const w = metrics.width * layer.stretchX;
    const h = rawH * layer.stretchY;

    return {
      w: w,
      h: h,
      halfW: w / 2,
      halfH: h / 2,
      rawAscent: metrics.actualBoundingBoxAscent
    };
  }

  // -----------------------------------------------------------
  // 描画
  // -----------------------------------------------------------

  function drawSticker() {
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    textLayers.forEach((layer, index) => {
      ctx.save();
      
      // 1. 座標変換（移動・回転・全体スケール）
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.angle);
      ctx.scale(layer.scale, layer.scale);

      const geo = getLayerGeometry(layer);

      // 2. テキスト描画
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 縁取り
      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        // scaleやstretchの影響を受けないように線幅を補正
        // ここでは簡易的にscaleのみ考慮
        ctx.lineWidth = layer.strokeWidth / layer.scale;
        ctx.lineJoin = "round";
        ctx.save();
        ctx.scale(layer.stretchX, layer.stretchY); // 縦横比変形
        ctx.strokeText(layer.text, 0, 0);
        ctx.restore();
      }

      // 塗りつぶし
      ctx.fillStyle = layer.color;
      ctx.save();
      ctx.scale(layer.stretchX, layer.stretchY); // 縦横比変形
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();

      // 3. 選択UI描画（選択中のみ）
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

    // 線の太さをスケール反比例させて一定に見せる
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.setLineDash([5, 3]);

    // 枠線
    ctx.strokeRect(-hw - pad, -hh - pad, (hw + pad) * 2, (hh + pad) * 2);
    ctx.setLineDash([]);

    // ハンドル描画ヘルパー
    const drawHandle = (x, y, type) => {
      ctx.fillStyle = (type === 'rotate') ? "#fff" : COLOR_PRIMARY;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / scale;
      
      ctx.beginPath();
      // 見た目のサイズもスケール反比例で一定に
      const r = VISUAL_HANDLE_SIZE / scale;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // --- ハンドル配置 ---
    // 四隅
    drawHandle(-hw - pad, -hh - pad, 'tl'); // 左上
    drawHandle(hw + pad, -hh - pad, 'tr');  // 右上
    drawHandle(hw + pad, hh + pad, 'br');   // 右下
    drawHandle(-hw - pad, hh + pad, 'bl');  // 左下

    // 左右（幅変更）
    drawHandle(-hw - pad, 0, 'w-resize');
    drawHandle(hw + pad, 0, 'w-resize');

    // 上下（高さ変更）★追加
    drawHandle(0, -hh - pad, 'h-resize');
    drawHandle(0, hh + pad, 'h-resize');

    // 回転（上部）
    const rDist = ROTATE_HANDLE_OFFSET / scale;
    ctx.beginPath();
    ctx.moveTo(0, -hh - pad);
    ctx.lineTo(0, -hh - pad - rDist);
    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.stroke();
    drawHandle(0, -hh - pad - rDist, 'rotate');
  }

  // -----------------------------------------------------------
  // 当たり判定・座標計算
  // -----------------------------------------------------------

  // マウス座標を「レイヤーの回転をキャンセルしたローカル座標」へ変換
  function getLocalCoords(mx, my, layer) {
    const dx = mx - layer.x;
    const dy = my - layer.y;
    // 回転行列の逆変換
    return {
      x: dx * Math.cos(-layer.angle) - dy * Math.sin(-layer.angle),
      y: dx * Math.sin(-layer.angle) + dy * Math.cos(-layer.angle)
    };
  }

  // ハンドルの当たり判定
  function checkHit(locX, locY, targetX, targetY, scale) {
    // 画面上での許容ピクセル数（HIT_HANDLE_RADIUS）を
    // 現在のスケール空間での距離に換算して判定する
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

    // 1. 回転ハンドル
    const rDist = ROTATE_HANDLE_OFFSET / s;
    if (checkHit(loc.x, loc.y, 0, -hh - rDist, s)) return 'rotate';

    // 2. 四隅（等倍スケール）
    if (checkHit(loc.x, loc.y, -hw, -hh, s)) return 'tl'; // 左上
    if (checkHit(loc.x, loc.y, hw, -hh, s)) return 'tr';  // 右上
    if (checkHit(loc.x, loc.y, hw, hh, s)) return 'br';   // 右下
    if (checkHit(loc.x, loc.y, -hw, hh, s)) return 'bl';  // 左下

    // 3. 左右（横幅）
    if (checkHit(loc.x, loc.y, -hw, 0, s)) return 'w-resize';
    if (checkHit(loc.x, loc.y, hw, 0, s)) return 'w-resize';

    // 4. 上下（縦幅）★追加
    if (checkHit(loc.x, loc.y, 0, -hh, s)) return 'h-resize';
    if (checkHit(loc.x, loc.y, 0, hh, s)) return 'h-resize';

    // 5. 本体（移動）
    // 矩形内判定
    if (loc.x >= -hw && loc.x <= hw && loc.y >= -hh && loc.y <= hh) {
      return 'move';
    }

    return null;
  }

  // -----------------------------------------------------------
  // マウスイベント
  // -----------------------------------------------------------

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. 選択中のオブジェクトのハンドル操作を優先チェック
    if (selectedIndex !== -1) {
      const layer = textLayers[selectedIndex];
      const action = getHitAction(mx, my, layer);
      if (action) {
        startDrag(selectedIndex, mx, my, action);
        return;
      }
    }

    // 2. 他のオブジェクトのクリック（移動）チェック
    // 重なり順を考慮して上（配列の後ろ）からチェック
    let found = -1;
    for (let i = textLayers.length - 1; i >= 0; i--) {
      if (getHitAction(mx, my, textLayers[i]) === 'move') {
        found = i;
        break;
      }
    }

    if (found !== -1) {
      startDrag(found, mx, my, 'move');
      syncForm(textLayers[found]);
    } else {
      // 空白クリックで選択解除
      selectedIndex = -1;
      drawSticker();
    }
  });

  function startDrag(index, mx, my, action) {
    selectedIndex = index;
    activeHandle = action;
    isDragging = true;
    dragStart = { x: mx, y: my };
    
    // ドラッグ開始時の状態を保存
    const l = textLayers[index];
    initialProps = {
      x: l.x, y: l.y, angle: l.angle,
      scale: l.scale, stretchX: l.stretchX, stretchY: l.stretchY
    };
    drawSticker();
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // カーソル変更
    if (!isDragging) {
      if (selectedIndex !== -1) {
        const action = getHitAction(mx, my, textLayers[selectedIndex]);
        canvas.style.cursor = getCursorStyle(action);
      } else {
        canvas.style.cursor = "default";
      }
    }

    if (!isDragging || selectedIndex === -1) return;

    const layer = textLayers[selectedIndex];
    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;

    switch (activeHandle) {
      case 'move':
        layer.x = initialProps.x + dx;
        layer.y = initialProps.y + dy;
        break;

      case 'rotate':
        const angle = Math.atan2(my - layer.y, mx - layer.x);
        let newAngle = angle + Math.PI / 2;
        if (e.shiftKey) newAngle = Math.round(newAngle / (Math.PI/12)) * (Math.PI/12);
        layer.angle = newAngle;
        break;

      case 'tl': case 'tr': case 'bl': case 'br':
        // 等倍拡大縮小
        const curDist = Math.hypot(mx - layer.x, my - layer.y);
        const startDist = Math.hypot(dragStart.x - layer.x, dragStart.y - layer.y);
        if (startDist > 0) {
          layer.scale = Math.max(0.1, initialProps.scale * (curDist / startDist));
        }
        break;

      case 'w-resize':
        // 横幅ストレッチ（中心から左右対称）
        const locX = getLocalCoords(mx, my, layer).x;
        // 元のフォント本来の幅の半分
        ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
        const baseW = ctx.measureText(layer.text).width;
        if (baseW > 0) {
          // マウス位置までの距離 ÷ 本来の幅の半分 ＝ 倍率
          layer.stretchX = Math.max(0.1, Math.abs(locX) / (baseW / 2));
        }
        break;

      case 'h-resize':
        // 縦幅ストレッチ（中心から上下対称）★追加
        const locY = getLocalCoords(mx, my, layer).y;
        const metrics = ctx.measureText(layer.text);
        const baseH = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || layer.fontSize;
        if (baseH > 0) {
          layer.stretchY = Math.max(0.1, Math.abs(locY) / (baseH / 2));
        }
        break;
    }

    drawSticker();
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    activeHandle = null;
  });

  // -----------------------------------------------------------
  // ユーティリティ・UIイベント
  // -----------------------------------------------------------

  function getCursorStyle(action) {
    if (!action) return "default";
    if (action === 'move') return "move";
    if (action === 'rotate') return "grab";
    if (action === 'w-resize') return "ew-resize";
    if (action === 'h-resize') return "ns-resize";
    if (['tl', 'br'].includes(action)) return "nwse-resize";
    if (['tr', 'bl'].includes(action)) return "nesw-resize";
    return "default";
  }

  function syncForm(l) {
    textInput.value = l.text;
    textColorInput.value = l.color;
    strokeColorInput.value = l.strokeColor;
    strokeWidthInput.value = l.strokeWidth;
    fontSizeInput.value = l.fontSize;
    fontSelect.value = l.fontFamily;
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
      stretchX: 1,
      stretchY: 1 // ★追加
    });
    selectedIndex = textLayers.length - 1;
    drawSticker();
  });

  // 入力変更イベントの一括登録
  [textInput, fontSelect, textColorInput, strokeColorInput, strokeWidthInput, fontSizeInput].forEach(el => {
    el.addEventListener("input", () => {
      if (selectedIndex !== -1) {
        const l = textLayers[selectedIndex];
        l.text = textInput.value;
        l.color = textColorInput.value;
        l.strokeColor = strokeColorInput.value;
        l.strokeWidth = parseInt(strokeWidthInput.value);
        l.fontSize = parseInt(fontSizeInput.value);
        l.fontFamily = fontSelect.value;
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
