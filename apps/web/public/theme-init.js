// Applies the saved or system color mode before React loads, so there is no
// flash of the wrong theme. Kept as a file (not inline) for a strict CSP.
(function () {
  var mode = null;
  try {
    mode = localStorage.getItem('codesnip:color-mode');
  } catch {
    // storage blocked: fall back to the system preference
  }
  if (mode !== 'light' && mode !== 'dark') {
    mode =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  }
  document.documentElement.classList.add(mode);
  document.documentElement.style.colorScheme = mode;
})();
