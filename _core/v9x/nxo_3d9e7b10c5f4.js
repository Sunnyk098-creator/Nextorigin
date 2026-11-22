(function () {
  'use strict';
/* ==========================================================================
   1. MODULAR STRICT NXO PARSER & SECURITY VALIDATORS
   ========================================================================== */
const NXOParser = (() => {
  const SEPARATOR = '-'.repeat(45);
  const EXPECTED_FIELDS = [
    'App name',
    'App logo',
    'App describe',
    'Apk file',
    'Display picture'
  ];

  const SAFE_IMAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp|gif)$/i;
  const SAFE_APK_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.apk$/i;

  function isSafeFilename(name, pattern) {
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..') || trimmed.includes(':')) {
      return false;
    }
    return pattern.test(trimmed);
  }

  function isSafeImage(name) {
    return isSafeFilename(name, SAFE_IMAGE_RE);
  }

  function isSafeApk(name) {
    return isSafeFilename(name, SAFE_APK_RE);
  }

  function logError(type, entryNum, lineNum, expected, actual, extra = '') {
    const parts = [`[ NXO ERROR ] ${type}`];
    if (entryNum !== null && entryNum !== undefined) parts.push(`(App Entry #${entryNum})`);
    if (lineNum !== null && lineNum !== undefined) parts.push(`at line ${lineNum}`);
    let msg = parts.join(' ') + '.';
    if (expected !== undefined && actual !== undefined) {
      msg += ` Expected "${expected}" but received "${actual}".`;
    }
    if (extra) msg += ` ${extra}`;
    console.error(msg);
  }

  function parse(rawText) {
    if (typeof rawText !== 'string') return [];
    const normalized = rawText.replace(/\r\n?/g, '\n');
    const rawLines = normalized.split('\n');

    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      if (trimmed !== '') {
        lines.push({ lineNum: i + 1, text: trimmed });
      }
    }

    if (lines.length === 0) return [];

    const blocks = [];
    let currentLines = [];

    for (const item of lines) {
      if (/^-+$/.test(item.text)) {
        blocks.push({
          lines: currentLines,
          separator: item
        });
        currentLines = [];
      } else {
        currentLines.push(item);
      }
    }

    if (currentLines.length > 0) {
      blocks.push({
        lines: currentLines,
        separator: null
      });
    }

    const validApps = [];
    const seenNames = new Set();

    blocks.forEach((block, idx) => {
      const entryNum = idx + 1;

      if (block.lines.length === 0) {
        logError(
          'Unexpected standalone separator',
          entryNum,
          block.separator ? block.separator.lineNum : null,
          'App entry block starting with "App name :-"',
          block.separator ? block.separator.text : ''
        );
        return;
      }

      if (!block.separator) {
        const lastLine = block.lines[block.lines.length - 1];
        logError(
          'Missing separator',
          entryNum,
          lastLine.lineNum,
          SEPARATOR,
          'End of file (missing separator)'
        );
        return;
      }

      if (block.separator.text !== SEPARATOR) {
        logError(
          'Invalid separator',
          entryNum,
          block.separator.lineNum,
          `${SEPARATOR} (45 hyphens)`,
          `${block.separator.text} (${block.separator.text.length} hyphens)`
        );
        return;
      }

      if (block.lines.length !== EXPECTED_FIELDS.length) {
        const firstLine = block.lines[0];
        logError(
          'Invalid field count',
          entryNum,
          firstLine.lineNum,
          `${EXPECTED_FIELDS.length} fields (${EXPECTED_FIELDS.join(', ')})`,
          `${block.lines.length} field line(s)`
        );
        return;
      }

      const record = {};
      let entryValid = true;

      for (let i = 0; i < EXPECTED_FIELDS.length; i++) {
        const expectedField = EXPECTED_FIELDS[i];
        const expectedPrefix = `${expectedField} :-`;
        const { lineNum, text } = block.lines[i];

        const delimIndex = text.indexOf(':-');
        if (delimIndex === -1) {
          logError('Malformed field syntax', entryNum, lineNum, expectedPrefix, text);
          entryValid = false;
          break;
        }

        const rawKeySegment = text.slice(0, delimIndex);
        if (!rawKeySegment.endsWith(' ') || rawKeySegment.trim() !== rawKeySegment.slice(0, -1)) {
          logError('Invalid field delimiter spacing', entryNum, lineNum, expectedPrefix, `${rawKeySegment}:-`);
          entryValid = false;
          break;
        }

        const actualFieldName = rawKeySegment.slice(0, -1);

        if (i === 0 && actualFieldName !== 'App name') {
          logError('Invalid first field name', entryNum, lineNum, 'App name :-', `${actualFieldName} :-`);
          entryValid = false;
          break;
        }

        if (actualFieldName !== expectedField) {
          const isKnownElsewhere = EXPECTED_FIELDS.includes(actualFieldName);
          const errorType = isKnownElsewhere ? 'Incorrect field order' : 'Invalid field name';
          logError(errorType, entryNum, lineNum, expectedPrefix, `${actualFieldName} :-`);
          entryValid = false;
          break;
        }

        const value = text.slice(delimIndex + 2).trim();
        if (!value) {
          logError(`Missing value for field: ${expectedField}`, entryNum, lineNum, `Non-empty value after "${expectedPrefix}"`, '(empty)');
          entryValid = false;
          break;
        }

        record[expectedField] = { value, lineNum };
      }

      if (!entryValid) return;

      const normalizedAppName = record['App name'].value.toLowerCase();
      if (seenNames.has(normalizedAppName)) {
        logError('Duplicate app entry', entryNum, record['App name'].lineNum, 'Unique App name', record['App name'].value);
        return;
      }

      const logoFile = record['App logo'].value;
      if (!isSafeImage(logoFile)) {
        logError('Invalid App logo filename', entryNum, record['App logo'].lineNum, 'Local image filename (e.g., 1.png)', logoFile);
        return;
      }

      const apkFile = record['Apk file'].value;
      if (!isSafeApk(apkFile)) {
        logError('Invalid Apk file filename', entryNum, record['Apk file'].lineNum, 'Local .apk filename (e.g., demo.apk)', apkFile);
        return;
      }

      const rawPictures = record['Display picture'].value.split(',');
      const pictures = [];
      for (const item of rawPictures) {
        const pic = item.trim();
        if (!pic || !isSafeImage(pic)) {
          logError(
            'Malformed Display picture list',
            entryNum,
            record['Display picture'].lineNum,
            'Comma-separated local image filenames (e.g., home.png, dashboard.png)',
            record['Display picture'].value
          );
          return;
        }
        pictures.push(pic);
      }

      seenNames.add(normalizedAppName);
      validApps.push({
        entryNum,
        name: record['App name'].value,
        logo: logoFile,
        description: record['App describe'].value,
        apk: apkFile,
        pictures
      });
    });

    return validApps;
  }

  return { parse, isSafeImage, isSafeApk };
})();

/* ==========================================================================
   2. NAVIGATION & APPLICATION STATE
   ========================================================================== */
const state = {
  apps: null,
  loadFailed: false,
  currentView: 'home',
  selectedApp: null,
  previewList: [],
  previewIndex: 0
};

const views = {
  home: document.getElementById('homeView'),
  store: document.getElementById('storeView'),
  detail: document.getElementById('detailView')
};

const storeContent = document.getElementById('storeContent');
const storeCount = document.getElementById('storeCount');
const detailContent = document.getElementById('detailContent');
const previewOverlay = document.getElementById('previewOverlay');
const previewImage = document.getElementById('previewImage');

function showView(viewName, scrollTarget = null) {
  state.currentView = viewName;
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('active', key === viewName);
  });

  if (viewName === 'home') {
    if (scrollTarget) {
      const targetEl = document.querySelector(scrollTarget);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    refreshScrollReveals();
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function openAppStore(pushHistory = true) {
  showView('store');
  if (pushHistory) {
    history.pushState({ view: 'store' }, '', '#apps');
  }
  if (state.apps === null && !state.loadFailed) {
    await fetchAndParseApps();
  }
  renderAppStore();
}

function openAppDetail(app, pushHistory = true) {
  state.selectedApp = app;
  showView('detail');
  if (pushHistory) {
    history.pushState({ view: 'detail', appName: app.name }, '', `#app/${encodeURIComponent(app.name)}`);
  }
  renderAppDetail(app);
}

function goHome(scrollTarget = null, pushHistory = true) {
  showView('home', scrollTarget);
  if (pushHistory) {
    history.pushState({ view: 'home' }, '', scrollTarget || '#home');
  }
}

/* ==========================================================================
   3. DATA FETCHING & FILE VERIFICATION
   ========================================================================== */
async function fetchAndParseApps() {
  storeContent.innerHTML = '';
  storeContent.appendChild(createStateBox('Loading applications…', 'Reading Next Origin application catalog.'));

  try {
    const response = await fetch('./app_list.nxo', { cache: 'no-store' });
    if (!response.ok) {
      console.error(`[ NXO ERROR ] Failed to load app_list.nxo (HTTP ${response.status}).`);
      state.apps = [];
      state.loadFailed = false;
      return;
    }
    const rawText = await response.text();
    state.apps = NXOParser.parse(rawText);
    state.loadFailed = false;
  } catch (err) {
    console.error('[ NXO ERROR ] Network or fetch failure while reading app_list.nxo:', err);
    state.apps = [];
    state.loadFailed = true;
  }
}

async function checkFileExists(filename) {
  try {
    const res = await fetch(`./${encodeURIComponent(filename)}`, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    const getRes = await fetch(`./${encodeURIComponent(filename)}`, { cache: 'no-store' });
    return getRes.ok;
  } catch {
    return false;
  }
}

/* ==========================================================================
   4. SAFE DOM RENDERING
   ========================================================================== */
function createStateBox(title, message) {
  const box = document.createElement('div');
  box.className = 'state-box liquid-glass';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('p');
  p.textContent = message;
  box.append(strong, p);
  return box;
}

function createLogoElement(logoFile, appName, wrapClass) {
  const wrap = document.createElement('div');
  wrap.className = wrapClass;

  const img = document.createElement('img');
  img.src = `./${encodeURIComponent(logoFile)}`;
  img.alt = `${appName} logo`;

  img.addEventListener('error', () => {
    console.error(`[ NXO ERROR ] App logo file not found: ${logoFile}.`);
    wrap.innerHTML = '';
    const fallback = document.createElement('span');
    fallback.className = 'app-icon-placeholder';
    fallback.textContent = (appName.slice(0, 2) || 'NO').toUpperCase();
    wrap.appendChild(fallback);
  });

  wrap.appendChild(img);
  return wrap;
}

function renderAppStore() {
  storeContent.innerHTML = '';

  if (state.loadFailed) {
    storeCount.textContent = 'Offline';
    storeContent.appendChild(
      createStateBox(
        'Unable to load applications',
        'The application catalog could not be reached right now. Please check your connection or server setup and try again.'
      )
    );
    return;
  }

  const apps = state.apps || [];
  if (apps.length === 0) {
    storeCount.textContent = '0 apps';
    storeContent.appendChild(
      createStateBox(
        'No Apps Public',
        'There are currently no applications published by Next Origin.'
      )
    );
    return;
  }

  storeCount.textContent = `${apps.length} Application${apps.length === 1 ? '' : 's'}`;

  const grid = document.createElement('div');
  grid.className = 'app-grid';

  apps.forEach((app, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'app-card liquid-glass reveal';
    card.style.setProperty('--delay', `${Math.min(idx, 5) * 60}ms`);

    const top = document.createElement('div');
    top.className = 'app-card-top';

    const iconWrap = createLogoElement(app.logo, app.name, 'app-icon-wrap');

    const meta = document.createElement('div');
    meta.className = 'app-card-meta';
    const title = document.createElement('h3');
    title.textContent = app.name;
    const tag = document.createElement('span');
    tag.className = 'app-card-tag';
    tag.textContent = 'Next Origin Release';
    meta.append(title, tag);

    top.append(iconWrap, meta);

    const desc = document.createElement('p');
    desc.className = 'app-card-desc';
    desc.textContent = app.description;

    const footer = document.createElement('div');
    footer.className = 'app-card-footer';
    const label = document.createElement('span');
    label.textContent = 'Android APK';
    const pill = document.createElement('span');
    pill.className = 'app-card-pill';
    pill.textContent = 'Open Details →';
    footer.append(label, pill);

    card.append(top, desc, footer);
    card.addEventListener('click', () => openAppDetail(app));
    grid.appendChild(card);
    revealObserver.observe(card);
  });

  storeContent.appendChild(grid);
}

function renderAppDetail(app) {
  detailContent.innerHTML = '';

  const hero = document.createElement('div');
  hero.className = 'detail-hero liquid-glass';

  const identity = document.createElement('div');
  identity.className = 'detail-identity';

  const logoBox = createLogoElement(app.logo, app.name, 'detail-logo');

  const titleGroup = document.createElement('div');
  titleGroup.className = 'detail-title-group';
  const h1 = document.createElement('h1');
  h1.textContent = app.name;
  const pub = document.createElement('div');
  pub.className = 'detail-publisher';
  pub.textContent = 'Next Origin Studio';

  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  const b1 = document.createElement('span');
  b1.className = 'badge';
  b1.textContent = 'Android APK';
  const b2 = document.createElement('span');
  b2.className = 'badge';
  b2.textContent = 'Direct Download';
  badges.append(b1, b2);

  titleGroup.append(h1, pub, badges);
  identity.append(logoBox, titleGroup);

  const ctaArea = document.createElement('div');
  ctaArea.className = 'detail-cta-area';

  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'button';
  downloadBtn.href = `./${encodeURIComponent(app.apk)}`;
  downloadBtn.setAttribute('download', app.apk);
  downloadBtn.textContent = 'Download APK ↓';

  const apkNote = document.createElement('span');
  apkNote.className = 'apk-status-note';
  apkNote.style.display = 'none';

  ctaArea.append(downloadBtn, apkNote);
  hero.append(identity, ctaArea);

  checkFileExists(app.apk).then((exists) => {
    if (!exists) {
      console.error(`[ NXO ERROR ] APK file not found: ${app.apk}.`);
      downloadBtn.setAttribute('aria-disabled', 'true');
      downloadBtn.removeAttribute('href');
      downloadBtn.textContent = 'APK Unavailable';
      apkNote.textContent = 'Installation package is currently unavailable.';
      apkNote.style.display = 'block';
    }
  });

  const screensSection = document.createElement('div');
  screensSection.className = 'detail-section liquid-glass';
  const screensHeading = document.createElement('h2');
  screensHeading.textContent = 'Screenshots';

  const strip = document.createElement('div');
  strip.className = 'gallery-strip';

  app.pictures.forEach((picFile, idx) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const img = document.createElement('img');
    const src = `./${encodeURIComponent(picFile)}`;
    img.src = src;
    img.alt = `${app.name} screenshot ${idx + 1}`;
    img.loading = 'lazy';

    let failed = false;
    img.addEventListener('error', () => {
      failed = true;
      console.warn(`[ NXO WARNING ] Screenshot unavailable: ${picFile}.`);
      item.innerHTML = '';
      item.style.cursor = 'default';
      const ph = document.createElement('div');
      ph.className = 'screenshot-placeholder';
      const phTitle = document.createElement('strong');
      phTitle.textContent = 'Preview Unavailable';
      const phSub = document.createElement('span');
      phSub.textContent = `Screenshot ${idx + 1}`;
      ph.append(phTitle, phSub);
      item.appendChild(ph);
    });

    item.addEventListener('click', () => {
      if (failed) return;
      const available = app.pictures
        .map((f) => `./${encodeURIComponent(f)}`)
        .filter((candidate) => {
          const matchingImg = strip.querySelector(`img[src="${candidate}"]`);
          return matchingImg && matchingImg.complete && matchingImg.naturalWidth > 0;
        });
      if (available.length > 0) {
        const startIdx = Math.max(0, available.indexOf(src));
        openPreview(available, startIdx);
      }
    });

    item.appendChild(img);
    strip.appendChild(item);
  });

  screensSection.append(screensHeading, strip);

  const aboutSection = document.createElement('div');
  aboutSection.className = 'detail-section liquid-glass';
  const aboutHeading = document.createElement('h2');
  aboutHeading.textContent = 'About this app';
  const descP = document.createElement('p');
  descP.className = 'detail-description';
  descP.textContent = app.description;
  aboutSection.append(aboutHeading, descP);

  detailContent.append(hero, screensSection, aboutSection);
}

/* ==========================================================================
   5. LIGHTBOX GALLERY PREVIEW
   ========================================================================== */
function openPreview(sources, startIndex) {
  state.previewList = sources;
  state.previewIndex = startIndex;
  updatePreviewImage();
  previewOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updatePreviewImage() {
  if (!state.previewList.length) return;
  previewImage.src = state.previewList[state.previewIndex];
  document.getElementById('previewPrevBtn').disabled = state.previewList.length <= 1;
  document.getElementById('previewNextBtn').disabled = state.previewList.length <= 1;
}

function closePreview() {
  previewOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('previewCloseBtn').addEventListener('click', closePreview);
document.getElementById('previewPrevBtn').addEventListener('click', () => {
  if (!state.previewList.length) return;
  state.previewIndex = (state.previewIndex - 1 + state.previewList.length) % state.previewList.length;
  updatePreviewImage();
});
document.getElementById('previewNextBtn').addEventListener('click', () => {
  if (!state.previewList.length) return;
  state.previewIndex = (state.previewIndex + 1) % state.previewList.length;
  updatePreviewImage();
});
previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) closePreview();
});

/* ==========================================================================
   6. HEADER SCROLL, REVEAL OBSERVER & ROUTING
   ========================================================================== */
const header = document.getElementById('header');
const menuBtn = document.getElementById('menu');
const navlinks = document.getElementById('navlinks');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 18);
}, { passive: true });

menuBtn.addEventListener('click', () => {
  const isOpen = navlinks.classList.toggle('open');
  menuBtn.textContent = isOpen ? '✕' : '☰';
});

function closeMobileMenu() {
  navlinks.classList.remove('open');
  menuBtn.textContent = '☰';
}

document.querySelectorAll('[data-home-link]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    goHome(link.getAttribute('href'));
  });
});

document.getElementById('brandHomeLink').addEventListener('click', (e) => {
  e.preventDefault();
  closeMobileMenu();
  goHome('#home');
});

[
  'heroDownloadBtn',
  'footerDownloadBtn',
  'footerAppsLink'
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      closeMobileMenu();
      openAppStore(true);
    });
  }
});

document.getElementById('storeBackHomeBtn').addEventListener('click', () => goHome('#home', true));
document.getElementById('detailBackStoreBtn').addEventListener('click', () => openAppStore(true));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (previewOverlay.classList.contains('open')) {
      closePreview();
    } else if (state.currentView === 'detail') {
      openAppStore(true);
    } else if (state.currentView === 'store') {
      goHome('#home', true);
    }
  } else if (previewOverlay.classList.contains('open')) {
    if (e.key === 'ArrowLeft') document.getElementById('previewPrevBtn').click();
    if (e.key === 'ArrowRight') document.getElementById('previewNextBtn').click();
  }
});

window.addEventListener('popstate', async () => {
  const hash = window.location.hash;
  if (hash === '#apps') {
    await openAppStore(false);
  } else if (hash.startsWith('#app/')) {
    const requestedName = decodeURIComponent(hash.slice(5));
    if (state.apps === null && !state.loadFailed) {
      await fetchAndParseApps();
    }
    const found = (state.apps || []).find((a) => a.name === requestedName);
    if (found) {
      openAppDetail(found, false);
    } else {
      openAppStore(false);
    }
  } else {
    goHome(hash && hash !== '#home' ? hash : null, false);
  }
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });

function refreshScrollReveals() {
  document.querySelectorAll('.reveal:not(.show)').forEach((el, idx) => {
    el.style.setProperty('--delay', `${Math.min(idx % 4, 3) * 65}ms`);
    revealObserver.observe(el);
  });
}

refreshScrollReveals();
document.getElementById('year').textContent = new Date().getFullYear();

(async function initRoute() {
  const hash = window.location.hash;
  if (hash === '#apps') {
    await openAppStore(false);
  } else if (hash.startsWith('#app/')) {
    const requestedName = decodeURIComponent(hash.slice(5));
    await fetchAndParseApps();
    const found = (state.apps || []).find((a) => a.name === requestedName);
    if (found) {
      openAppDetail(found, false);
    } else {
      renderAppStore();
      showView('store');
    }
  }
})();
  // Ensure reveal observer catches elements immediately upon dynamic bootstrap
  if (typeof refreshScrollReveals === 'function') {
    refreshScrollReveals();
  }
})();
