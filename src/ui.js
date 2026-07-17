import { playCue, setSoundEnabled, isSoundEnabled } from './sounds.js';
import { applyVideoCrossOrigin, videoUrl, REMOTE_VIDEOS } from './paths.js';

export const VIEWPOINTS = {
  'casque-pov': {
    id: 'casque-pov',
    label: 'POV Cavalier',
    preview: videoUrl('casque-pov-preview.mp4'),
    immersion: REMOTE_VIDEOS['casque-pov'],
  },
  perche: {
    id: 'perche',
    label: 'Vue Perche',
    preview: videoUrl('perche-preview.mp4'),
    immersion: REMOTE_VIDEOS.perche,
  },
  drone: {
    id: 'drone',
    label: 'Vue Drone',
    preview: videoUrl('drone.mp4'),
    immersion: REMOTE_VIDEOS.drone,
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

  cards.forEach((card) => {
    const vp = VIEWPOINTS[card.dataset.id];
    const video = card.querySelector('.card__video');
    if (!video || !vp?.preview) return;
    video.src = vp.preview;
    applyVideoCrossOrigin(video, vp.preview);
  });

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

  function stopAllPreviews() {
    cards.forEach(stopPreview);
  }

  function handleLaunch() {
    stopAllPreviews();
    onLaunchVR?.(selectedId);
    setTimeout(() => playCue('start'), 0);
  }

  if (mobile) {
    launchBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLaunch();
    }, { passive: false });
  } else {
    launchBtn.addEventListener('click', handleLaunch);
  }

  if (!mobile) {
    document.getElementById('btn-infos')?.addEventListener('click', () => {
      playCue('info');
      alert('VR Show — Sortie équestre immersive à 360°\n\nChoisissez un point de vue puis lancez l\'expérience VR.');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      const enabled = !isSoundEnabled();
      setSoundEnabled(enabled);
      playCue(enabled ? 'toggle-on' : 'toggle-off');
      alert(`Son ${enabled ? 'activé' : 'désactivé'}`);
    });
  }

  document.querySelectorAll('.bottom-bar__side, .launch-btn, .chip').forEach((el) => {
    el.addEventListener('mouseenter', () => playCue('hover', { volume: 0.25 }));
  });

  return {
    getSelectedViewpoint: () => selectedId,
    stopAllPreviews,
    hide: () => {
      stopAllPreviews();
      ui.classList.add('hidden');
    },
    show: () => {
      ui.classList.remove('hidden', 'is-exiting');
    },
    selectViewpoint,
  };
}
