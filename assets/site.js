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

  // ---------- Mark the chapter that is on screen in the navigation bar ----------

  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('.nav-link[data-target]'), function (a) {
    links[a.getAttribute('data-target')] = a;
  });
  var current = null;
  function setCurrent(id) {
    if (id === current) return;
    if (current && links[current]) links[current].classList.remove('is-current');
    current = id;
    if (id && links[id]) links[id].classList.add('is-current');
  }
  var parts = document.querySelectorAll('[data-part]');
  if ('IntersectionObserver' in window && parts.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) setCurrent(entry.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Array.prototype.forEach.call(parts, function (part) { observer.observe(part); });
    var cover = document.getElementById('top');
    if (cover) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) setCurrent(null);
      }, { rootMargin: '-35% 0px -60% 0px' }).observe(cover);
    }
  }

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
