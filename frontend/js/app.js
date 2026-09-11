(() => {
  const API_BASE = window.ICONVEX_API_BASE;
  const { t } = window.ICONVEX_I18N;

  // What the language-dependent parts of the UI are currently showing. Their
  // text is written by JavaScript, so switching language has to redraw them --
  // otherwise whatever is already on screen stays frozen in the old language.
  const shown = {
    dropzone: { kind: 'idle' },  // 'idle' | 'invalid' | 'file'
    file: null,                  // { name, sizeMb }
    chip: null,                  // key into CHIP_META
    status: null,                // { key, args } or { raw }
  };

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
  const footerCopy = document.getElementById('footer-copy');

  // -- State --------------------------------------------------------------
  let pollTimer = null;
  let currentXhr = null;
  let currentDownloadUrl = null;

  const CHIP_META = {
    uploading: { key: 'chipUploading', className: 'chip-uploading' },
    queued: { key: 'chipQueued', className: 'chip-pending' },
    converting: { key: 'chipConverting', className: 'chip-converting' },
    complete: { key: 'chipComplete', className: 'chip-complete' },
    error: { key: 'chipError', className: 'chip-error' },
  };

  /**
   * Redraws every piece of text this script owns, in the active language.
   * Called on load and again whenever the visitor switches language.
   */
  function renderLanguage() {
    footerCopy.textContent = t('footer', new Date().getFullYear());

    if (shown.dropzone.kind === 'idle') {
      dropzoneTitle.textContent = t('dropTitle');
      dropzoneSubtitle.textContent = t('dropSubtitle');
    } else if (shown.dropzone.kind === 'invalid') {
      dropzoneTitle.textContent = t('invalidTitle');
      dropzoneSubtitle.textContent = t('invalidSubtitle');
    } else if (shown.file) {
      dropzoneTitle.textContent = shown.file.name;
      dropzoneSubtitle.textContent = t('megabytes', shown.file.sizeMb);
    }

    if (shown.chip) statusChip.textContent = t(CHIP_META[shown.chip].key);

    if (shown.status) {
      // Errors reported by the server are passed through as they arrive; only
      // the messages this page authors itself can be translated.
      statusMessage.textContent = shown.status.raw ?? t(shown.status.key, ...(shown.status.args || []));
    }
  }

  /** Records what the status line should say, then draws it. */
  function setStatus(keyOrRaw, { raw = false, args = [] } = {}) {
    shown.status = raw ? { raw: keyOrRaw } : { key: keyOrRaw, args };
    renderLanguage();
  }

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
    shown.chip = status;
    statusChip.textContent = t(meta.key);
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
    shown.dropzone = { kind: 'idle' };
    shown.file = null;
    renderLanguage();
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
      shown.dropzone = { kind: 'invalid' };
      renderLanguage();
      setTimeout(() => {
        dropzone.classList.remove('dropzone-error');
        shown.dropzone = { kind: 'idle' };
        renderLanguage();
      }, 2200);
      return;
    }

    dropzoneButton.classList.add('hidden');
    dropzoneIcon.textContent = 'description';
    shown.dropzone = { kind: 'file' };
    shown.file = { name: file.name, sizeMb: (file.size / 1024 / 1024).toFixed(2) };
    renderLanguage();

    fileNameEl.textContent = file.name;
    showStatusPanel();
    setChip('uploading');
    setPipelineStage('uploading');
    setStatus('statusUploading');
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
        showError(
          body && body.error
            ? { raw: body.error }
            : { key: 'statusServerResponded', args: [xhr.status] }
        );
        return;
      }

      progressBar.classList.add('progress-indeterminate');
      setChip('converting');
      setPipelineStage('converting');
      setStatus('statusConverting');
      pollJob(body.jobId);
    });

    xhr.addEventListener('error', () => {
      currentXhr = null;
      showError({ key: 'statusServerUnreachable', args: [API_BASE] });
    });

    xhr.addEventListener('abort', () => {
      currentXhr = null;
    });

    xhr.send(formData);
  }

  // The server can stop answering for a while — a restart, a cold start on a
  // free instance, a saturated CPU — while the conversion itself is still on
  // track. Giving up on the first failed poll reported an error for jobs that
  // went on to finish, so transient failures are now tolerated for a while.
  const MAX_TRANSIENT_POLL_FAILURES = 40; // ~60s at 1.5s between polls

  function pollJob(jobId) {
    stopPolling();
    let transientFailures = 0;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);

        // A job the server no longer knows about is gone for good: the queue
        // lives in memory, so a restart takes it along. Retrying cannot help.
        if (res.status === 404) {
          stopPolling();
          showError({ key: 'statusJobLost' });
          return;
        }

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}.`);
        }

        const job = await res.json();
        transientFailures = 0;

        if (job.status === 'complete') {
          stopPolling();
          currentDownloadUrl = `${API_BASE}${job.downloadUrl}`;
          showComplete(currentDownloadUrl);
        } else if (job.status === 'error') {
          stopPolling();
          showError(job.error ? { raw: job.error } : { key: 'statusConversionFailed' });
        }
        // 'queued' / 'converting' -> keep polling
      } catch (err) {
        transientFailures += 1;

        if (transientFailures >= MAX_TRANSIENT_POLL_FAILURES) {
          stopPolling();
          showError({ key: 'statusUnreachable' });
          return;
        }

        setStatus('statusRetrying');
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
    setStatus('statusComplete');
    downloadLink.href = downloadUrl;
    downloadLink.classList.remove('hidden');
    resetButton.classList.remove('hidden');
  }

  /**
   * Shows a failure. Takes a descriptor rather than a finished string so the
   * message can be redrawn if the visitor switches language afterwards:
   * `{ key, args }` for text this page owns, `{ raw }` for a message the server
   * sent, which is passed through untranslated.
   */
  function showError(status) {
    setChip('error');
    setPipelineStage('error');
    progressBar.classList.remove('progress-indeterminate');
    progressBar.style.width = '100%';

    if (status.raw !== undefined) {
      setStatus(status.raw, { raw: true });
    } else {
      setStatus(status.key, { args: status.args || [] });
    }

    resetButton.classList.remove('hidden');
    downloadLink.classList.add('hidden');
  }

  // -- Wiring ---------------------------------------------------------------

  // Redraw everything this script owns whenever the visitor switches language,
  // then draw it once now for the initial render.
  window.ICONVEX_I18N.onChange(renderLanguage);
  renderLanguage();


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
