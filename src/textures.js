import * as THREE from 'three';

export function roundedRect(ctx, x, y, w, h, r) {
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

export function createGlassPanelTexture(w = 768, h = 520, opacity = 0.14) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(255,255,255,${opacity + 0.06})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${opacity})`);
  grad.addColorStop(1, `rgba(255,255,255,${opacity - 0.04})`);

  roundedRect(ctx, 0, 0, w, h, 40);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 8;
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export function createLabelTexture(text, { size = 48, color = '#ffffff', opacity = 1, width = 512, height = 80 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export { loadImage };

export function createViewpointCardTexture(image, label, { selected = false, hover = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const pad = 6;
  const r = 20;

  let fill = 'rgba(255,255,255,0.10)';
  let stroke = 'rgba(255,255,255,0.35)';
  if (selected) {
    fill = 'rgba(255, 40, 40, 0.22)';
    stroke = 'rgba(255, 90, 90, 0.95)';
  } else if (hover) {
    fill = 'rgba(255,255,255,0.22)';
    stroke = 'rgba(255,255,255,0.75)';
  }

  roundedRect(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  const imgX = pad + 8;
  const imgY = pad + 8;
  const imgW = canvas.width - (pad + 8) * 2;
  const imgH = 260;

  ctx.save();
  roundedRect(ctx, imgX, imgY, imgW, imgH, 14);
  ctx.clip();

  const scale = Math.max(imgW / image.width, imgH / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, imgX + (imgW - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
  ctx.restore();

  const labelY = imgY + imgH + 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, labelY);

  if (selected) {
    ctx.fillStyle = 'rgba(255,120,120,0.9)';
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText('Sélectionné', canvas.width / 2, labelY + 28);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function loadViewpointCardTexture(url, label, state) {
  const image = await loadImage(url);
  return createViewpointCardTexture(image, label, state);
}

/** Supprime le fond noir du logo et retourne texture Three.js + data URL */
export function loadTransparentLogo(url, threshold = 28) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < threshold && g < threshold && b < threshold) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve({ texture, dataUrl: canvas.toDataURL('image/png') });
    };
    img.onerror = reject;
    img.src = url;
  });
}
