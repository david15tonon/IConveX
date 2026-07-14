(() => {
  const API_BASE = window.ICONVEX_API_BASE;

  // -- DOM references ---------------------------------------------------
  const dropzone = document.getElementById('dropzone');
  const dropzoneIcon = document.getElementById('dropzone-icon');
  const dropzoneTitle = document.getElementById('dropzone-title');
  const dropzoneSubtitle = document.getElementById('dropzone-subtitle');
  const dropzoneButton = document.getElementById('dropzone-button');
  const fileInput = document.getElementById('file-input');

  const statusPanel = document.getElementById('status-panel');
  const fileNameEl = document.getElementById('file-name');
  const statusChip = document.getElementById('status-chip');
  const progressBar = document.getElementById('progress-bar');
  const statusMessage = document.getElementById('status-message');
  const downloadLink = document.getElementById('download-link');
  const resetButton = document.getElementById('reset-button');

  const nodeInput = document.getElementById('node-input');
  const nodeEngine = document.getElementById('node-engine');
  const nodeEngineIcon = document.getElementById('node-engine-icon');
  const nodeEnginePulse = document.getElementById('node-engine-pulse');
  const nodeEngineLabel = document.getElementById('node-engine-label');
  const nodeOutput = document.getElementById('node-output');

  document.getElementById('footer-github-link').href = window.ICONVEX_GITHUB_URL;
  document.getElementById('nav-github-link').href = window.ICONVEX_GITHUB_URL;
  document.getElementById('footer-copy').textContent =
    `© ${new Date().getFullYear()} IConveX. Projet open source, gratuit — automatisation BIM.`;

  // -- State --------------------------------------------------------------
  let pollTimer = null;
  let currentXhr = null;
  let currentDownloadUrl = null;

  const CHIP_META = {
    uploading: { label: 'Envoi en cours', className: 'chip-uploading' },
    queued: { label: 'En attente', className: 'chip-pending' },
    converting: { label: 'Conversion en cours', className: 'chip-converting' },
    complete: { label: 'Terminé', className: 'chip-complete' },
    error: { label: 'Erreur', className: 'chip-error' },
  };

  // -- Helpers --------------------------------------------------------------

  function resetPipeline() {
    [nodeInput, nodeEngine, nodeOutput].forEach((n) => {
      n.classList.remove('is-active', 'is-complete', 'is-error');
    });
    nodeEngineIcon.classList.remove('text-primary', 'text-on-tertiary-fixed-variant', 'text-error');
    nodeEngineIcon.classList.add('text-on-surface-variant');
    nodeEngineLabel.classList.remove('text-primary', 'text-error');
    nodeEngineLabel.classList.add('text-on-surface-variant');
    nodeEnginePulse.classList.add('hidden');
  }

  function setChip(status) {
    const meta = CHIP_META[status];
    statusChip.textContent = meta.label;
    statusChip.className = `chip shrink-0 ml-3 ${meta.className}`;
  }

  function setPipelineStage(stage) {
    // stage: 'uploading' | 'converting' | 'complete' | 'error'
    resetPipeline();

    if (stage === 'uploading') {
      nodeInput.classList.add('is-active');
    } else if (stage === 'converting') {
      nodeInput.classList.add('is-complete');
      nodeEngine.classList.add('is-active');
      nodeEngineIcon.classList.remove('text-on-surface-variant');
      nodeEngineIcon.classList.add('text-primary');
      nodeEngineLabel.classList.remove('text-on-surface-variant');
      nodeEngineLabel.classList.add('text-primary');
      nodeEnginePulse.classList.remove('hidden');
    } else if (stage === 'complete') {
      nodeInput.classList.add('is-complete');
      nodeEngine.classList.add('is-complete');
      nodeEngineIcon.classList.remove('text-on-surface-variant');
      nodeEngineIcon.classList.add('text-on-tertiary-fixed-variant');
      nodeEngineLabel.classList.remove('text-on-surface-variant');
      nodeOutput.classList.add('is-complete');
    } else if (stage === 'error') {
      nodeEngine.classList.add('is-error');
      nodeEngineIcon.classList.remove('text-on-surface-variant');
      nodeEngineIcon.classList.add('text-error');
      nodeEngineLabel.classList.remove('text-on-surface-variant');
      nodeEngineLabel.classList.add('text-error');
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function showStatusPanel() {
    statusPanel.classList.remove('hidden');
  }

  function resetAll() {
    stopPolling();
    if (currentXhr) {
      currentXhr.abort();
      currentXhr = null;
    }
    currentDownloadUrl = null;

    fileInput.value = '';
    statusPanel.classList.add('hidden');
    dropzone.classList.remove('dropzone-active', 'dropzone-error');
    dropzoneIcon.textContent = 'cloud_upload';
    dropzoneTitle.textContent = 'Déposez votre fichier IFC';
    dropzoneSubtitle.textContent = 'Glissez-déposez, ou cliquez pour parcourir vos fichiers';
    dropzoneButton.classList.remove('hidden');
    downloadLink.classList.add('hidden');
    resetButton.classList.add('hidden');
    progressBar.classList.remove('progress-indeterminate');
    progressBar.style.width = '0%';
    resetPipeline();
  }

  function isIfcFile(file) {
    return file && file.name.toLowerCase().endsWith('.ifc');
  }

  // -- Upload + polling ---------------------------------------------------

  function handleFile(file) {
    if (!isIfcFile(file)) {
      dropzone.classList.add('dropzone-error');
      dropzoneTitle.textContent = 'Type de fichier invalide';
      dropzoneSubtitle.textContent = 'Seuls les fichiers .ifc sont acceptés. Réessayez.';
      setTimeout(() => {
        dropzone.classList.remove('dropzone-error');
        dropzoneTitle.textContent = 'Déposez votre fichier IFC';
        dropzoneSubtitle.textContent = 'Glissez-déposez, ou cliquez pour parcourir vos fichiers';
      }, 2200);
      return;
    }

    dropzoneButton.classList.add('hidden');
    dropzoneIcon.textContent = 'description';
    dropzoneTitle.textContent = file.name;
    dropzoneSubtitle.textContent = `${(file.size / 1024 / 1024).toFixed(2)} Mo`;

    fileNameEl.textContent = file.name;
    showStatusPanel();
    setChip('uploading');
    setPipelineStage('uploading');
    statusMessage.textContent = 'Envoi du fichier vers le serveur…';
    progressBar.classList.remove('progress-indeterminate');
    progressBar.style.width = '0%';
    downloadLink.classList.add('hidden');
    resetButton.classList.add('hidden');

    uploadFile(file);
  }

  function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;
    xhr.open('POST', `${API_BASE}/api/convert`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${pct}%`;
      }
    });

    xhr.addEventListener('load', () => {
      currentXhr = null;
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch (e) {
        body = null;
      }

      if (xhr.status !== 202 || !body || !body.jobId) {
        showError((body && body.error) || `Le serveur a répondu avec le code ${xhr.status}.`);
        return;
      }

      progressBar.classList.add('progress-indeterminate');
      setChip('converting');
      setPipelineStage('converting');
      statusMessage.textContent = 'Conversion IFC → XKT en cours…';
      pollJob(body.jobId);
    });

    xhr.addEventListener('error', () => {
      currentXhr = null;
      showError(`Impossible de joindre le serveur (${API_BASE}). Est-il démarré ?`);
    });

    xhr.addEventListener('abort', () => {
      currentXhr = null;
    });

    xhr.send(formData);
  }

  function pollJob(jobId) {
    stopPolling();

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error(`Statut du job introuvable (${res.status}).`);
        }
        const job = await res.json();

        if (job.status === 'complete') {
          stopPolling();
          currentDownloadUrl = `${API_BASE}${job.downloadUrl}`;
          showComplete(currentDownloadUrl);
        } else if (job.status === 'error') {
          stopPolling();
          showError(job.error || 'La conversion a échoué.');
        }
        // 'queued' / 'converting' -> keep polling
      } catch (err) {
        stopPolling();
        showError(err.message || 'Erreur de communication avec le serveur.');
      }
    };

    check();
    pollTimer = setInterval(check, 1500);
  }

  function showComplete(downloadUrl) {
    setChip('complete');
    setPipelineStage('complete');
    progressBar.classList.remove('progress-indeterminate');
    progressBar.style.width = '100%';
    statusMessage.textContent = 'Conversion terminée. Votre fichier .xkt est prêt.';
    downloadLink.href = downloadUrl;
    downloadLink.classList.remove('hidden');
    resetButton.classList.remove('hidden');
  }

  function showError(message) {
    setChip('error');
    setPipelineStage('error');
    progressBar.classList.remove('progress-indeterminate');
    progressBar.style.width = '100%';
    statusMessage.textContent = message;
    resetButton.classList.remove('hidden');
    downloadLink.classList.add('hidden');
  }

  // -- Wiring ---------------------------------------------------------------

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone-active');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Keyboard support: Enter/Space on the label triggers the file picker
  // (native <label for="..."> already handles click, this covers Space).
  dropzone.setAttribute('tabindex', '0');
  dropzone.setAttribute('role', 'button');
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  resetButton.addEventListener('click', resetAll);
})();
