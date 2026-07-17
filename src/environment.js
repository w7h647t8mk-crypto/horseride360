import * as THREE from 'three';
import { publicUrl, applyVideoCrossOrigin } from './paths.js';

const PANORAMA_URL = publicUrl('assets/panorama.png');
const FADE_MS = 1400;

function resolveVideoUrl(url) {
  return new URL(url, window.location.href).href;
}

function videoMatchesUrl(video, url) {
  const target = resolveVideoUrl(url);
  const current = video.currentSrc || video.src || '';
  return current === target || current.endsWith(url.replace(/^\//, ''));
}

export function createEnvironment(scene, { onReady, videoEl, mobile = false } = {}) {
  const LOAD_TIMEOUT_MS = mobile ? 120000 : 60000;
  let panoramaTexture = null;
  let videoElement = videoEl ?? null;
  let videoTexture = null;
  let panoramaSphere = null;
  let videoSphere = null;
  let fadeRaf = null;
  let activeViewpointId = null;
  let playUnlocked = false;
  const sphereSegments = mobile ? 32 : 64;

  function getVideo() {
    if (videoElement) return videoElement;
    videoElement = document.createElement('video');
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', '');
    videoElement.setAttribute('x-webkit-airplay', 'deny');
    videoElement.preload = 'auto';
    videoElement.classList.add('immersion-video-el');
    document.body.appendChild(videoElement);
    return videoElement;
  }

  if (videoElement) {
    videoElement.classList.add('immersion-video-el');
    videoElement.removeAttribute('hidden');
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
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(50, sphereSegments, sphereSegments),
      material
    );
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

  function ensurePlaying(video) {
    if (!video.paused) return Promise.resolve();
    return video.play().catch(() => video.play().catch(() => {}));
  }

  function prepareVideoElement(video) {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.removeAttribute('hidden');
  }

  function setVideoSource(video, url) {
    prepareVideoElement(video);
    applyVideoCrossOrigin(video, url);
    if (videoMatchesUrl(video, url)) return;
    video.src = url;
    video.load();
  }

  function waitForVideoReady(video, url) {
    return new Promise((resolve, reject) => {
      if (!videoMatchesUrl(video, url)) {
        setVideoSource(video, url);
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('timeout'));
      }, LOAD_TIMEOUT_MS);

      const tryResolve = () => {
        if (video.readyState < 2) return;
        cleanup();
        resolve(video);
      };

      const onError = () => {
        cleanup();
        reject(new Error('load-error'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', tryResolve);
        video.removeEventListener('loadeddata', tryResolve);
        video.removeEventListener('canplay', tryResolve);
        video.removeEventListener('playing', tryResolve);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadedmetadata', tryResolve);
      video.addEventListener('loadeddata', tryResolve);
      video.addEventListener('canplay', tryResolve);
      video.addEventListener('playing', tryResolve);
      video.addEventListener('error', onError, { once: true });

      tryResolve();
      if (playUnlocked) ensurePlaying(video);
    });
  }

  /** Précharge sans play (mobile : au changement de vue). */
  function preloadVideo(url) {
    const video = getVideo();
    video.pause();
    setVideoSource(video, url);
  }

  /** Appeler en premier dans le handler tap/clic (iOS). */
  function primeVideo(url) {
    const video = getVideo();
    playUnlocked = true;
    setVideoSource(video, url);
    const attempt = video.play();
    if (attempt?.catch) {
      attempt.catch(() => {
        if (video.readyState >= 2) video.play().catch(() => {});
      });
    }
    return attempt;
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
      videoTexture.generateMipmaps = false;

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
    const video = getVideo();
    await waitForVideoReady(video, url);
    await ensurePlaying(video);
    await runCrossfade();
  }

  function stopVideo() {
    cancelFade();
    playUnlocked = false;
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
  }, undefined, () => onReady?.());

  return {
    primeVideo,
    preloadVideo,
    fadeToVideo,
    stopVideo,
    tick() {
      const video = videoElement;
      if (videoTexture && video && !video.paused && video.readyState >= 2) {
        videoTexture.needsUpdate = true;
      }
    },
    getActiveViewpoint: () => activeViewpointId,
    isImmersionActive: () => activeViewpointId != null,
  };
}
