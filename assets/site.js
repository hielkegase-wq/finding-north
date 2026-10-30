/* Finding North - theme switch, navigation and photo viewer */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'finding-north-theme';
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  // ---------- Light / dark theme: follows the system until the visitor chooses ----------

  var toggle = document.querySelector('.theme-toggle');

  function currentTheme() {
    var chosen = root.getAttribute('data-theme');
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return systemDark.matches ? 'dark' : 'light';
  }

  function updateToggle() {
    if (!toggle) return;
    var dark = currentTheme() === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.title = dark ? 'Light theme' : 'Dark theme';
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked: the choice lasts for this visit */ }
      updateToggle();
    });
  }
  if (systemDark.addEventListener) systemDark.addEventListener('change', updateToggle);
  updateToggle();

  // ---------- Smooth scrolling for links within the page, switched on once the page has opened ----------

  function ready() { window.setTimeout(function () { root.classList.add('is-ready'); }, 300); }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);

  // ---------- Dropdown menus close after a link is chosen ----------

  Array.prototype.forEach.call(document.querySelectorAll('.has-menu'), function (item) {
    item.addEventListener('click', function (event) {
      if (!event.target.closest('a')) return;
      item.classList.add('is-closed');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    item.addEventListener('mouseleave', function () { item.classList.remove('is-closed'); });
    item.addEventListener('focusin', function () { item.classList.remove('is-closed'); });
  });

  // ---------- Photo viewer ----------

  var viewer = document.querySelector('.lightbox');
  if (viewer && typeof viewer.showModal === 'function') {
    var viewerImg = viewer.querySelector('img');
    var viewerCap = viewer.querySelector('.lightbox-cap');
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[data-lightbox]');
      if (!link) return;
      event.preventDefault();
      var img = link.querySelector('img');
      viewerImg.src = link.getAttribute('href');
      viewerImg.alt = img ? img.alt : '';
      viewerCap.textContent = link.getAttribute('data-caption') || '';
      viewer.showModal();
    });
    viewer.addEventListener('click', function () { viewer.close(); });
    viewer.addEventListener('close', function () { viewerImg.removeAttribute('src'); });
  }
})();
