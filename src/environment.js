import * as THREE from 'three';
import { publicUrl } from './paths.js';

const PANORAMA_URL = publicUrl('assets/panorama.png');
const FADE_MS = 1400;
const LOAD_TIMEOUT_MS = 45000;

export function createEnvironment(scene, { onReady, videoEl } = {}) {
  let panoramaTexture = null;
  let videoElement = videoEl ?? null;
  let videoTexture = null;
  let panoramaSphere = null;
  let videoSphere = null;
  let fadeRaf = null;
  let activeViewpointId = null;

  function getVideo() {
    if (videoElement) return videoElement;
    videoElement = document.createElement('video');
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', '');
    videoElement.preload = 'auto';
    videoElement.hidden = true;
    document.body.appendChild(videoElement);
    return videoElement;
  }

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

  function cancelFade() {
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    fadeRaf = null;
  }

  function waitForVideoReady(video, url) {
    return new Promise((resolve, reject) => {
      if (video.src !== url) {
        video.src = url;
        video.load();
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('timeout'));
      }, LOAD_TIMEOUT_MS);

      const tryResolve = () => {
        cleanup();
        resolve(video);
      };

      const onError = () => {
        cleanup();
        reject(new Error('load-error'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', tryResolve);
        video.removeEventListener('canplay', tryResolve);
        video.removeEventListener('error', onError);
      };

      if (video.readyState >= 2) {
        tryResolve();
        return;
      }

      video.addEventListener('loadeddata', tryResolve, { once: true });
      video.addEventListener('canplay', tryResolve, { once: true });
      video.addEventListener('error', onError, { once: true });

      video.play().catch(() => {});
    });
  }

  /** À appeler dans le geste utilisateur (tap LANCER) — requis iOS. */
  function primeVideo(url) {
    const video = getVideo();
    if (video.src !== url) {
      video.src = url;
      video.load();
    }
    return video.play();
  }

  function runCrossfade() {
    return new Promise((resolve) => {
      ensurePanoramaSphere();
      if (panoramaSphere) {
        panoramaSphere.material.transparent = true;
        panoramaSphere.visible = true;
        panoramaSphere.material.opacity = 1;
      }

      videoTexture?.dispose();
      videoTexture = new THREE.VideoTexture(getVideo());
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      disposeVideoSphere();
      videoSphere = createSphere(videoTexture, 0);
      videoSphere.material.transparent = true;
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

        if (panoramaSphere) panoramaSphere.visible = false;
        if (videoSphere) {
          videoSphere.material.opacity = 1;
          videoSphere.material.transparent = false;
        }
        fadeRaf = null;
        resolve();
      };
      fadeRaf = requestAnimationFrame(animateFade);
    });
  }

  async function fadeToVideo(url, viewpointId) {
    cancelFade();
    activeViewpointId = viewpointId;
    await waitForVideoReady(getVideo(), url);
    await getVideo().play();
    await runCrossfade();
  }

  function stopVideo() {
    cancelFade();
    const video = videoElement;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    videoTexture?.dispose();
    videoTexture = null;
    activeViewpointId = null;
    disposeVideoSphere();
    ensurePanoramaSphere();
    if (panoramaSphere) {
      panoramaSphere.visible = true;
      panoramaSphere.material.opacity = 1;
      panoramaSphere.material.transparent = false;
      setBackgroundTexture(panoramaTexture);
    }
  }

  const texLoader = new THREE.TextureLoader();
  texLoader.load(PANORAMA_URL, (tex) => {
    panoramaTexture = tex;
    ensurePanoramaSphere();
    onReady?.();
  });

  return {
    primeVideo,
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
