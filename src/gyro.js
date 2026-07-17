const STORAGE_KEY = 'vrshow:gyro-enabled';

export function createGyroControls({ onOrientation, isBlocked }) {
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  let listening = false;
  let offsetLon = 0;
  let offsetLat = 0;
  let smoothLon = 0;
  let smoothLat = 0;
  let calibrated = false;

  function clampLat(value) {
    return Math.max(-85, Math.min(85, value));
  }

  function handleOrientation(event) {
    if (!enabled || !listening || isBlocked?.()) return;

    const { alpha, beta } = event;
    if (alpha == null || beta == null) return;

    const targetLon = alpha + offsetLon;
    const targetLat = clampLat(beta - 90 + offsetLat);

    if (!calibrated) {
      smoothLon = targetLon;
      smoothLat = targetLat;
      calibrated = true;
    } else {
      smoothLon += (targetLon - smoothLon) * 0.18;
      smoothLat += (targetLat - smoothLat) * 0.18;
    }

    onOrientation(smoothLon, smoothLat);
  }

  async function requestAccess() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        return (await DeviceOrientationEvent.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    }

    return true;
  }

  async function enable() {
    const granted = await requestAccess();
    if (!granted) return false;

    if (!listening) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      listening = true;
    }

    enabled = true;
    calibrated = false;
    localStorage.setItem(STORAGE_KEY, 'true');
    return true;
  }

  function disable() {
    enabled = false;
    localStorage.setItem(STORAGE_KEY, 'false');
  }

  function isEnabled() {
    return enabled;
  }

  function addOffset(deltaLon, deltaLat) {
    offsetLon -= deltaLon;
    offsetLat += deltaLat;
    offsetLat = clampLat(offsetLat);
  }

  function syncOffset(currentLon, currentLat, alpha, beta) {
    if (alpha == null || beta == null) return;
    offsetLon = currentLon - alpha;
    offsetLat = currentLat - (beta - 90);
  }

  function resetOffset() {
    offsetLon = 0;
    offsetLat = 0;
    calibrated = false;
  }

  return {
    enable,
    disable,
    isEnabled,
    addOffset,
    syncOffset,
    resetOffset,
    requestAccess,
  };
}
