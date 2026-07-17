function normalizeBase(base) {
  if (!base) return '';
  return base.endsWith('/') ? base : `${base}/`;
}

export function publicUrl(path) {
  const normalized = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}

/** Base URL des vidéos (GM Drone en prod, assets locaux en dev). */
export function getVideoBaseUrl() {
  const external = import.meta.env.VITE_VIDEO_BASE_URL?.trim();
  if (external) return normalizeBase(external);
  return publicUrl('assets/videos/');
}

export function videoUrl(filename) {
  const name = filename.replace(/^\/+/, '').replace(/^assets\/videos\//, '');
  return `${getVideoBaseUrl()}${name}`;
}

export function isAbsoluteMediaUrl(url) {
  return /^https?:\/\//i.test(url ?? '');
}

/** Vidéos hébergées sur GM Drone (URL complètes). */
export const REMOTE_VIDEOS = {
  'casque-pov': 'https://gm-drone.fr/HELMET.mp4',
  perche: 'https://gm-drone.fr/PercheVR360.mp4',
  drone: 'https://gm-drone.fr/DRONE.mp4',
};

export function isCrossOriginVideo(url) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function applyVideoCrossOrigin(video, url) {
  if (!video || !url) return;
  if (isCrossOriginVideo(url)) {
    video.crossOrigin = 'anonymous';
  } else {
    video.removeAttribute('crossorigin');
  }
}
