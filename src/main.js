import '../css/style.css';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { publicUrl } from './paths.js';
import { loadTransparentLogo } from './textures.js';
import { initUI } from './ui.js';
import { setupWebXR, launchVR } from './xr.js';
import { runLoadingScreen, notifyAssetsReady } from './loader.js';
import { initSounds, unlockSounds, playCue } from './sounds.js';
import { isMobileLayout } from './device.js';
import { createGyroControls } from './gyro.js';

initSounds();
window.addEventListener('pointerdown', unlockSounds, { once: true });

const canvas = document.getElementById('canvas');
const uiEl = document.getElementById('ui');
const mobile = isMobileLayout();

const INTERACTIVE_SELECTOR = '.card, .bottom-bar, .chip, .launch-btn, .ui-logo, button, a, input, label';
const UI_PANEL_Z = -3.2;
const UI_SCALE = 0.00172;

if (mobile) {
  document.body.classList.add('is-mobile');
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

let uiPanel = null;
if (!mobile) {
  uiPanel = new CSS3DObject(uiEl);
  uiPanel.position.set(0, 1.52, UI_PANEL_Z);
  uiPanel.scale.setScalar(UI_SCALE);
  scene.add(uiPanel);
} else {
  cssRenderer.domElement.style.display = 'none';
}

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

function updateUiBillboard() {
  uiPanel?.lookAt(camera.position);
}

const gyro = createGyroControls({
  onOrientation: (gLon, gLat) => {
    if (drag || isPresenting) return;
    setView(gLon, gLat);
  },
  isBlocked: () => isPresenting,
});

async function enableGyro() {
  const ok = await gyro.enable();
  gyroActive = ok && gyro.isEnabled();
  return ok;
}

const texLoader = new THREE.TextureLoader();
texLoader.load(publicUrl('assets/panorama.png'), (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = tex;
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(50, 64, 64),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })
    )
  );
  notifyAssetsReady();
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
    console.log(`[VR Show] Lancement VR — ${viewpointId}`);
    launchVR();
  },
  onToggleGyro: async () => {
    if (gyro.isEnabled()) {
      gyro.disable();
      gyroActive = false;
    } else {
      await enableGyro();
    }
    return gyro.isEnabled();
  },
  isGyroEnabled: () => gyro.isEnabled(),
});

setupWebXR(renderer, {
  onSessionStart: () => {
    isPresenting = true;
    drag = null;
    document.body.classList.remove('is-looking');
    document.body.classList.add('in-vr');
    ui.hide();
    if (uiPanel) uiPanel.visible = false;
    cssRenderer.domElement.style.display = 'none';
  },
  onSessionEnd: () => {
    isPresenting = false;
    document.body.classList.remove('in-vr');
    ui.show();
    if (uiPanel) {
      uiPanel.visible = true;
      cssRenderer.domElement.style.display = '';
    }
    applyCameraRotation();
    updateUiBillboard();
  },
});

function startLook(e) {
  if (isPresenting || isInteractiveTarget(e.target)) return;

  if (mobile && gyro.isEnabled() && !gyroActive) {
    enableGyro();
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
});

renderer.setAnimationLoop(() => {
  if (!isPresenting && uiPanel) updateUiBillboard();
  renderer.render(scene, camera);
  if (!isPresenting && uiPanel) cssRenderer.render(scene, camera);
});

window.VRShow = {
  getSelectedViewpoint: () => ui.getSelectedViewpoint(),
  isInVR: () => isPresenting,
  launchVR,
  rotateView,
  playCue,
  enableGyro,
  onViewpointChange: (cb) => window.addEventListener('vrshow:viewpoint', (e) => cb(e.detail)),
};
