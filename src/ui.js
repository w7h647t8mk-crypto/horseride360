import { playCue, setSoundEnabled, isSoundEnabled } from './sounds.js';
import { publicUrl } from './paths.js';

export const VIEWPOINTS = {
  'casque-pov': {
    id: 'casque-pov',
    label: 'POV Cavalier',
    video: publicUrl('assets/videos/casque-pov.mp4'),
  },
  perche: {
    id: 'perche',
    label: 'Vue Perche',
    video: publicUrl('assets/videos/perche.mp4'),
  },
  drone: {
    id: 'drone',
    label: 'Vue Drone',
    video: publicUrl('assets/videos/drone.mp4'),
  },
};

function stopPreview(card) {
  const video = card.querySelector('.card__video');
  card.classList.remove('is-previewing');
  if (!video) return;
  video.pause();
  video.currentTime = 0;
}

function playPreview(card) {
  const video = card.querySelector('.card__video');
  card.classList.add('is-previewing');
  if (!video) return;
  video.play().catch(() => {});
}

export function initUI({ mobile = false, onViewpointChange, onLaunchVR, onToggleGyro, isGyroEnabled }) {
  const ui = document.getElementById('ui');
  const cards = [...document.querySelectorAll('.card')];
  const launchBtn = document.getElementById('launch-btn');

  let selectedId = 'casque-pov';
  let hoverSoundId = null;

  function selectViewpoint(id) {
    if (!VIEWPOINTS[id]) return;
    selectedId = id;
    const vp = VIEWPOINTS[id];

    cards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.id === id);
    });

    onViewpointChange?.({ viewpointId: id, label: vp.label });
    window.dispatchEvent(new CustomEvent('vrshow:viewpoint', { detail: { viewpointId: id, label: vp.label } }));
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      playCue(id === selectedId ? 'press' : 'select');
      selectViewpoint(id);
    });

    card.addEventListener('mouseenter', () => {
      if (hoverSoundId !== card.dataset.id) {
        hoverSoundId = card.dataset.id;
        playCue('hover', { volume: 0.35 });
      }
      cards.forEach((other) => {
        if (other !== card) stopPreview(other);
      });
      playPreview(card);
    });

    card.addEventListener('mouseleave', () => stopPreview(card));

    if (mobile) {
      card.addEventListener('touchstart', () => {
        cards.forEach((other) => {
          if (other !== card) stopPreview(other);
        });
        playPreview(card);
      }, { passive: true });
    }
  });

  launchBtn.addEventListener('click', () => {
    playCue('start');
    onLaunchVR?.(selectedId);
  });

  document.getElementById('btn-infos')?.addEventListener('click', () => {
    playCue('info');
    alert('VR Show — Sortie équestre immersive à 360°\n\nChoisissez un point de vue puis lancez l\'expérience VR.');
  });

  document.getElementById('btn-settings')?.addEventListener('click', async () => {
    if (mobile && onToggleGyro) {
      const soundOn = isSoundEnabled();
      const gyroOn = isGyroEnabled?.() ?? false;
      const choice = prompt(
        `Réglages\n\n1 — Son : ${soundOn ? 'ON' : 'OFF'}\n2 — Gyroscope : ${gyroOn ? 'ON' : 'OFF'}\n\nEntrez 1 ou 2 pour basculer`,
        ''
      );

      if (choice === '1') {
        const enabled = !soundOn;
        setSoundEnabled(enabled);
        playCue(enabled ? 'toggle-on' : 'toggle-off');
      } else if (choice === '2') {
        if (gyroOn) {
          onToggleGyro();
          playCue('toggle-off');
          alert('Gyroscope désactivé.');
        } else {
          alert('Appuyez sur le bouton « Activer le gyroscope » en haut de l\'écran.');
        }
      }
      return;
    }

    const enabled = !isSoundEnabled();
    setSoundEnabled(enabled);
    playCue(enabled ? 'toggle-on' : 'toggle-off');
    alert(`Son ${enabled ? 'activé' : 'désactivé'}`);
  });

  document.querySelectorAll('.bottom-bar__side, .launch-btn, .chip').forEach((el) => {
    el.addEventListener('mouseenter', () => playCue('hover', { volume: 0.25 }));
  });

  return {
    getSelectedViewpoint: () => selectedId,
    hide: () => {
      cards.forEach(stopPreview);
      ui.classList.add('hidden');
    },
    show: () => ui.classList.remove('hidden'),
    selectViewpoint,
  };
}
