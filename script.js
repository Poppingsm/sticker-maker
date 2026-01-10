document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  // UI要素の取得
  const textInput = document.getElementById("text"), fontSelect = document.getElementById("fontFamily");
  const textColorInput = document.getElementById("textColor"), strokeColorInput = document.getElementById("strokeColor");
  const strokeWidthInput = document.getElementById("strokeWidth"), bgColorInput = document.getElementById("bgColor");
  const addBtn = document.getElementById("addText"), deleteBtn = document.getElementById("deleteBtn"), saveBtn = document.getElementById("saveImage");
  const imageInput = document.getElementById("imageInput"), opacityInput = document.getElementById("opacity");
  const aiRemoveBgBtn = document.getElementById("aiRemoveBg"), undoBtn = document.getElementById("undoBtn");
  const drawModeBtn = document.getElementById("drawModeBtn"), eraserBtn = document.getElementById("eraserBtn");
  const drawColorInput = document.getElementById("drawColor"), drawWidthInput = document.getElementById("drawWidth"), brushStyleSelect = document.getElementById("brushStyle");
  const saveProjectBtn = document.getElementById("saveProjectBtn"), loadProjectBtn = document.getElementById("loadProjectBtn");

  // 変数定義
  let layers = [];
  let history = [];
  let selectedIndex = -1;
  let isDragging = false, isResizing = false, isRotating = false, isExporting = false; 
  let resizeMode = ""; 
  let isDrawingMode = false, isEraserMode = false, isDrawing = false, currentPath = [];
  let offsetX = 0, offsetY = 0, startMouseAngle = 0, startLayerAngle = 0, showGuideX = false, showGuideY = false;

  const SNAP_LIMIT = 12, GRID_SIZE = 25, MAX_HISTORY = 20, HANDLE_R = 8;

  // 履歴保存
  function saveHistory() {
    const state = layers.map(l => ({...l, path: l.path ? l.path.map(p => ({...p})) : null}));
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
  }

  // レイヤー移動
  window.moveLayer = (direction) => {
    if (selectedIndex === -1) return;
    saveHistory();
    const l = layers.splice(selectedIndex, 1)[0];
    if (direction === 'front') layers.push(l);
    else if (direction === 'back') layers.unshift(l);
    else if (direction === 'forward') layers.splice(Math.min(layers.length, selectedIndex + 1), 0, l);
    else if (direction === 'backward') layers.splice(Math.max(0, selectedIndex - 1), 0, l);
    selectedIndex = layers.indexOf(l);
    drawSticker();
  };

  // レイヤーサイズ取得
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

  // 描画パスのレンダリング
  function drawPath(context, path, color, width, style) {
    context.save(); // 設定を保存

    // ▼ ここを修正：消しゴムなら「透明にするモード」に切り替え
    if (style === 'eraser') {
      context.globalCompositeOperation = 'destination-out'; // 重なった部分を消す
      context.strokeStyle = "rgba(0,0,0,1)"; // 色は何でも良い（消えるので）
      context.lineWidth = width;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath(); 
      context.moveTo(path[0].x, path[0].y);
      path.forEach(p => context.lineTo(p.x, p.y)); 
      context.stroke();
      context.restore(); // 設定を戻す
      return;
    }

    // 通常のペンの処理
    context.globalCompositeOperation = 'source-over'; // 上書きモード
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = style === 'marker' ? 'square' : 'round';
    context.lineJoin = 'round';
    
    // エアブラシ
    if (style === 'spray') {
      path.forEach(p => {
        const density = width * 5; 
        for (let i = 0; i < density; i++) {
          const radius = width * Math.random(); 
          const angle = Math.random() * Math.PI * 2;
          const x = p.x + Math.cos(angle) * radius;
          const y = p.y + Math.sin(angle) * radius;
          context.fillStyle = color;
          context.fillRect(x, y, 1, 1);
        }
      });
      context.restore();
      return;
    }

    context.beginPath(); context.moveTo(path[0].x, path[0].y);
    path.forEach(p => context.lineTo(p.x, p.y)); context.stroke();
    context.restore();
  }

  // キャンバス全体の描画
  function drawSticker() {
    // 1. 背景色
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. グリッド
    if (!isExporting) {
      ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(0,0,0,0.1)";
      for (let i = GRID_SIZE; i < 500; i += GRID_SIZE) { 
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 500); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(500, i); ctx.stroke();
      }
      if (isDragging) {
        ctx.setLineDash([5, 5]); ctx.strokeStyle = "red";
        if (showGuideX) { ctx.beginPath(); ctx.moveTo(250, 0); ctx.lineTo(250, 500); ctx.stroke(); }
        if (showGuideY) { ctx.beginPath(); ctx.moveTo(0, 250); ctx.lineTo(500, 250); ctx.stroke(); }
      }
      ctx.restore();
    }

    // 3. レイヤー
    layers.forEach((l, idx) => {
      ctx.save();
      
      // レイヤー単位での消しゴム処理
      if (l.type === 'draw' && l.style === 'eraser') {
         // ここでは特に指定せず drawPath 内の globalCompositeOperation に任せる手もあるが
         // 念のため drawPath 呼び出し側では触らず、drawPath関数内で処理させる
      }

      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle || 0);
      ctx.globalAlpha = l.opacity;
      const m = getLayerMetrics(l), curW = m.width * l.scaleX, curH = m.height * l.scaleY;

      if (l.type === 'image') { ctx.drawImage(l.img, -curW/2, -curH/2, curW, curH); }
      else if (l.type === 'text') {
        ctx.save();
        ctx.scale(l.scaleX, l.scaleY); 
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold 60px ${l.fontFamily}`;
        if (l.strokeWidth > 0) { ctx.strokeStyle = l.strokeColor; ctx.lineWidth = l.strokeWidth; ctx.lineJoin = "round"; ctx.strokeText(l.text, 0, 0); }
        ctx.fillStyle = l.color; ctx.fillText(l.text, 0, 0);
        ctx.restore();
      } else if (l.type === 'draw') {
        ctx.save(); ctx.scale(l.scaleX, l.scaleY); ctx.translate(-m.ox, -m.oy);
        drawPath(ctx, l.path, l.color, l.width, l.style);
        ctx.restore();
      }

      ctx.restore();

      // 4. 選択枠
      if (idx === selectedIndex && !isExporting) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.translate(l.x, l.y);
        ctx.rotate(l.angle || 0);
        
        ctx.strokeStyle = "#007bff";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.strokeRect(-curW/2-10, -curH/2-10, curW+20, curH+20);
        
        ctx.setLineDash([]);
        ctx.fillStyle = "#007bff";
        [ [curW/2+10, 0, "w"], [0, curH/2+10, "h"], [curW/2+10, curH/2+10, "both"] ].forEach(h => {
          ctx.beginPath(); ctx.arc(h[0], h[1], HANDLE_R, 0, Math.PI*2); ctx.fill();
        });
        ctx.fillStyle = "#2ed573"; ctx.beginPath(); ctx.arc(0, -curH/2-30, HANDLE_R+2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

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

  // 保存・読み込み
  saveProjectBtn.addEventListener("click", () => {
    const name = prompt("デザインの名前を入力してください", "MySticker");
    if(!name) return;
    const layersToSave = layers.map(l => {
      let layerData = {...l};
      if(l.type === 'image') { layerData.img = l.img.src; layerData.originalImg = l.originalImg.src; }
      return layerData;
    });
    const saveData = { date: new Date().toLocaleString(), layers: layersToSave, bgColor: bgColorInput.value };
    localStorage.setItem("sticker_project_" + name, JSON.stringify(saveData));
    alert(`「${name}」を保存しました！`);
  });

  loadProjectBtn.addEventListener("click", () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("sticker_project_"));
    if(keys.length === 0) { alert("保存されたデザインはありません"); return; }
    const names = keys.map(k => k.replace("sticker_project_", ""));
    const name = prompt("読み込むデザイン名を入力:\n" + names.join(", "));
    if(!name) return;
    const dataStr = localStorage.getItem("sticker_project_" + name);
    if(!dataStr) { alert("見つかりませんでした"); return; }
    const data = JSON.parse(dataStr);
    
    bgColorInput.value = data.bgColor || "#ffffff";
    layers = [];
    let loadedCount = 0;
    const totalImages = data.layers.filter(l => l.type === 'image').length;
    const finishLoad = () => { saveHistory(); selectedIndex = -1; drawSticker(); };

    data.layers.forEach(l => {
      if(l.type === 'image') {
        const img = new Image(); const origImg = new Image();
        img.src = l.img; origImg.src = l.originalImg;
        img.onload = () => { l.img = img; l.originalImg = origImg; layers.push(l); loadedCount++; if(loadedCount >= totalImages) finishLoad(); };
      } else { layers.push(l); }
    });
    if(totalImages === 0) finishLoad();
  });

  // イベント処理
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

    if (isDrawingMode || isEraserMode) { 
      saveHistory(); isDrawing = true; currentPath = [{x: mx, y: my}]; selectedIndex = -1; drawSticker(); return; 
    }

    if (selectedIndex !== -1) {
      const l = layers[selectedIndex], m = getLayerMetrics(l), curW = m.width * l.scaleX, curH = m.height * l.scaleY;
      const cos = Math.cos(l.angle), sin = Math.sin(l.angle);
      const rx = (mx - l.x) * cos + (my - l.y) * sin, ry = -(mx - l.x) * sin + (my - l.y) * cos;
      if (Math.hypot(rx - 0, ry - (-curH/2-30)) < 20) { isRotating = true; startMouseAngle = Math.atan2(mx - l.x, my - l.y); startLayerAngle = l.angle; saveHistory(); return; }
      if (Math.hypot(rx - (curW/2+10), ry - 0) < 25) { isResizing = true; resizeMode = "w"; saveHistory(); return; }
      if (Math.hypot(rx - 0, ry - (curH/2+10)) < 25) { isResizing = true; resizeMode = "h"; saveHistory(); return; }
      if (Math.hypot(rx - (curW/2+10), ry - (curH/2+10)) < 25) { isResizing = true; resizeMode = "both"; saveHistory(); return; }
    }

    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i], m = getLayerMetrics(l), cos = Math.cos(-l.angle), sin = Math.sin(-l.angle);
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

    if ((isDrawingMode || isEraserMode) && isDrawing) {
      currentPath.push({x: mx, y: my}); 
      drawSticker(); // まず既存の絵を描画
      // 次に現在の線を「重ねて」描画（消しゴムならここで消える）
      const style = isEraserMode ? 'eraser' : brushStyleSelect.value;
      drawPath(ctx, currentPath, drawColorInput.value, drawWidthInput.value, style);
    } else if (isRotating) {
      const l = layers[selectedIndex]; l.angle = startLayerAngle + (startMouseAngle - Math.atan2(mx - l.x, my - l.y)); drawSticker();
    } else if (isResizing) {
      const l = layers[selectedIndex], m = getLayerMetrics(l), cos = Math.cos(l.angle), sin = Math.sin(l.angle);
      const rx = (mx - l.x) * cos + (my - l.y) * sin, ry = -(mx - l.x) * sin + (my - l.y) * cos;
      if (resizeMode === "w" || resizeMode === "both") l.scaleX = Math.max(0.1, (rx * 2) / m.width);
      if (resizeMode === "h" || resizeMode === "both") l.scaleY = Math.max(0.1, (ry * 2) / m.height);
      drawSticker();
    } else if (isDragging && selectedIndex !== -1) {
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

  canvas.addEventListener("mousedown", handleStart);
  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("touchstart", handleStart, { passive: false });
  window.addEventListener("touchmove", handleMove, { passive: false });
  window.addEventListener("touchend", handleEnd);
  
  undoBtn.addEventListener("click", () => { if(history.length > 0){ layers = history.pop(); selectedIndex = -1; drawSticker(); } });
  addBtn.addEventListener("click", () => { saveHistory(); layers.push({type:'text', text:textInput.value, color:textColorInput.value, strokeColor:strokeColorInput.value, strokeWidth:5, fontFamily:fontSelect.value, x:250, y:250, scaleX:1, scaleY:1, angle:0, opacity:1}); selectedIndex=layers.length-1; drawSticker(); });
  deleteBtn.addEventListener("click", () => { if(selectedIndex!==-1){ saveHistory(); layers.splice(selectedIndex,1); selectedIndex=-1; drawSticker(); } });
  imageInput.addEventListener("change", (e) => { const r = new FileReader(); r.onload=(f)=>{ const i=new Image(); i.onload=()=>{ saveHistory(); layers.push({type:'image', img:i, originalImg:i, x:250, y:250, scaleX:0.5, scaleY:0.5, angle:0, opacity:1}); selectedIndex=layers.length-1; drawSticker(); }; i.src=f.target.result; }; r.readAsDataURL(e.target.files[0]); });
  
  drawModeBtn.addEventListener("click", () => { 
    isDrawingMode = !isDrawingMode; isEraserMode = false;
    drawModeBtn.innerText = isDrawingMode ? "🖊 手書き ON" : "🖊 手書き OFF"; 
    drawModeBtn.classList.toggle("draw-active", isDrawingMode); 
    eraserBtn.classList.remove("draw-active"); selectedIndex = -1; drawSticker(); 
  });

  eraserBtn.addEventListener("click", () => {
    isEraserMode = !isEraserMode; isDrawingMode = false;
    eraserBtn.classList.toggle("draw-active", isEraserMode);
    drawModeBtn.classList.remove("draw-active"); drawModeBtn.innerText = "🖊 手書き OFF";
    selectedIndex = -1; drawSticker();
  });

  saveBtn.addEventListener("click", () => { isExporting=true; selectedIndex=-1; drawSticker(); const a=document.createElement("a"); a.href=canvas.toDataURL(); a.download="sticker.png"; a.click(); isExporting=false; drawSticker(); });

  const ss = new SelfieSegmentation({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`});
  ss.setOptions({ modelSelection: 1 });
  ss.onResults((res) => {
    const l = layers[selectedIndex], c = document.createElement("canvas"); c.width = l.originalImg.width; c.height = l.originalImg.height;
    const t = c.getContext("2d"); t.filter='blur(2px)'; t.drawImage(res.segmentationMask, 0, 0); t.globalCompositeOperation='source-in'; t.filter='none'; t.drawImage(res.image, 0, 0);
    const ni = new Image(); ni.onload=()=>{ l.img=ni; drawSticker(); }; ni.src=c.toDataURL();
  });
  aiRemoveBgBtn.addEventListener("click", async () => { if(selectedIndex!==-1 && layers[selectedIndex].type==='image') await ss.send({image: layers[selectedIndex].originalImg}); });

  addBtn.click();
});
