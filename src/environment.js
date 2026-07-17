import * as THREE from 'three';
import { publicUrl } from './paths.js';

const PANORAMA_URL = publicUrl('assets/panorama.png');

export function createEnvironment(scene, { onReady } = {}) {
  let sphere = null;
  let panoramaTexture = null;
  let videoElement = null;
  let videoTexture = null;
  let activeViewpointId = null;

  function disposeSphere() {
    if (!sphere) return;
    scene.remove(sphere);
    sphere.geometry.dispose();
    sphere.material.dispose();
    sphere = null;
  }

  function applyTexture(texture) {
    disposeSphere();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    sphere = new THREE.Mesh(
      new THREE.SphereGeometry(50, 64, 64),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
    );
    scene.add(sphere);
  }

  function showPanorama() {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    videoTexture?.dispose();
    videoTexture = null;
    activeViewpointId = null;
    if (panoramaTexture) applyTexture(panoramaTexture);
  }

  function showVideo(url, viewpointId) {
    activeViewpointId = viewpointId;

    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.loop = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.preload = 'auto';
      videoElement.crossOrigin = 'anonymous';
    }

    if (videoElement.src !== url) {
      videoElement.src = url;
      videoElement.load();
    }

    videoTexture?.dispose();
    videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    applyTexture(videoTexture);

    videoElement.play().catch(() => {});
  }

  const texLoader = new THREE.TextureLoader();
  texLoader.load(PANORAMA_URL, (tex) => {
    panoramaTexture = tex;
    applyTexture(tex);
    onReady?.();
  });

  return {
    setViewpoint(viewpointId, videoUrl) {
      if (viewpointId === 'perche' && videoUrl) {
        showVideo(videoUrl, viewpointId);
        return;
      }
      showPanorama();
    },
    tick() {
      if (videoTexture && videoElement && !videoElement.paused) {
        videoTexture.needsUpdate = true;
      }
    },
    getActiveViewpoint: () => activeViewpointId,
  };
}
