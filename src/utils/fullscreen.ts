/**
 * Fullscreen API Utility
 * Provides cross-browser toggle, status listeners, and error safeguards.
 */

export function toggleFullscreen(targetElement?: HTMLElement | null): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const target = targetElement || document.documentElement;
        if (target.requestFullscreen) {
          target
            .requestFullscreen()
            .then(() => resolve(true))
            .catch(() => resolve(false));
        } else if ((target as any).webkitRequestFullscreen) {
          (target as any).webkitRequestFullscreen();
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        if (document.exitFullscreen) {
          document
            .exitFullscreen()
            .then(() => resolve(false))
            .catch(() => resolve(false));
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
          resolve(false);
        } else {
          resolve(false);
        }
      }
    } catch {
      resolve(false);
    }
  });
}

export function isFullscreen(): boolean {
  return Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement
  );
}

export function onFullscreenChange(callback: (active: boolean) => void): () => void {
  const handler = () => {
    callback(isFullscreen());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
