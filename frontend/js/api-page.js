// The small amount of scripting the API reference needs.
//
// app.js is not loaded here: it drives the converter widget, which this page
// does not have. Only the pieces shared with every page live here — the GitHub
// links and the localised footer.
(() => {
  const { t } = window.ICONVEX_I18N;

  document.getElementById('footer-github-link').href = window.ICONVEX_GITHUB_URL;
  document.getElementById('nav-github-link').href = window.ICONVEX_GITHUB_URL;

  const footerCopy = document.getElementById('footer-copy');

  function renderLanguage() {
    footerCopy.textContent = t('footer', new Date().getFullYear());
  }

  window.ICONVEX_I18N.onChange(renderLanguage);
  renderLanguage();
})();
