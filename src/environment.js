import * as THREE from 'three';
import { publicUrl } from './paths.js';

const PANORAMA_URL = publicUrl('assets/panorama.png');
const FADE_MS = 1600;

export function createEnvironment(scene, { onReady } = {}) {
  let panoramaTexture = null;
  let videoElement = null;
  let videoTexture = null;
  let panoramaSphere = null;
  let videoSphere = null;
  let fadeRaf = null;
  let activeViewpointId = null;

  function createSphere(texture, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      transparent: opacity < 1,
      opacity,
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 64), material);
    scene.add(mesh);
    return mesh;
  }

  function setBackgroundTexture(texture) {
    scene.background = texture;
  }

  function ensurePanoramaSphere() {
    if (panoramaSphere || !panoramaTexture) return;
    panoramaSphere = createSphere(panoramaTexture, 1);
    setBackgroundTexture(panoramaTexture);
  }

  function disposeVideoSphere() {
    if (!videoSphere) return;
    scene.remove(videoSphere);
    videoSphere.geometry.dispose();
    videoSphere.material.map?.dispose();
    videoSphere.material.dispose();
    videoSphere = null;
  }

  function stopVideo() {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    videoTexture?.dispose();
    videoTexture = null;
    activeViewpointId = null;
    disposeVideoSphere();
    ensurePanoramaSphere();
    if (panoramaSphere) {
      panoramaSphere.material.opacity = 1;
      panoramaSphere.visible = true;
      setBackgroundTexture(panoramaTexture);
    }
  }

  function cancelFade() {
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    fadeRaf = null;
  }

  function fadeToVideo(url, viewpointId) {
    cancelFade();

    return new Promise((resolve) => {
      activeViewpointId = viewpointId;
      ensurePanoramaSphere();

      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', '');
        videoElement.preload = 'auto';
        videoElement.crossOrigin = 'anonymous';
      }

      videoElement.src = url;
      videoElement.load();

      const onCanPlay = () => {
        videoElement.removeEventListener('canplay', onCanPlay);
        videoElement.play().catch(() => {});

        videoTexture?.dispose();
        videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        disposeVideoSphere();
        videoSphere = createSphere(videoTexture, 0);
        setBackgroundTexture(videoTexture);

        const start = performance.now();

        const animateFade = (now) => {
          const t = Math.min(1, (now - start) / FADE_MS);
          const eased = t * t * (3 - 2 * t);

          if (panoramaSphere) panoramaSphere.material.opacity = 1 - eased;
          if (videoSphere) videoSphere.material.opacity = eased;

          if (t < 1) {
            fadeRaf = requestAnimationFrame(animateFade);
            return;
          }

          if (panoramaSphere) {
            panoramaSphere.visible = false;
            panoramaSphere.material.opacity = 1;
          }
          if (videoSphere) {
            videoSphere.material.opacity = 1;
            videoSphere.material.depthWrite = true;
            videoSphere.material.transparent = false;
          }

          fadeRaf = null;
          resolve();
        };

        fadeRaf = requestAnimationFrame(animateFade);
      };

      videoElement.addEventListener('canplay', onCanPlay);
    });
  }

  const texLoader = new THREE.TextureLoader();
  texLoader.load(PANORAMA_URL, (tex) => {
    panoramaTexture = tex;
    ensurePanoramaSphere();
    onReady?.();
  });

  return {
    fadeToVideo,
    stopVideo,
    tick() {
      if (videoTexture && videoElement && !videoElement.paused) {
        videoTexture.needsUpdate = true;
      }
    },
    getActiveViewpoint: () => activeViewpointId,
    isImmersionActive: () => activeViewpointId != null,
  };
}
