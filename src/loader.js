import { loadTransparentLogo } from './textures.js';
import { markWelcomeSound } from './sounds.js';
import { publicUrl } from './paths.js';

const STEPS = [
  { progress: 12, label: 'Initialisation…' },
  { progress: 38, label: 'Chargement environnement 360°…' },
  { progress: 62, label: 'Préparation des vues…' },
  { progress: 84, label: 'Finalisation…' },
  { progress: 100, label: 'Prêt' },
];

const MIN_DURATION_MS = 3200;
const ASSETS_TIMEOUT_MS = 15000;

let assetsReadyResolve;
export const assetsReady = new Promise((resolve) => {
  assetsReadyResolve = resolve;
});

export function notifyAssetsReady() {
  assetsReadyResolve?.();
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateProgress(els, value, label) {
  const clamped = Math.min(100, Math.max(0, value));
  els.fill.style.width = `${clamped}%`;
  els.percent.textContent = `${Math.round(clamped)}%`;
  if (label) els.status.textContent = label;
}

function currentLabel(progress) {
  let label = STEPS[0].label;
  for (const step of STEPS) {
    if (progress >= step.progress) label = step.label;
  }
  return label;
}

export async function runLoadingScreen() {
  const loaderEl = document.getElementById('loader');
  const els = {
    fill: document.getElementById('loader-fill'),
    percent: document.getElementById('loader-percent'),
    status: document.getElementById('loader-status'),
    logo: document.querySelector('.loader-logo'),
  };

  const logoPromise = loadTransparentLogo(publicUrl('assets/logo.png')).then(({ dataUrl }) => {
    els.logo.src = dataUrl;
    els.logo.removeAttribute('hidden');
  });

  const start = performance.now();
  let visualProgress = 0;

  while (true) {
    const elapsed = performance.now() - start;
    const timeRatio = Math.min(1, elapsed / MIN_DURATION_MS);
    const target = easeOutCubic(timeRatio) * 96;
    visualProgress += (target - visualProgress) * 0.12;
    updateProgress(els, visualProgress, currentLabel(visualProgress));
    await sleep(32);

    if (elapsed >= MIN_DURATION_MS) break;
  }

  await Promise.all([
    logoPromise.catch(() => {}),
    Promise.race([assetsReady, sleep(ASSETS_TIMEOUT_MS)]),
  ]);

  for (let p = visualProgress; p <= 100; p += 2) {
    updateProgress(els, p, currentLabel(p));
    await sleep(16);
  }

  updateProgress(els, 100, 'Prêt');
  markWelcomeSound();
  await sleep(450);

  loaderEl.classList.add('hidden');
}
