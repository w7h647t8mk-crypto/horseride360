import '../css/style.css';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { publicUrl } from './paths.js';
import { loadTransparentLogo } from './textures.js';
import { initUI, VIEWPOINTS } from './ui.js';
import { createEnvironment } from './environment.js';
import { setupWebXR, launchVR } from './xr.js';
import { runLoadingScreen, notifyAssetsReady } from './loader.js';
import { initSounds, unlockSounds, playCue } from './sounds.js';
import { isMobileLayout } from './device.js';
import { createGyroControls } from './gyro.js';

initSounds();
window.addEventListener('pointerdown', unlockSounds, { once: true });

const canvas = document.getElementById('canvas');
const uiEl = document.getElementById('ui');
const gyroBtn = document.getElementById('gyro-btn');
const immersionBar = document.getElementById('immersion-bar');
const immersionLabel = document.getElementById('immersion-label');
const immersionVideo = document.getElementById('immersion-video');
const mobile = isMobileLayout();
const MOBILE_PANEL_WIDTH = 1120;
const MOBILE_TARGET_WIDTH_RATIO = 0.93;
const MOBILE_PANEL_DISTANCE = 2.35;

function getMobileUiScale() {
  const vFovRad = THREE.MathUtils.degToRad(70);
  const aspect = window.innerWidth / window.innerHeight;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const halfAngle = (hFovRad * MOBILE_TARGET_WIDTH_RATIO) / 2;
  const worldWidth = MOBILE_PANEL_DISTANCE * Math.tan(halfAngle) * 2;
  return worldWidth / MOBILE_PANEL_WIDTH;
}

const INTERACTIVE_SELECTOR = '.card, .bottom-bar, .chip, .launch-btn, .ui-logo, .gyro-btn, .immersion-bar, .immersion-bar__btn, button, a, input, label';
const UI_PANEL_Z = mobile ? -MOBILE_PANEL_DISTANCE : -3.2;
const UI_PANEL_Y = mobile ? 1.48 : 1.52;
const UI_SCALE = mobile ? getMobileUiScale() : 0.00172;

if (mobile) {
  document.body.classList.add('is-mobile');
  uiEl.classList.add('ui--compact');
  const subtitle = document.querySelector('.ui-subtitle');
  if (subtitle) subtitle.textContent = 'EXPÉRIENCE VR 360° · Inclinez ou glissez pour explorer';
}

loadTransparentLogo(publicUrl('assets/logo.png')).then(({ dataUrl }) => {
  const logo = document.getElementById('logo');
  if (logo) {
    logo.src = dataUrl;
    logo.removeAttribute('hidden');
  }
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.id = 'css3d-root';
cssRenderer.domElement.style.position = 'fixed';
cssRenderer.domElement.style.inset = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '5';
document.body.appendChild(cssRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0);
scene.add(camera);

const uiPanel = new CSS3DObject(uiEl);
uiPanel.position.set(0, UI_PANEL_Y, UI_PANEL_Z);
uiPanel.scale.setScalar(UI_SCALE);
scene.add(uiPanel);

let lon = 0;
let lat = 0;
let isPresenting = false;
let drag = null;
let gyroActive = false;

function isInteractiveTarget(el) {
  return el?.closest?.(INTERACTIVE_SELECTOR);
}

function applyCameraRotation() {
  const phi = THREE.MathUtils.degToRad(lat);
  const theta = THREE.MathUtils.degToRad(lon);
  camera.lookAt(
    camera.position.x + 500 * Math.cos(phi) * Math.sin(theta),
    camera.position.y + 500 * Math.sin(phi),
    camera.position.z - 500 * Math.cos(phi) * Math.cos(theta)
  );
}

function setView(nextLon, nextLat) {
  lon = nextLon;
  lat = Math.max(-85, Math.min(85, nextLat));
  applyCameraRotation();
}

function rotateView(deltaLon, deltaLat) {
  if (mobile && gyroActive) {
    gyro.addOffset(deltaLon, deltaLat);
    return;
  }
  setView(lon - deltaLon, lat + deltaLat);
}

let isImmersion = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enterImmersion(label) {
  isImmersion = true;
  document.body.classList.add('in-immersion');
  if (immersionLabel) immersionLabel.textContent = label;
  immersionBar?.removeAttribute('hidden');

  uiEl.classList.add('is-exiting');
  await sleep(450);
  ui.hide();
  uiPanel.visible = false;
  uiEl.classList.remove('is-exiting');
}

async function exitImmersion() {
  if (!isImmersion) return;
  isImmersion = false;
  document.body.classList.remove('in-immersion');
  immersionBar?.setAttribute('hidden', '');
  environment.stopVideo();
  uiPanel.visible = true;
  ui.show();
  if (mobile && gyroBtn && !gyro.isListening()) gyroBtn.removeAttribute('hidden');
}

function updateUiBillboard() {
  uiPanel.lookAt(camera.position);
}

function updateMobileUiScale() {
  if (!mobile || isImmersion) return;
  uiPanel.scale.setScalar(getMobileUiScale());
}

function updateGyroButton(active) {
  if (!gyroBtn) return;
  gyroActive = active;
  gyroBtn.classList.toggle('is-active', active);
  gyroBtn.innerHTML = active
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4L19 6"/></svg> Gyro actif — inclinez'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg> Activer le gyroscope';
  if (active) {
    setTimeout(() => gyroBtn.setAttribute('hidden', ''), 2500);
  } else {
    gyroBtn.removeAttribute('hidden');
  }
}

const gyro = createGyroControls({
  onOrientation: (gLon, gLat) => {
    if (drag || isPresenting) return;
    setView(gLon, gLat);
  },
  isBlocked: () => isPresenting,
  onActiveChange: updateGyroButton,
});

function enableGyroForImmersion() {
  if (gyro.isListening()) return;
  gyro.enableFromGesture((ok) => {
    if (ok) gyro.calibrateToView(lon, lat);
  });
}

function requestGyroFromGesture({ quiet = false } = {}) {
  if (!quiet) playCue('info', { volume: 0.35 });
  gyro.enableFromGesture((ok, reason) => {
    if (ok) {
      gyro.calibrateToView(lon, lat);
      playCue('toggle-on');
      return;
    }
    if (reason === 'denied') {
      alert('Autorisation refusée.\n\nRéglages iPhone → Safari → Capteurs de mouvement → Autoriser.');
    } else if (reason === 'unsupported') {
      alert('Gyroscope non disponible sur cet appareil ou navigateur.');
    }
  });
}

if (mobile && gyroBtn) {
  gyroBtn.removeAttribute('hidden');
  gyroBtn.addEventListener('click', requestGyroFromGesture);
}

const environment = createEnvironment(scene, {
  onReady: notifyAssetsReady,
  videoEl: immersionVideo,
});

applyCameraRotation();
updateUiBillboard();

runLoadingScreen();

const ui = initUI({
  mobile,
  onViewpointChange: ({ viewpointId, label }) => {
    console.log(`[VR Show] ${label} (${viewpointId})`);
  },
  onLaunchVR: (viewpointId) => {
    const vp = VIEWPOINTS[viewpointId];
    console.log(`[VR Show] Lancement — ${vp?.label ?? viewpointId}`);

    if (vp?.immersion) {
      environment.primeVideo(vp.immersion).catch(() => {});
      enableGyroForImmersion();

      enterImmersion(vp.label);
      environment.fadeToVideo(vp.immersion, viewpointId).catch(() => {
        alert('Impossible de charger la vidéo 360°.\nVérifiez votre connexion et réessayez.');
        exitImmersion();
      });
      return;
    }

    launchVR();
  },
  onToggleGyro: () => {
    if (gyro.isListening()) {
      gyro.disable();
      return false;
    }
    requestGyroFromGesture();
    return gyro.isListening();
  },
  isGyroEnabled: () => gyro.isListening(),
});

setupWebXR(renderer, {
  onSessionStart: () => {
    isPresenting = true;
    drag = null;
    document.body.classList.remove('is-looking');
    document.body.classList.add('in-vr');
    ui.hide();
    uiPanel.visible = false;
    cssRenderer.domElement.style.display = 'none';
    gyroBtn?.setAttribute('hidden', '');
  },
  onSessionEnd: () => {
    isPresenting = false;
    document.body.classList.remove('in-vr');
    ui.show();
    uiPanel.visible = true;
    cssRenderer.domElement.style.display = '';
    if (mobile && gyroBtn && !gyro.isListening()) gyroBtn.removeAttribute('hidden');
    applyCameraRotation();
    updateUiBillboard();
  },
});

document.getElementById('exit-immersion')?.addEventListener('click', () => {
  playCue('back');
  exitImmersion();
});

function startLook(e) {
  if (isPresenting || isInteractiveTarget(e.target)) return;

  if (!gyro.isListening()) {
    requestGyroFromGesture({ quiet: true });
  }

  drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  document.body.classList.add('is-looking');
  canvas.setPointerCapture?.(e.pointerId);
}

function stopLook(e) {
  if (drag && e.pointerId === drag.id) {
    drag = null;
    document.body.classList.remove('is-looking');
    canvas.releasePointerCapture?.(e.pointerId);
  }
}

window.addEventListener('pointerdown', startLook);
window.addEventListener('pointerup', stopLook);
window.addEventListener('pointercancel', stopLook);

window.addEventListener('pointermove', (e) => {
  if (isPresenting || !drag || e.pointerId !== drag.id) return;
  rotateView((e.clientX - drag.x) * 0.12, (e.clientY - drag.y) * 0.12);
  drag.x = e.clientX;
  drag.y = e.clientY;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  updateMobileUiScale();
});

renderer.setAnimationLoop(() => {
  environment.tick();
  if (!isPresenting && !isImmersion) updateUiBillboard();
  renderer.render(scene, camera);
  if (!isPresenting && !isImmersion) cssRenderer.render(scene, camera);
});

window.VRShow = {
  getSelectedViewpoint: () => ui.getSelectedViewpoint(),
  isInVR: () => isPresenting,
  launchVR,
  rotateView,
  playCue,
  enableGyro: requestGyroFromGesture,
  exitImmersion,
  onViewpointChange: (cb) => window.addEventListener('vrshow:viewpoint', (e) => cb(e.detail)),
};
