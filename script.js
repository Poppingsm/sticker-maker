document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sticker");
  const ctx = canvas.getContext("2d");

  const textInput = document.getElementById("text");
  const fontSelect = document.getElementById("font");
  const textColorInput = document.getElementById("textColor");
  const bgColorInput = document.getElementById("bgColor");
  const fontSizeInput = document.getElementById("fontSize");

  let textX = canvas.width / 2;
  let textY = canvas.height / 2;
  let isDragging = false;

  // 描画関数
  window.drawSticker = function () {
    // 背景のクリアと塗りつぶし
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 文字の設定（バッククォートで修正）
    ctx.fillStyle = textColorInput.value;
    ctx.font = `bold ${fontSizeInput.value}px ${fontSelect.value}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(textInput.value, textX, textY);
  };

  // 入力が変わったら即反映
  [textInput, fontSelect, textColorInput, bgColorInput, fontSizeInput]
    .forEach(el => {
      el.addEventListener("input", drawSticker);
    });

  // マウスを押したとき
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 当たり判定のために現在のフォントを設定
    ctx.font = `bold ${fontSizeInput.value}px ${fontSelect.value}`;

    const fontSize = parseInt(fontSizeInput.value);
    const textWidth = ctx.measureText(textInput.value).width;

    // 文字の当たり判定
    if (
      mouseX > textX - textWidth / 2 &&
      mouseX < textX + textWidth / 2 &&
      mouseY > textY - fontSize / 2 &&
      mouseY < textY + fontSize / 2
    ) {
      isDragging = true;
    }
  });

  // マウスを動かしたとき
  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const rect = canvas.getBoundingClientRect();
    textX = e.clientX - rect.left;
    textY = e.clientY - rect.top;

    drawSticker();
  });

  // マウスを離したとき
  canvas.addEventListener("mouseup", () => { isDragging = false; });
  canvas.addEventListener("mouseleave", () => { isDragging = false; });

  // 初期表示
  drawSticker();
});