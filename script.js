<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ステッカーメーカー（シェア機能付き）</title>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"></script>
<style>
  body { font-family: "Helvetica Neue", Arial, sans-serif; text-align: center; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
  h1 { margin-bottom: 20px; color: #2c3e50; }
  
  /* キャンバス */
  canvas { 
    border: 2px solid #ddd; 
    background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%); 
    background-size: 20px 20px; background-position: 0 0, 10px 10px; background-color: white;
    max-width: 100%; height: auto; 
    box-shadow: 0 10px 20px rgba(0,0,0,0.1); border-radius: 8px;
    touch-action: none; 
  }

  /* コントロール */
  .controls { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; max-width: 800px; margin-left: auto; margin-right: auto; }
  .control-group { background: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 8px; min-width: 160px; flex: 1; }
  label { font-size: 13px; font-weight: bold; color: #555; display: block; margin-bottom: 4px; border-bottom: 2px solid #f0f0f0; padding-bottom: 4px;}
  
  /* ボタン類 */
  button { padding: 8px 14px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 6px; font-size: 14px; transition: 0.2s; font-weight: bold; }
  button:hover { background: #2980b9; transform: translateY(-1px); }
  button.danger { background: #e74c3c; } button.danger:hover { background: #c0392b; }
  button.success { background: #2ecc71; } button.success:hover { background: #27ae60; }
  button.warning { background: #f1c40f; color: #333; } button.warning:hover { background: #f39c12; }
  
  input[type="text"], select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; width: 100%; box-sizing: border-box; }
  input[type="range"] { width: 100%; }
  
  .draw-active { background: #e74c3c !important; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }

  /* ギャラリーモーダル */
  #galleryModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; overflow-y: auto; backdrop-filter: blur(5px); }
  .gallery-content { background: white; width: 90%; max-width: 900px; margin: 40px auto; padding: 25px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
  .gallery-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
  
  /* ギャラリーアイテムのデザイン強化 */
  .gallery-item { border: 1px solid #eee; border-radius: 10px; padding: 12px; transition: 0.3s; background: #fff; display: flex; flex-direction: column; }
  .gallery-item:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); border-color: #3498db; }
  .gallery-item img { width: 100%; height: 140px; object-fit: contain; background: #f9f9f9; border-radius: 6px; margin-bottom: 10px; border: 1px solid #eee; }
  .gallery-meta { text-align: left; margin-bottom: 10px; flex-grow: 1; }
  .gallery-name { font-weight: bold; font-size: 15px; color: #2c3e50; display: block; margin-bottom: 2px; }
  .gallery-date { font-size: 11px; color: #95a5a6; }
  .copy-btn { width: 100%; background-color: #f1c40f; color: #333; margin-top: auto; }
  .copy-btn:hover { background-color: #f39c12; }

  .close-btn { font-size: 28px; cursor: pointer; color: #888; font-weight: bold; }
  .close-btn:hover { color: #333; }
</style>
</head>
<body>

<h1>ステッカーメーカー 🎨</h1>
<canvas id="sticker" width="500" height="500"></canvas>

<div class="controls">
  <div class="control-group">
    <label>🔤 テキスト</label>
    <input type="text" id="text" placeholder="文字を入力" value="Hello!">
    <select id="fontFamily">
      <option value="Arial, sans-serif">ゴシック体</option>
      <option value="'Times New Roman', serif">明朝体</option>
      <option value="'Courier New', monospace">タイプライター</option>
      <option value="Comic Sans MS, cursive">ポップ体</option>
    </select>
    <div style="display:flex; gap:5px; align-items:center;">
      <input type="color" id="textColor" value="#000000" title="文字色">
      <input type="color" id="strokeColor" value="#ffffff" title="フチ色">
      <input type="range" id="strokeWidth" min="0" max="20" value="5" title="フチの太さ">
    </div>
    <button id="addText">＋ 文字追加</button>
  </div>

  <div class="control-group">
    <label>🖌️ 手書き・画像</label>
    <div style="display:flex; gap:5px; align-items:center;">
      <input type="color" id="drawColor" value="#ff4757">
      <input type="range" id="drawWidth" min="1" max="50" value="5">
    </div>
    <select id="brushStyle">
      <option value="pen">ペン</option>
      <option value="marker">マーカー</option>
      <option value="spray">スプレー</option>
    </select>
    <div style="display:flex; gap:5px;">
      <button id="drawModeBtn" style="flex:1;">🖊 手書き</button>
      <button id="eraserBtn" style="flex:1;">消しゴム</button>
    </div>
    <hr style="width:100%; border:0; border-top:1px solid #eee; margin:5px 0;">
    <input type="file" id="imageInput" accept="image/*" style="font-size: 11px;">
    <button id="aiRemoveBg" class="warning">🤖 背景削除(AI)</button>
  </div>

  <div class="control-group">
    <label>⚙️ 編集</label>
    <div style="display:flex; justify-content:space-between; font-size:12px;">
       <span>背景色</span> <span>透明度</span>
    </div>
    <div style="display:flex; gap:5px; align-items:center;">
        <input type="color" id="bgColor" value="#ffffff" title="背景色">
        <input type="range" id="opacity" min="0" max="1" step="0.1" value="1" title="透明度">
    </div>
    <button id="undoBtn">↩ 元に戻す</button>
    <button id="deleteBtn" class="danger">🗑 選択削除</button>
    <button id="saveImage" class="success">📷 画像保存</button>
  </div>

  <div class="control-group" style="border: 2px solid #3498db; background: #eaf6fd;">
    <label>☁️ みんなのギャラリー</label>
    <button id="saveProjectBtn" class="success">☁️ 作品を投稿</button>
    <button id="galleryBtn" class="warning">📚 みんなの作品を見る</button>
    <button id="loadProjectBtn" style="background:#7f8c8d;">📂 保存データ読込</button>
  </div>
</div>

<div id="galleryModal">
  <div class="gallery-content">
    <div class="gallery-header">
      <h2 style="margin:0;">みんなの作品ギャラリー</h2>
      <span class="close-btn" id="closeGallery">&times;</span>
    </div>
    <p style="text-align:left; color:#666; font-size:14px;">
      「コピーして編集」を押すと、その作品を自分のキャンバスに読み込みます。<br>
      ※読み込んでも、元の作者の作品が消えたり変わったりすることはありません。
    </p>
    <div id="galleryGrid" class="gallery-grid">
      </div>
  </div>
</div>

<script type="module">
 // ★★★ ここにあなたのFirebase設定を貼り付けました ★★★
  const firebaseConfig = {
    apiKey: "AIzaSyAKMmpxfan5I0GEq7STopiXMI6x7e2KOIM",
    authDomain: "sticker-app-f23ac.firebaseapp.com",
    projectId: "sticker-app-f23ac",
    storageBucket: "sticker-app-f23ac.firebasestorage.app",
    messagingSenderId: "464688164090",
    appId: "1:464688164090:web:a1ff23ccea0b9e194aad43",
    measurementId: "G-M5P6P7CXSZ"
  };

  // Firebaseの読み込み（Webブラウザで直接動くようにCDN形式にしています）
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
  import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

  // Firebase初期化
  let db;
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized");
  } catch (e) {
    console.error("Firebaseの設定エラー", e);
    alert("Firebaseの設定に失敗しました。コンソールを確認してください。");
  }

  // --- アプリの基本ロジック ---
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // UI要素
  const textInput = document.getElementById("text"), fontSelect = document.getElementById("fontFamily");
  const textColorInput = document.getElementById("textColor"), strokeColorInput = document.getElementById("strokeColor");
  const strokeWidthInput = document.getElementById("strokeWidth"), bgColorInput = document.getElementById("bgColor");
  const addBtn = document.getElementById("addText"), deleteBtn = document.getElementById("deleteBtn"), saveBtn = document.getElementById("saveImage");
  const imageInput = document.getElementById("imageInput"), opacityInput = document.getElementById("opacity");
  const aiRemoveBgBtn = document.getElementById("aiRemoveBg"), undoBtn = document.getElementById("undoBtn");
  const drawModeBtn = document.getElementById("drawModeBtn"), eraserBtn = document.getElementById("eraserBtn");
  const drawColorInput = document.getElementById("drawColor"), drawWidthInput = document.getElementById("drawWidth"), brushStyleSelect = document.getElementById("brushStyle");
  const saveProjectBtn = document.getElementById("saveProjectBtn"), loadProjectBtn = document.getElementById("loadProjectBtn");
  const galleryBtn = document.getElementById("galleryBtn"), galleryModal = document.getElementById("galleryModal"), closeGallery = document.getElementById("closeGallery"), galleryGrid = document.getElementById("galleryGrid");

  let layers = [];
  let history = [];
  let selectedIndex = -1;
  let isDragging = false, isResizing = false, isRotating = false, isExporting = false; 
  let resizeMode = ""; 
  let isDrawingMode = false, isEraserMode = false, isDrawing = false, currentPath = [];
  let offsetX = 0, offsetY = 0, startMouseAngle = 0, startLayerAngle = 0, showGuideX = false, showGuideY = false;

  const SNAP_LIMIT = 12, GRID_SIZE = 25, MAX_HISTORY = 20, HANDLE_R = 8;
  const drawingCanvas = document.createElement("canvas");
  drawingCanvas.width = 500; drawingCanvas.height = 500;
  const drawCtx = drawingCanvas.getContext("2d");

  // 履歴保存
  function saveHistory() {
    const state = layers.map(l => ({...l, path: l.path ? l.path.map(p => ({...p})) : null}));
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
  }

  // レイヤー計測
  function getLayerMetrics(l) {
    if (l.type === 'image') return { width: l.img.width, height: l.img.height };
    if (l.type === 'draw') {
      const xs = l.path.map(p => p.x), ys = l.path.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      return { width: maxX - minX + 40, height: maxY - minY + 40, ox: minX + (maxX-minX)/2, oy: minY + (maxY-minY)/2 };
    }
    ctx.font = `bold 60px ${l.fontFamily}`;
    return { width: ctx.measureText(l.text).width, height: 60 };
  }

  // 描画関数
  function drawPath(context, path, color, width, style) {
    context.save();
    if (style === 'eraser') {
      context.globalCompositeOperation = 'destination-out'; 
      context.strokeStyle = "rgba(0,0,0,1)";
      context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round';
      context.beginPath(); context.moveTo(path[0].x, path[0].y); path.forEach(p => context.lineTo(p.x, p.y)); context.stroke();
      context.restore(); return;
    }
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = color; context.lineWidth = width;
    context.lineCap = style === 'marker' ? 'square' : 'round'; context.lineJoin = 'round';
    if (style === 'spray') {
      path.forEach(p => {
        const density = width * 5; 
        for (let i = 0; i < density; i++) {
          const r = width * Math.random(), a = Math.random() * Math.PI * 2;
          context.fillStyle = color; context.fillRect(p.x + Math.cos(a)*r, p.y + Math.sin(a)*r, 1, 1);
        }
      });
      context.restore(); return;
    }
    context.beginPath(); context.moveTo(path[0].x, path[0].y); path.forEach(p => context.lineTo(p.x, p.y)); context.stroke();
    context.restore();
  }

  // メイン描画ループ
  function drawSticker() {
    if (selectedIndex !== -1 && layers[selectedIndex] && layers[selectedIndex].type === 'draw') selectedIndex = -1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!isExporting) {
      ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(0,0,0,0.05)";
      for (let i = GRID_SIZE; i < 500; i += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 500); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(500, i); ctx.stroke(); }
      ctx.restore();
    }

    layers.forEach((l) => {
      if (l.type === 'draw') return;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.angle || 0); ctx.globalAlpha = l.opacity;
      const m = getLayerMetrics(l), curW = m.width * l.scaleX, curH = m.height * l.scaleY;
      if (l.type === 'image') { ctx.drawImage(l.img, -curW/2, -curH/2, curW, curH); }
      else if (l.type === 'text') {
        ctx.save(); ctx.scale(l.scaleX, l.scaleY); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold 60px ${l.fontFamily}`;
        if (l.strokeWidth > 0) { ctx.strokeStyle = l.strokeColor; ctx.lineWidth = l.strokeWidth; ctx.lineJoin = "round"; ctx.strokeText(l.text, 0, 0); }
        ctx.fillStyle = l.color; ctx.fillText(l.text, 0, 0); ctx.restore();
      }
      ctx.restore();
    });

    drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    layers.forEach((l) => {
      if (l.type !== 'draw') return;
      drawCtx.save(); drawCtx.translate(l.x, l.y); drawCtx.scale(l.scaleX, l.scaleY);
      const m = getLayerMetrics(l); drawCtx.translate(-m.ox, -m.oy); drawCtx.globalAlpha = l.opacity;
      drawPath(drawCtx, l.path, l.color, l.width, l.style); drawCtx.restore();
    });
    if (isDrawing && currentPath.length > 0) {
      const style = isEraserMode ? 'eraser' : brushStyleSelect.value;
      drawPath(drawCtx, currentPath, drawColorInput.value, drawWidthInput.value, style);
    }
    ctx.drawImage(drawingCanvas, 0, 0);

    if (selectedIndex !== -1 && !isExporting) {
        const l = layers[selectedIndex];
        if (l && l.type !== 'draw') {
            ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.angle || 0);
            const m = getLayerMetrics(l), curW = m.width * l.scaleX, curH = m.height * l.scaleY;
            ctx.strokeStyle = "#007bff"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.strokeRect(-curW/2-10, -curH/2-10, curW+20, curH+20);
            ctx.setLineDash([]); ctx.fillStyle = "#007bff";
            [ [curW/2+10, 0], [0, curH/2+10], [curW/2+10, curH/2+10] ].forEach(h => { ctx.beginPath(); ctx.arc(h[0], h[1], HANDLE_R, 0, Math.PI*2); ctx.fill(); });
            ctx.fillStyle = "#2ed573"; ctx.beginPath(); ctx.arc(0, -curH/2-30, HANDLE_R+2, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }
  }

  // マウス操作系
  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY };
  };

  const handleStart = (e) => {
    if (e.cancelable) e.preventDefault(); 
    const {x: mx, y: my} = getPos(e);
    if (isDrawingMode || isEraserMode) { saveHistory(); isDrawing = true; currentPath = [{x: mx, y: my}]; selectedIndex = -1; drawSticker(); return; }
    if (selectedIndex !== -1 && layers[selectedIndex] && layers[selectedIndex].type === 'draw') { selectedIndex = -1; drawSticker(); }
    
    // オブジェクト選択
    if (selectedIndex !== -1) {
      const l = layers[selectedIndex];
      if (l.type !== 'draw') {
        const m = getLayerMetrics(l), curW = m.width * l.scaleX, curH = m.height * l.scaleY;
        const cos = Math.cos(l.angle), sin = Math.sin(l.angle);
        const rx = (mx - l.x) * cos + (my - l.y) * sin, ry = -(mx - l.x) * sin + (my - l.y) * cos;
        if (Math.hypot(rx - 0, ry - (-curH/2-30)) < 20) { isRotating = true; startMouseAngle = Math.atan2(mx - l.x, my - l.y); startLayerAngle = l.angle; saveHistory(); return; }
        if (Math.hypot(rx - (curW/2+10), ry - 0) < 25) { isResizing = true; resizeMode = "w"; saveHistory(); return; }
        if (Math.hypot(rx - 0, ry - (curH/2+10)) < 25) { isResizing = true; resizeMode = "h"; saveHistory(); return; }
        if (Math.hypot(rx - (curW/2+10), ry - (curH/2+10)) < 25) { isResizing = true; resizeMode = "both"; saveHistory(); return; }
      }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.type === 'draw') continue;
      const m = getLayerMetrics(l), cos = Math.cos(-l.angle), sin = Math.sin(-l.angle);
      const rx = (mx - l.x) * cos - (my - l.y) * sin, ry = (mx - l.x) * sin + (my - l.y) * cos;
      if (Math.abs(rx) < (m.width*l.scaleX)/2 + 15 && Math.abs(ry) < (m.height*l.scaleY)/2 + 15) {
        selectedIndex = i; isDragging = true; offsetX = mx - l.x; offsetY = my - l.y;
        opacityInput.value = l.opacity;
        if(l.type === 'text') { textInput.value = l.text; fontSelect.value = l.fontFamily; textColorInput.value = l.color; strokeColorInput.value = l.strokeColor; strokeWidthInput.value = l.strokeWidth; }
        drawSticker(); return;
      }
    }
    selectedIndex = -1; drawSticker();
  };

  const handleMove = (e) => {
    if (e.cancelable) e.preventDefault();
    if (!isDragging && !isResizing && !isRotating && !isDrawing) return;
    const {x: mx, y: my} = getPos(e);
    if ((isDrawingMode || isEraserMode) && isDrawing) { currentPath.push({x: mx, y: my}); drawSticker(); }
    else if (isRotating) { layers[selectedIndex].angle = startLayerAngle + (startMouseAngle - Math.atan2(mx - layers[selectedIndex].x, my - layers[selectedIndex].y)); drawSticker(); }
    else if (isResizing) {
      const l = layers[selectedIndex], m = getLayerMetrics(l), cos = Math.cos(l.angle), sin = Math.sin(l.angle);
      const rx = (mx - l.x) * cos + (my - l.y) * sin, ry = -(mx - l.x) * sin + (my - l.y) * cos;
      if (resizeMode === "w" || resizeMode === "both") l.scaleX = Math.max(0.1, (rx * 2) / m.width);
      if (resizeMode === "h" || resizeMode === "both") l.scaleY = Math.max(0.1, (ry * 2) / m.height);
      drawSticker();
    } else if (isDragging && selectedIndex !== -1) {
      if (layers[selectedIndex].type === 'draw') { isDragging = false; return; }
      let tx = mx - offsetX, ty = my - offsetY;
      showGuideX = Math.abs(tx - 250) < SNAP_LIMIT; showGuideY = Math.abs(ty - 250) < SNAP_LIMIT;
      layers[selectedIndex].x = showGuideX ? 250 : tx; layers[selectedIndex].y = showGuideY ? 250 : ty;
      drawSticker();
    }
  };

  const handleEnd = () => {
    if (isDrawing) {
      const m = getLayerMetrics({type:'draw', path: currentPath, scaleX:1, scaleY:1});
      const style = isEraserMode ? 'eraser' : brushStyleSelect.value;
      layers.push({type:'draw', path:[...currentPath], color:drawColorInput.value, width:parseInt(drawWidthInput.value), style: style, x:m.ox, y:m.oy, scaleX:1, scaleY:1, angle:0, opacity:1});
      isDrawing = false;
    }
    isDragging = isResizing = isRotating = false; showGuideX = showGuideY = false; drawSticker();
  };

  canvas.addEventListener("mousedown", handleStart); window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("touchstart", handleStart, { passive: false }); window.addEventListener("touchmove", handleMove, { passive: false }); window.addEventListener("touchend", handleEnd);
  
  // ボタンアクション
  const applyChange = () => {
    if (selectedIndex === -1) { drawSticker(); return; }
    saveHistory();
    const l = layers[selectedIndex];
    if (l.type === 'text') {
      l.text = textInput.value; l.fontFamily = fontSelect.value;
      l.color = textColorInput.value; l.strokeColor = strokeColorInput.value;
      l.strokeWidth = parseInt(strokeWidthInput.value);
    }
    l.opacity = parseFloat(opacityInput.value);
    drawSticker();
  };
  [textInput, fontSelect, textColorInput, strokeColorInput, strokeWidthInput, opacityInput, bgColorInput].forEach(el => el.addEventListener("input", applyChange));

  undoBtn.addEventListener("click", () => { if(history.length > 0){ layers = history.pop(); selectedIndex = -1; drawSticker(); } });
  addBtn.addEventListener("click", () => { saveHistory(); layers.push({type:'text', text:textInput.value, color:textColorInput.value, strokeColor:strokeColorInput.value, strokeWidth:5, fontFamily:fontSelect.value, x:250, y:250, scaleX:1, scaleY:1, angle:0, opacity:1}); selectedIndex=layers.length-1; drawSticker(); });
  deleteBtn.addEventListener("click", () => { if(selectedIndex!==-1){ saveHistory(); layers.splice(selectedIndex,1); selectedIndex=-1; drawSticker(); } });
  imageInput.addEventListener("change", (e) => { const r = new FileReader(); r.onload=(f)=>{ const i=new Image(); i.onload=()=>{ saveHistory(); layers.push({type:'image', img:i, originalImg:i, x:250, y:250, scaleX:0.5, scaleY:0.5, angle:0, opacity:1}); selectedIndex=layers.length-1; drawSticker(); }; i.src=f.target.result; }; r.readAsDataURL(e.target.files[0]); });
  drawModeBtn.addEventListener("click", () => { isDrawingMode = !isDrawingMode; isEraserMode = false; drawModeBtn.innerText = isDrawingMode ? "🖊 ON" : "🖊 手書き"; drawModeBtn.classList.toggle("draw-active", isDrawingMode); eraserBtn.classList.remove("draw-active"); selectedIndex = -1; drawSticker(); });
  eraserBtn.addEventListener("click", () => { isEraserMode = !isEraserMode; isDrawingMode = false; eraserBtn.classList.toggle("draw-active", isEraserMode); drawModeBtn.classList.remove("draw-active"); drawModeBtn.innerText = "🖊 手書き"; selectedIndex = -1; drawSticker(); });
  saveBtn.addEventListener("click", () => { isExporting=true; selectedIndex=-1; drawSticker(); const a=document.createElement("a"); a.href=canvas.toDataURL(); a.download="sticker.png"; a.click(); isExporting=false; drawSticker(); });
  const ss = new SelfieSegmentation({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`});
  ss.setOptions({ modelSelection: 1 });
  ss.onResults((res) => {
    const l = layers[selectedIndex], c = document.createElement("canvas"); c.width = l.originalImg.width; c.height = l.originalImg.height;
    const t = c.getContext("2d"); t.filter='blur(2px)'; t.drawImage(res.segmentationMask, 0, 0); t.globalCompositeOperation='source-in'; t.filter='none'; t.drawImage(res.image, 0, 0);
    const ni = new Image(); ni.onload=()=>{ l.img=ni; drawSticker(); }; ni.src=c.toDataURL();
  });
  aiRemoveBgBtn.addEventListener("click", async () => { if(selectedIndex!==-1 && layers[selectedIndex].type==='image') await ss.send({image: layers[selectedIndex].originalImg}); });

  // --- クラウド機能 (投稿 & ギャラリー & コピー) ---
  
  // 1. 作品を投稿
  saveProjectBtn.addEventListener("click", async () => {
    if(!db) { alert("Firebase初期化エラー"); return; }
    const name = prompt("作品名を入力してください", "名無しの作品");
    if(!name) return;

    // サムネイル作成
    isExporting = true; selectedIndex = -1; drawSticker();
    const thumbnail = canvas.toDataURL("image/jpeg", 0.5); 
    isExporting = false; drawSticker();

    const layersToSave = layers.map(l => {
      let layerData = {...l};
      if(l.type === 'image') { layerData.img = l.img.src; layerData.originalImg = l.originalImg.src; }
      return layerData;
    });

    const docData = { name: name, layers: JSON.stringify(layersToSave), bgColor: bgColorInput.value, thumbnail: thumbnail, createdAt: new Date().toISOString() };

    try {
      saveProjectBtn.innerText = "送信中...";
      await addDoc(collection(db, "stickers"), docData);
      alert("投稿しました！\n「みんなの作品を見る」から確認できます。");
    } catch (e) {
      console.error(e);
      alert("投稿エラー: コンソールを確認してください");
    } finally {
      saveProjectBtn.innerText = "☁️ 作品を投稿";
    }
  });

  // 2. ギャラリー表示 & コピー機能
  galleryBtn.addEventListener("click", async () => {
    if(!db) return;
    galleryModal.style.display = "block";
    galleryGrid.innerHTML = "<p>読み込み中...</p>";
    try {
      const q = query(collection(db, "stickers"), orderBy("createdAt", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      galleryGrid.innerHTML = "";
      if (querySnapshot.empty) { galleryGrid.innerHTML = "<p>作品がありません</p>"; return; }

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.innerHTML = `
          <img src="${data.thumbnail}">
          <div class="gallery-meta">
            <span class="gallery-name">${data.name}</span>
            <span class="gallery-date">${new Date(data.createdAt).toLocaleDateString()}</span>
          </div>
          <button class="copy-btn">📖 コピーして編集</button>
        `;
        
        // ★ここが「コピーを利用」する機能
        div.querySelector(".copy-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            if(confirm(`「${data.name}」をあなたのキャンバスにコピーして編集しますか？\n（現在の作業内容は上書きされます）`)) { 
                loadFromData(data); 
                galleryModal.style.display = "none";
                alert(`「${data.name}」をコピーしました。\n編集後に「投稿」すると、あなたの作品として新しく保存されます。`);
            }
        });
        
        galleryGrid.appendChild(div);
      });
    } catch (e) {
      console.error(e);
      galleryGrid.innerHTML = "<p>読み込みエラー</p>";
    }
  });

  closeGallery.addEventListener("click", () => galleryModal.style.display = "none");

  // データ読み込み処理
  function loadFromData(data) {
    bgColorInput.value = data.bgColor || "#ffffff";
    layers = [];
    const savedLayers = JSON.parse(data.layers);
    let loadedCount = 0;
    const totalImages = savedLayers.filter(l => l.type === 'image').length;
    const finishLoad = () => { saveHistory(); selectedIndex = -1; drawSticker(); };

    savedLayers.forEach(l => {
      if(l.type === 'image') {
        const img = new Image(); const origImg = new Image();
        img.src = l.img; origImg.src = l.originalImg;
        img.onload = () => { l.img = img; l.originalImg = origImg; layers.push(l); loadedCount++; if(loadedCount >= totalImages) finishLoad(); };
        img.onerror = () => { loadedCount++; if(loadedCount >= totalImages) finishLoad(); };
      } else { layers.push(l); }
    });
    if(totalImages === 0) finishLoad();
  }

  // ローカル保存機能
  loadProjectBtn.addEventListener("click", () => {
     const keys = Object.keys(localStorage).filter(k => k.startsWith("sticker_project_"));
     if(keys.length === 0) { alert("ローカル保存データなし"); return; }
     const names = keys.map(k => k.replace("sticker_project_", ""));
     const name = prompt("読み込むデータ名:\n" + names.join(", "));
     if(!name) return;
     const dataStr = localStorage.getItem("sticker_project_" + name);
     if(dataStr) loadFromData(JSON.parse(dataStr));
  });

  addBtn.click();
</script>
</body>
</html>
