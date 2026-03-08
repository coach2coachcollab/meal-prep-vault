/**
 * Generates a branded 1080x1920 story card image with recipe photo, title, and macros.
 * Returns a Blob (image/png).
 */

interface StoryCardData {
  title: string;
  imageUrl: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  prepTime: number;
  servings: number;
  caption?: string;
}

const CARD_W = 1080;
const CARD_H = 1920;

// Brand colors (from design tokens — HSL converted to hex)
const COLORS = {
  cream: "#FAF8F3",
  darkText: "#1C1A17",
  green: "#4A7C59",
  gold: "#C4973A",
  tan: "#C9B99A",
  sand: "#EDE7D9",
  brown: "#8B6E4E",
  muted: "#7A7268",
  softGreen: "#E8F5EC",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMacroPill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  label: string, value: string, color: string
) {
  const h = 110;
  const r = 24;

  // Pill background
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = COLORS.cream;
  ctx.fill();

  // Color accent bar at top
  roundRect(ctx, x, y, w, 8, r);
  ctx.fillStyle = color;
  ctx.fill();

  // Value
  ctx.fillStyle = COLORS.darkText;
  ctx.font = "bold 42px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(value, x + w / 2, y + 58);

  // Label
  ctx.fillStyle = COLORS.muted;
  ctx.font = "26px system-ui, -apple-system, sans-serif";
  ctx.fillText(label, x + w / 2, y + 92);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateStoryCard(data: StoryCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // === Background gradient ===
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bgGrad.addColorStop(0, COLORS.sand);
  bgGrad.addColorStop(0.6, COLORS.cream);
  bgGrad.addColorStop(1, COLORS.softGreen);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // === Top brand bar ===
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, CARD_W, 8);

  // === Brand name ===
  ctx.fillStyle = COLORS.green;
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🍽️  MEAL TRACKER", CARD_W / 2, 80);

  // === Recipe image ===
  const imgY = 120;
  const imgH = 820;
  const imgPad = 60;
  const imgW = CARD_W - imgPad * 2;

  // Rounded clip for image area
  ctx.save();
  roundRect(ctx, imgPad, imgY, imgW, imgH, 32);
  ctx.clip();

  if (data.imageUrl) {
    try {
      const img = await loadImage(data.imageUrl);
      // Cover-fit the image
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = imgPad + (imgW - drawW) / 2;
      const drawY = imgY + (imgH - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(imgPad, imgY, imgW, imgH);
      ctx.fillStyle = COLORS.muted;
      ctx.font = "32px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No image", CARD_W / 2, imgY + imgH / 2);
    }
  } else {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(imgPad, imgY, imgW, imgH);
    ctx.fillStyle = COLORS.tan;
    ctx.font = "48px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🍳", CARD_W / 2, imgY + imgH / 2 + 16);
  }

  // Dark gradient overlay at bottom of image for readability
  const overlayGrad = ctx.createLinearGradient(0, imgY + imgH - 250, 0, imgY + imgH);
  overlayGrad.addColorStop(0, "rgba(28,26,23,0)");
  overlayGrad.addColorStop(1, "rgba(28,26,23,0.7)");
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(imgPad, imgY + imgH - 250, imgW, 250);

  ctx.restore();

  // === Title on image overlay ===
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";

  // Word-wrap title
  const maxTitleW = imgW - 60;
  const words = data.title.split(" ");
  let lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxTitleW) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  lines = lines.slice(0, 3); // max 3 lines

  const titleBaseY = imgY + imgH - 40 - (lines.length - 1) * 60;
  lines.forEach((line, i) => {
    ctx.fillText(line, imgPad + 30, titleBaseY + i * 60);
  });

  // === Prep time & servings row ===
  const infoY = imgY + imgH + 40;
  ctx.fillStyle = COLORS.muted;
  ctx.font = "30px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  const infoText = `⏱ ${data.prepTime > 0 ? `${data.prepTime} min` : "—"}  ·  🍽 ${data.servings} serving${data.servings > 1 ? "s" : ""}`;
  ctx.fillText(infoText, CARD_W / 2, infoY);

  // === Macro pills ===
  const pillY = infoY + 40;
  const pillGap = 20;
  const pillW = (CARD_W - imgPad * 2 - pillGap * 3) / 4;

  const macros = [
    { label: "Cal", value: `${data.calories}`, color: COLORS.gold },
    { label: "Protein", value: `${data.protein}g`, color: COLORS.green },
    { label: "Carbs", value: `${data.carbs}g`, color: COLORS.brown },
    { label: "Fats", value: `${data.fats}g`, color: "#B85C38" },
  ];

  macros.forEach((m, i) => {
    drawMacroPill(ctx, imgPad + i * (pillW + pillGap), pillY, pillW, m.label, m.value, m.color);
  });

  // === Caption ===
  if (data.caption) {
    ctx.fillStyle = COLORS.darkText;
    ctx.font = "italic 34px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    
    // Word-wrap caption
    const maxCaptionW = CARD_W - 120;
    const captionWords = data.caption.split(" ");
    let captionLines: string[] = [];
    let cLine = "";
    for (const w of captionWords) {
      const test = cLine ? `${cLine} ${w}` : w;
      if (ctx.measureText(test).width > maxCaptionW) {
        if (cLine) captionLines.push(cLine);
        cLine = w;
      } else {
        cLine = test;
      }
    }
    if (cLine) captionLines.push(cLine);
    captionLines = captionLines.slice(0, 3);

    const captionY = pillY + 150;
    captionLines.forEach((line, i) => {
      ctx.fillText(`"${i === 0 ? "" : ""}${line}${i === captionLines.length - 1 ? "" : ""}`, CARD_W / 2, captionY + i * 44);
    });
  }

  // === Bottom decorative line ===
  const bottomY = CARD_H - 80;
  ctx.strokeStyle = COLORS.tan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(imgPad, bottomY);
  ctx.lineTo(CARD_W - imgPad, bottomY);
  ctx.stroke();

  // === Footer ===
  ctx.fillStyle = COLORS.muted;
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Made with Meal Tracker ✨", CARD_W / 2, CARD_H - 40);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}
