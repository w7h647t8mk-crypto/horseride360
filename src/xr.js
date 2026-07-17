import { VRButton } from 'three/addons/webxr/VRButton.js';

export function setupWebXR(renderer, { onSessionStart, onSessionEnd } = {}) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const button = VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'hand-tracking'],
  });
  button.id = 'vr-button';
  button.style.display = 'none';
  document.body.appendChild(button);

  renderer.xr.addEventListener('sessionstart', () => onSessionStart?.());
  renderer.xr.addEventListener('sessionend', () => onSessionEnd?.());

  return button;
}

export function launchVR() {
  const btn = document.getElementById('vr-button');
  if (btn && !btn.disabled) btn.click();
}
