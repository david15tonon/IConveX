// Language switching for IConveX.
//
// Both languages ship in the page: static text sits in paired .en-text /
// .fr-text elements that CSS shows or hides, and text the app writes at runtime
// comes from the dictionary below. Switching only toggles a class on <html>, so
// there is no reload and no second URL to keep in sync.
//
// English is the default. A visitor's choice is remembered in localStorage.
(() => {
  const STORAGE_KEY = 'iconvex-language';
  const DEFAULT_LANGUAGE = 'en';
  const SUPPORTED = ['en', 'fr'];

  const STRINGS = {
    en: {
      dropTitle: 'Drop your IFC file here',
      dropSubtitle: 'Drag and drop, or click to browse your files',
      invalidTitle: 'Unsupported file type',
      invalidSubtitle: 'Only .ifc files are accepted. Please try again.',
      megabytes: (mb) => `${mb} MB`,

      chipUploading: 'Uploading',
      chipQueued: 'Queued',
      chipConverting: 'Converting',
      chipComplete: 'Done',
      chipError: 'Error',

      statusUploading: 'Sending the file to the server…',
      statusConverting: 'Converting IFC to XKT…',
      statusComplete: 'Conversion finished. Your .xkt file is ready.',
      statusJobLost: 'The server lost this job — it most likely restarted. Please convert again.',
      statusUnreachable: 'The server has stopped responding. Try again in a moment — it may be restarting.',
      statusRetrying: 'The server is not responding right now — the conversion continues, retrying…',
      statusConversionFailed: 'The conversion failed.',
      statusServerUnreachable: (base) => `Could not reach the server (${base}). Is it running?`,
      statusServerResponded: (code) => `The server responded with code ${code}.`,

      footer: (year) => `© ${year} IConveX. Free and open source — BIM automation.`,
      switchLabel: 'Passer en français',
    },

    fr: {
      dropTitle: 'Déposez votre fichier IFC',
      dropSubtitle: 'Glissez-déposez, ou cliquez pour parcourir vos fichiers',
      invalidTitle: 'Type de fichier invalide',
      invalidSubtitle: 'Seuls les fichiers .ifc sont acceptés. Réessayez.',
      megabytes: (mb) => `${mb} Mo`,

      chipUploading: 'Envoi en cours',
      chipQueued: 'En attente',
      chipConverting: 'Conversion en cours',
      chipComplete: 'Terminé',
      chipError: 'Erreur',

      statusUploading: 'Envoi du fichier vers le serveur…',
      statusConverting: 'Conversion IFC → XKT en cours…',
      statusComplete: 'Conversion terminée. Votre fichier .xkt est prêt.',
      statusJobLost: 'Le serveur a perdu ce job — il a sans doute redémarré. Relancez la conversion.',
      statusUnreachable: 'Le serveur ne répond plus. Réessayez dans un instant — il redémarre peut-être.',
      statusRetrying: 'Le serveur ne répond pas pour le moment — la conversion se poursuit, nouvelle tentative…',
      statusConversionFailed: 'La conversion a échoué.',
      statusServerUnreachable: (base) => `Impossible de joindre le serveur (${base}). Est-il démarré ?`,
      statusServerResponded: (code) => `Le serveur a répondu avec le code ${code}.`,

      footer: (year) => `© ${year} IConveX. Projet open source, gratuit — automatisation BIM.`,
      switchLabel: 'Switch to English',
    },
  };

  let current = DEFAULT_LANGUAGE;

  function read() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(saved) ? saved : null;
    } catch {
      // Private browsing and blocked site data both throw here. English stands.
      return null;
    }
  }

  function persist(language) {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Remembering the choice is a convenience, never a requirement.
    }
  }

  /**
   * Looks a string up in the active language, calling it with `args` when the
   * entry is a function. Falls back to English so a missing translation shows
   * readable text rather than a key.
   */
  function t(key, ...args) {
    const entry = STRINGS[current][key] ?? STRINGS[DEFAULT_LANGUAGE][key];
    return typeof entry === 'function' ? entry(...args) : entry;
  }

  function applyLanguage(language, { persist: shouldPersist = true } = {}) {
    current = SUPPORTED.includes(language) ? language : DEFAULT_LANGUAGE;

    const html = document.documentElement;
    html.lang = current;
    html.classList.toggle('lang-en', current === 'en');
    html.classList.toggle('lang-fr', current === 'fr');

    const button = document.getElementById('lang-switch');
    if (button) {
      button.textContent = current === 'en' ? 'FR' : 'EN';
      button.setAttribute('aria-label', t('switchLabel'));
      button.setAttribute('lang', current === 'en' ? 'fr' : 'en');
    }

    if (shouldPersist) persist(current);

    // Anything already on screen has to be redrawn in the new language.
    document.dispatchEvent(new CustomEvent('iconvex:language', { detail: current }));
  }

  window.ICONVEX_I18N = {
    t,
    getLanguage: () => current,
    applyLanguage,
    onChange(handler) {
      document.addEventListener('iconvex:language', (event) => handler(event.detail));
    },
  };

  // The button is hidden in the markup and revealed here: without JavaScript a
  // switch that cannot work should not be offered at all.
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('lang-switch');
    if (button) {
      button.hidden = false;
      button.addEventListener('click', () => {
        applyLanguage(current === 'en' ? 'fr' : 'en');
      });
    }
    applyLanguage(read() ?? DEFAULT_LANGUAGE, { persist: false });
  });
})();
