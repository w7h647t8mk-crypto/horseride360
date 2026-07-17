import * as THREE from 'three';

const STORAGE_KEY = 'vrshow:gyro-enabled';

const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

export function createGyroControls({ onOrientation, isBlocked, onActiveChange }) {
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

  function orientationToLonLat(event) {
    const alpha = THREE.MathUtils.degToRad(event.alpha ?? 0);
    const beta = THREE.MathUtils.degToRad(event.beta ?? 0);
    const gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
    const orient = THREE.MathUtils.degToRad(
      screen.orientation?.angle ?? window.orientation ?? 0
    );

    euler.set(beta, alpha, -gamma, 'YXZ');

    const q = new THREE.Quaternion().setFromEuler(euler);
    q.multiply(q1);
    q.multiply(q0.setFromAxisAngle(zee, -orient));

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const latDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)));
    const lonDeg = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));

    return { lon: lonDeg, lat: clampLat(latDeg) };
  }

  function handleOrientation(event) {
    if (!enabled || !listening || isBlocked?.()) return;
    if (event.alpha == null && event.beta == null) return;

    const { lon: targetLon, lat: targetLat } = orientationToLonLat(event);
    const adjustedLon = targetLon + offsetLon;
    const adjustedLat = clampLat(targetLat + offsetLat);

    if (!calibrated) {
      smoothLon = adjustedLon;
      smoothLat = adjustedLat;
      calibrated = true;
    } else {
      smoothLon += (adjustedLon - smoothLon) * 0.2;
      smoothLat += (adjustedLat - smoothLat) * 0.2;
    }

    onOrientation(smoothLon, smoothLat);
  }

  function attachListeners() {
    if (listening) return;
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    listening = true;
  }

  function detachListeners() {
    if (!listening) return;
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    listening = false;
  }

  function markActive(active) {
    onActiveChange?.(active);
  }

  function startListening() {
    attachListeners();
    enabled = true;
    calibrated = false;
    localStorage.setItem(STORAGE_KEY, 'true');
    markActive(true);
    return true;
  }

  /** iOS exige requestPermission() dans la pile synchrone du geste utilisateur. */
  function enableFromGesture(onResult) {
    if (typeof DeviceOrientationEvent === 'undefined') {
      onResult?.(false, 'unsupported');
      return false;
    }

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            onResult?.(startListening(), 'granted');
          } else {
            onResult?.(false, 'denied');
          }
        })
        .catch(() => onResult?.(false, 'denied'));
      return true;
    }

    onResult?.(startListening(), 'granted');
    return true;
  }

  function disable() {
    enabled = false;
    calibrated = false;
    detachListeners();
    localStorage.setItem(STORAGE_KEY, 'false');
    markActive(false);
  }

  function isEnabled() {
    return enabled;
  }

  function isListening() {
    return listening;
  }

  function addOffset(deltaLon, deltaLat) {
    offsetLon -= deltaLon;
    offsetLat += deltaLat;
    offsetLat = clampLat(offsetLat);
  }

  function resetOffset() {
    offsetLon = 0;
    offsetLat = 0;
    calibrated = false;
  }

  return {
    enableFromGesture,
    disable,
    isEnabled,
    isListening,
    addOffset,
    resetOffset,
  };
}
