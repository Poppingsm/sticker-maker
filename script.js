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
  let activeHandle = null; // 操作中のハンドル ('tl', 'tr', 'rotate' など)
  let isDragging = false;
  
  // ドラッグ開始時のオフセットや初期値を保存
  let dragStart = { x: 0, y: 0 };
  let initialProps = {}; 

  // 定数：デザイン調整
  const HANDLE_SIZE = 10;     // ハンドルの大きさ
  const ROTATE_HANDLE_OFFSET = 40; // 回転ハンドルの距離
  const COLOR_PRIMARY = "#00a8ff"; // 選択枠の色

  // -----------------------------------------------------------
  // 描画関連
  // -----------------------------------------------------------

  function getTextMetrics(layer) {
    ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
    const metrics = ctx.measureText(layer.text);
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    
    return {
      width: metrics.width,
      // 高さが極端に小さい場合の最低値を保証
      height: actualHeight || layer.fontSize, 
      ascent: metrics.actualBoundingBoxAscent
    };
  }

  function drawSticker() {
    // 1. 背景クリア
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    textLayers.forEach((layer, index) => {
      ctx.save();
      
      // 座標変換：原点をオブジェクトの中心へ
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.angle);
      ctx.scale(layer.scale, layer.scale); // 全体スケール

      const metrics = getTextMetrics(layer);
      
      // テキスト描画（中心基準）
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 縁取り
      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth / layer.scale; // スケールに依存しない太さ
        ctx.lineJoin = "round";
        ctx.strokeText(layer.text, 0, 0);
      }

      // 塗りつぶし
      ctx.fillStyle = layer.color;
      // 横幅ストレッチ(scaleX)だけ個別に適用して描画
      ctx.save();
      ctx.scale(layer.stretchX, 1); 
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();

      // 選択状態のUI描画
      if (index === selectedIndex) {
        drawSelectionUI(metrics.width * layer.stretchX, metrics.height);
      }

      ctx.restore();
    });
  }

  // 選択枠とハンドルの描画
  function drawSelectionUI(w, h) {
    const halfW = w / 2;
    const halfH = h / 2;
    const pad = 10; // 余白

    ctx.strokeStyle = COLOR_PRIMARY;
    ctx.lineWidth = 1.5 / textLayers[selectedIndex].scale; // 線の太さを一定に保つ
    ctx.setLineDash([5, 3]);

    // 枠線
    ctx.strokeRect(-halfW - pad, -halfH - pad, w + pad * 2, h + pad * 2);
    ctx.setLineDash([]);

    // ハンドル描画関数
    const drawHandle = (x, y, type) => {
      ctx.fillStyle = (type === 'rotate') ? "#fff" : COLOR_PRIMARY;
      ctx.strokeStyle = COLOR_PRIMARY;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // スケールに依存しない一定の大きさで描画
      const size = HANDLE_SIZE / textLayers[selectedIndex].scale;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // 四隅のハンドル（等倍リサイズ）
    drawHandle(-halfW - pad, -halfH - pad, 'tl'); // 左上
    drawHandle(halfW + pad, -halfH - pad, 'tr');  // 右上
    drawHandle(halfW + pad, halfH + pad, 'br');   // 右下
    drawHandle(-halfW - pad, halfH + pad, 'bl');  // 左下

    // 左右のハンドル（幅ストレッチ）
    drawHandle(-halfW - pad, 0, 'ml'); // 左
    drawHandle(halfW + pad, 0, 'mr');  // 右

    // 回転ハンドル（上に飛び出す）
    ctx.beginPath();
    ctx.moveTo(0, -halfH - pad);
    ctx.lineTo(0, -halfH - pad - ROTATE_HANDLE_OFFSET / textLayers[selectedIndex].scale);
    ctx.stroke();
    drawHandle(0, -halfH - pad - ROTATE_HANDLE_OFFSET / textLayers[selectedIndex].scale, 'rotate');
  }

  // -----------------------------------------------------------
  // 座標計算・当たり判定
  // -----------------------------------------------------------

  // マウス座標をレイヤーのローカル座標系に変換
  function getLocalCoords(mx, my, layer) {
    const dx = mx - layer.x;
    const dy = my - layer.y;
    // 逆回転行列
    return {
      x: dx * Math.cos(-layer.angle) - dy * Math.sin(-layer.angle),
      y: dx * Math.sin(-layer.angle) + dy * Math.cos(-layer.angle)
    };
  }

  // 特定のポイント(hx, hy)にマウス(loc)があるか判定
  function isHitHandle(loc, hx, hy, scale) {
    const size = (HANDLE_SIZE + 5) / scale; // 当たり判定は少し広めに
    return Math.abs(loc.x - hx) < size && Math.abs(loc.y - hy) < size;
  }

  // どの部分をクリックしたか判定
  function getHitAction(mx, my, layer) {
    const loc = getLocalCoords(mx, my, layer);
    const m = getTextMetrics(layer);
    const w = m.width * layer.stretchX;
    const h = m.height;
    const pad = 10;
    const halfW = w / 2 + pad;
    const halfH = h / 2 + pad;
    const scale = layer.scale;

    // 回転
    const rOffset = ROTATE_HANDLE_OFFSET / scale;
    if (isHitHandle(loc, 0, -halfH - rOffset, scale)) return 'rotate';

    // 四隅（等倍スケール）
    if (isHitHandle(loc, -halfW, -halfH, scale)) return 'tl';
    if (isHitHandle(loc, halfW, -halfH, scale)) return 'tr';
    if (isHitHandle(loc, halfW, halfH, scale)) return 'br';
    if (isHitHandle(loc, -halfW, halfH, scale)) return 'bl';

    // 左右（ストレッチ）
    if (isHitHandle(loc, -halfW, 0, scale)) return 'w-resize';
    if (isHitHandle(loc, halfW, 0, scale)) return 'w-resize';

    // 本体（ドラッグ移動）
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

    // 既に選択中の場合、ハンドルのクリック判定を優先
    if (selectedIndex !== -1) {
      const layer = textLayers[selectedIndex];
      const action = getHitAction(mx, my, layer);
      if (action) {
        activeHandle = action;
        isDragging = true;
        dragStart = { x: mx, y: my };
        // ドラッグ開始時点のプロパティを保持（計算の基準にするため）
        initialProps = { 
          x: layer.x, y: layer.y, angle: layer.angle, 
          scale: layer.scale, stretchX: layer.stretchX 
        };
        return;
      }
    }

    // 他のオブジェクトのクリック判定
    let foundIndex = -1;
    // 上のレイヤーから順に判定
    for (let i = textLayers.length - 1; i >= 0; i--) {
      if (getHitAction(mx, my, textLayers[i]) === 'move') {
        foundIndex = i;
        break;
      }
    }

    selectedIndex = foundIndex;
    if (selectedIndex !== -1) {
      // 新しく選択されたオブジェクトをドラッグ開始
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

    // カーソル更新（ドラッグ中でない時）
    if (!isDragging && selectedIndex !== -1) {
      const action = getHitAction(mx, my, textLayers[selectedIndex]);
      canvas.style.cursor = getCursorStyle(action, textLayers[selectedIndex].angle);
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
      // 中心からマウスへの角度を計算
      const angle = Math.atan2(my - layer.y, mx - layer.x);
      // ラジアンを90度オフセット（ハンドルが上にあるため）
      let newAngle = angle + Math.PI / 2;
      // Shiftキーが押されていれば15度刻みでスナップ（オプション）
      if (e.shiftKey) {
        const snap = Math.PI / 12;
        newAngle = Math.round(newAngle / snap) * snap;
      }
      layer.angle = newAngle;
    } 
    else if (['tl', 'tr', 'bl', 'br'].includes(activeHandle)) {
      // --- 等倍拡大縮小 ---
      // マウスと中心の距離の変化をスケールに適用
      const currentDist = Math.hypot(mx - layer.x, my - layer.y);
      const startDist = Math.hypot(dragStart.x - layer.x, dragStart.y - layer.y);
      // 拡大縮小率
      const ratio = currentDist / startDist;
      
      // 反転動作の考慮（中心を超えた場合）は今回はシンプル化のため省略し、
      // 距離ベースで直感的なスケーリングを行う
      layer.scale = initialProps.scale * ratio;
    }
    else if (activeHandle === 'w-resize') {
       // --- 横幅ストレッチ ---
       // ローカル座標系でのX移動量を計算
       const cos = Math.cos(layer.angle);
       const sin = Math.sin(layer.angle);
       // マウスの移動量をローカルX軸に投影
       const localDx = dx * cos + dy * sin;
       
       // 中心から左右に広がる挙動
       // 初期サイズに対する比率を加算
       const m = getTextMetrics(layer);
       const baseWidth = m.width * initialProps.scale; // 元の描画幅
       
       // 右ハンドルならプラス、左ハンドルならマイナスの動きで拡大
       // 簡易的に：マウスの現在位置のローカルX座標を使って計算
       const localMouse = getLocalCoords(mx, my, layer);
       const initialLocalW = (getTextMetrics(layer).width * initialProps.stretchX) / 2;
       
       // 中心からの距離に応じてストレッチ率を変更
       const newStretch = Math.abs(localMouse.x) / (getTextMetrics(layer).width / 2);
       layer.stretchX = Math.max(0.1, newStretch); // 最小幅制限
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

  function getCursorStyle(action, angle) {
    if (!action) return "default";
    if (action === 'move') return "move";
    if (action === 'rotate') return "grab";
    // 回転に合わせてカーソルの向きを変えるのは複雑なので簡易的に
    return "pointer"; 
  }

  function syncForm(l) {
    textInput.value = l.text; textColorInput.value = l.color;
    strokeColorInput.value = l.strokeColor; strokeWidthInput.value = l.strokeWidth;
    fontSizeInput.value = l.fontSize; fontSelect.value = l.fontFamily;
  }

  // 追加・削除・保存などのボタンイベント
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
      scale: 1,      // 全体の大きさ（等倍）
      stretchX: 1    // 横方向の引き伸ばし倍率
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
    // 選択枠を消して保存するため一時的に選択解除
    const savedIndex = selectedIndex;
    selectedIndex = -1;
    drawSticker();
    const link = document.createElement("a");
    link.download = "sticker.png";
    link.href = canvas.toDataURL();
    link.click();
    // 復元
    selectedIndex = savedIndex;
    drawSticker();
  });

  // 初期化
  addBtn.click();
});
