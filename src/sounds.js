import { createUISFX } from 'uisfx';

let player = null;
let unlocked = false;
let pendingWelcome = false;

export function initSounds() {
  if (player) return player;

  player = createUISFX({
    pack: 'glass',
    volume: 0.5,
    preferences: { key: 'vrshow:sound-enabled' },
  });

  return player;
}

export function markWelcomeSound() {
  pendingWelcome = true;
}

export function unlockSounds() {
  if (!player || unlocked) return;
  unlocked = true;
  player.unlock();
  if (pendingWelcome) {
    pendingWelcome = false;
    player.play('complete');
  }
}

export function playCue(cue, options) {
  if (!player) initSounds();
  unlockSounds();
  return player?.play(cue, options);
}

export function setSoundEnabled(enabled) {
  if (!player) initSounds();
  player?.setEnabled(enabled);
}

export function isSoundEnabled() {
  return player?.isEnabled() ?? true;
}
