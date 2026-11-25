document.documentElement.classList.add('js');

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Theme Toggle ---------- */

const THEME_KEY = 'cv-landing-theme';
const themeToggle = document.getElementById('theme-toggle');
const themeColorMeta = document.getElementById('theme-color-meta');

const applyTheme = (theme, persist) => {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b0c12' : '#fcfbfe');
  }
  if (themeToggle) {
    const next = theme === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
    themeToggle.setAttribute('title', `Switch to ${next} mode`);
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be blocked in private contexts.
    }
  }
};

applyTheme(document.documentElement.getAttribute('data-theme') || 'dark', false);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark', true);
  });
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    try {
      if (localStorage.getItem(THEME_KEY)) return;
    } catch {
      return;
    }
    applyTheme(event.matches ? 'dark' : 'light', false);
  });
}

/* ---------- Header Scroll, Progress & Active Nav ---------- */

const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const scrollProgressBar = document.getElementById('scroll-progress');
const heroStage = document.getElementById('hero-stage');

const navLinks = Array.from(document.querySelectorAll('.nav-desktop a[href^="#"]'));
const trackedSections = navLinks
  .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
  .filter((item) => item.section);

let scrollRaf = 0;
const updateScrollEffects = () => {
  scrollRaf = 0;
  const y = window.scrollY;
  if (header) {
    header.classList.toggle('scrolled', y > 10);
  }
  if (y < 140) {
    for (const { link } of trackedSections) link.classList.remove('is-active');
  }
  if (scrollProgressBar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    scrollProgressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }
  if (heroStage && !reducedMotion && window.innerWidth > 1024) {
    const shift = Math.min(16, y * 0.04);
    heroStage.style.setProperty('--hero-shift', `${(-shift).toFixed(1)}px`);
  }
};

window.addEventListener(
  'scroll',
  () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScrollEffects);
  },
  { passive: true }
);
window.addEventListener('resize', updateScrollEffects, { passive: true });
updateScrollEffects();

if ('IntersectionObserver' in window && trackedSections.length > 0) {
  const activeObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          for (const { link, section } of trackedSections) {
            link.classList.toggle('is-active', section === entry.target);
          }
        }
      }
    },
    { rootMargin: '-28% 0px -56% 0px', threshold: 0 }
  );
  trackedSections.forEach(({ section }) => activeObserver.observe(section));
}

const setMenuOpen = (open) => {
  if (!menuToggle || !mobileMenu || !header) return;
  mobileMenu.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  header.classList.toggle('menu-open', open);
};

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    setMenuOpen(!isOpen);
  });

  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileMenu.hidden) {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860 && !mobileMenu.hidden) setMenuOpen(false);
  });
}

/* ---------- Choreographed Scroll Reveals ---------- */

const revealEls = Array.from(document.querySelectorAll('.reveal'));

for (const el of revealEls) {
  const step = Number(el.dataset.stagger);
  if (step > 0) {
    const children = el.querySelectorAll('.reveal-child');
    children.forEach((child, idx) => {
      child.style.setProperty('--reveal-delay', `${idx * step}ms`);
    });
  }
}

const revealAboveFold = () => {
  const cutoff = window.innerHeight * 0.92;
  for (const el of revealEls) {
    if (!el.classList.contains('is-visible') && el.getBoundingClientRect().top < cutoff) {
      el.classList.add('is-visible');
    }
  }
};

if (!reducedMotion && 'IntersectionObserver' in window && revealEls.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
  revealAboveFold();
  window.addEventListener('hashchange', () => setTimeout(revealAboveFold, 60));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

/* ---------- Accessible Tablist Helper ---------- */

const bindTablist = (tablist, onSelect) => {
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

  const select = (tab, moveFocus) => {
    for (const t of tabs) {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    }
    if (moveFocus) tab.focus();
    if (onSelect) onSelect(tab);
  };

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab, false);
  });

  tablist.addEventListener('keydown', (event) => {
    const idx = tabs.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next], true);
  });
};

const stageUrlEl = document.getElementById('stage-url');
bindTablist(document.querySelector('.stage-tabs'), (tab) => {
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  if (panel && stageUrlEl && panel.dataset.url) {
    stageUrlEl.textContent = panel.dataset.url;
  }
});

const loreUrlEl = document.getElementById('lore-url');
bindTablist(document.querySelector('.lore-view-switch'), (tab) => {
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  if (panel && loreUrlEl && panel.dataset.url) {
    loreUrlEl.textContent = panel.dataset.url;
  }
});

let startAgentDemo = null;
bindTablist(document.querySelector('.ai-tablist'), (tab) => {
  if (tab.id === 'tab-agent' && startAgentDemo) {
    startAgentDemo();
  }
});

const copyCodeBtn = document.getElementById('copy-code-btn');
bindTablist(document.querySelector('.code-tabs'), () => {
  if (copyCodeBtn) copyCodeBtn.textContent = 'Copy';
});

/* ---------- Copy Self-Host Snippet ---------- */

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', async () => {
    const activePanel = document.querySelector('.code-pre:not([hidden])');
    if (!activePanel) return;
    const text = activePanel.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyCodeBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyCodeBtn.textContent = 'Copy';
      }, 1800);
    } catch {
      copyCodeBtn.textContent = 'Select text';
      setTimeout(() => {
        copyCodeBtn.textContent = 'Copy';
      }, 1800);
    }
  });
}

/* ---------- Inline Ghost Preview Demo ---------- */

const ghostDemo = document.getElementById('ghost-demo');
if (ghostDemo) {
  const beforeEl = document.getElementById('ghost-before');
  const targetEl = document.getElementById('ghost-target');
  const afterEl = document.getElementById('ghost-after');
  const opPills = Array.from(ghostDemo.querySelectorAll('.gt-pill[data-op]'));
  const instrEl = document.getElementById('ghost-instr');
  const statusEl = document.getElementById('ghost-status');
  const actionsEl = document.getElementById('ghost-actions');
  const acceptEl = document.getElementById('ghost-accept');
  const nextBtn = document.getElementById('ghost-next');

  const setActiveOp = (opName) => {
    for (const pill of opPills) {
      pill.classList.toggle('gt-active', pill.dataset.op === opName);
    }
  };

  const examples = [
    {
      op: 'Vivid',
      instr: 'Make it more vivid',
      before: 'Nadia checks the airlock seal before every shift. ',
      original: 'She looks tired and has grease on her hands.',
      rewrite: 'Dark circles sit under her eyes, and hydraulic grease stains the knuckles of her work gloves.',
      after: ' She keeps a spare wrench clipped to her belt.',
    },
    {
      op: 'Custom',
      instr: 'Make it more specific',
      before: 'Tomas runs the corner repair shop off Fourth Street. ',
      original: 'He is quiet and careful with machines.',
      rewrite: 'He barely speaks while working, sorting every stripped screw into labeled tin trays.',
      after: ' Most regulars leave their radios on the counter and come back Tuesday.',
    },
    {
      op: 'Enhance',
      instr: 'Add a concrete detail',
      before: 'Hannah keeps a small herb garden on the apartment roof. ',
      original: 'She checks on the plants every morning.',
      rewrite: 'She climbs up before sunrise with a dented watering can, checking the rosemary pots for frost.',
      after: ' The stairwell door sticks when the air turns damp.',
    },
  ];

  let idx = 0;
  let token = 0;
  let active = false;
  const timers = new Set();

  const clearTimers = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };

  const wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.add(id);
    });

  const renderStatic = (ex) => {
    setActiveOp(ex.op);
    instrEl.textContent = ex.instr;
    beforeEl.textContent = ex.before;
    targetEl.className = 'ghost-target is-accepted';
    targetEl.textContent = ex.rewrite;
    afterEl.textContent = ex.after;
    statusEl.textContent = 'Accepted into undo history';
    actionsEl.classList.add('is-shown');
  };

  const playExample = async (myToken) => {
    while (active && myToken === token) {
      const ex = examples[idx];
      setActiveOp(ex.op);
      instrEl.textContent = ex.instr;
      beforeEl.textContent = ex.before;
      afterEl.textContent = ex.after;
      targetEl.className = 'ghost-target';
      targetEl.textContent = ex.original;
      statusEl.textContent = 'Text selected in editor';
      actionsEl.classList.remove('is-shown');
      acceptEl.classList.remove('is-pressed');

      await wait(950);
      if (!active || myToken !== token) return;

      targetEl.classList.add('is-selected');
      statusEl.textContent = `Running ${ex.op}…`;
      await wait(750);
      if (!active || myToken !== token) return;

      targetEl.className = 'ghost-target is-streaming';
      targetEl.textContent = '';
      for (const ch of ex.rewrite) {
        if (!active || myToken !== token) return;
        targetEl.textContent += ch;
        await wait(ch === ' ' ? 36 : 18);
      }

      targetEl.className = 'ghost-target is-ready';
      statusEl.textContent = 'Ghost preview ready';
      actionsEl.classList.add('is-shown');
      await wait(1900);
      if (!active || myToken !== token) return;

      acceptEl.classList.add('is-pressed');
      targetEl.className = 'ghost-target is-accepted';
      statusEl.textContent = 'Edit accepted · Ctrl+Z to undo';
      await wait(1800);
      if (!active || myToken !== token) return;

      idx = (idx + 1) % examples.length;
    }
  };

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      idx = (idx + 1) % examples.length;
      if (reducedMotion) {
        renderStatic(examples[idx]);
      } else {
        token += 1;
        clearTimers();
        active = true;
        playExample(token);
      }
    });
  }

  if (reducedMotion) {
    renderStatic(examples[0]);
  } else if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!active) {
              active = true;
              token += 1;
              playExample(token);
            }
          } else {
            active = false;
            clearTimers();
          }
        }
      },
      { threshold: 0.2 }
    ).observe(ghostDemo);
  } else {
    renderStatic(examples[0]);
  }
}

/* ---------- Agent Run Demo ---------- */

const agentDemo = document.getElementById('agent-demo');
if (agentDemo) {
  const stepsHost = document.getElementById('agent-steps');
  const stateEl = document.getElementById('agent-state');
  const tokensEl = document.getElementById('agent-tokens');
  const replayBtn = document.getElementById('agent-replay');

  const steps = [
    { kind: 'tool', cls: 'step-list', tag: 'audit', text: 'lorebook · 14 entries scanned' },
    { kind: 'tool', cls: 'step-read', tag: 'read', text: 'entry #7 “yard 4”, entry #3 “thruster”' },
    { kind: 'tool', cls: 'step-write', tag: 'write', text: 'rekey #7 → “Orbital Yard 4”' },
    { kind: 'tool', cls: 'step-write', tag: 'write', text: 'rekey #3 → “Thruster Log”' },
    { kind: 'tool', cls: 'step-delete', tag: 'delete', text: 'remove #11 (empty stub)' },
    { kind: 'summary', text: 'Rekeyed two entries to proper nouns and removed the empty stub. No broken recursion links found.' },
    { kind: 'done', text: '3 changes applied · Agentic auto save point created' },
  ];

  const stepNodes = steps.map((step) => {
    if (step.kind === 'tool') {
      const row = document.createElement('div');
      row.className = `agent-step ${step.cls}`;
      row.innerHTML = `<span class="step-tag">${step.tag}</span><span>${step.text}</span>`;
      return row;
    }
    if (step.kind === 'summary') {
      const p = document.createElement('p');
      p.className = 'agent-summary';
      p.textContent = step.text;
      return p;
    }
    const done = document.createElement('span');
    done.className = 'agent-done';
    done.textContent = `✓ ${step.text}`;
    return done;
  });

  stepNodes.forEach((node) => stepsHost.appendChild(node));

  let runId = 0;
  const timers = new Set();

  const stop = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };

  const wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.add(id);
    });

  const showStatic = () => {
    stepNodes.forEach((n) => n.classList.add('is-shown'));
    stateEl.textContent = 'Completed';
    tokensEl.textContent = '1.9k';
  };

  const run = async () => {
    if (reducedMotion) {
      showStatic();
      return;
    }
    stop();
    const currentRun = ++runId;
    stepNodes.forEach((n) => n.classList.remove('is-shown'));
    stateEl.textContent = 'Working…';
    tokensEl.textContent = '1.2k';
    await wait(320);

    for (let i = 0; i < stepNodes.length; i++) {
      if (currentRun !== runId) return;
      stepNodes[i].classList.add('is-shown');
      tokensEl.textContent = `${(1.2 + (i + 1) * 0.1).toFixed(1)}k`;
      if (steps[i].kind === 'done') {
        stateEl.textContent = 'Completed';
      } else {
        await wait(steps[i].kind === 'summary' ? 650 : 480);
      }
    }
  };

  startAgentDemo = run;
  if (replayBtn) replayBtn.addEventListener('click', run);
  if (reducedMotion) showStatic();
}

/* ---------- AI Context Interactive Demo ---------- */

const ctxDemo = document.getElementById('ctx-demo');
if (ctxDemo) {
  const LIMIT = 8192;
  const rows = Array.from(ctxDemo.querySelectorAll('.ctx-row'));
  const tokensEl = document.getElementById('ctx-tokens');
  const barEl = document.getElementById('ctx-bar');
  const countEl = document.getElementById('ctx-count');
  const chipsEl = document.getElementById('ctx-chips');

  const updateCtx = () => {
    let total = 0;
    const selected = [];
    for (const row of rows) {
      const on = row.classList.contains('is-on');
      row.setAttribute('aria-pressed', String(on));
      if (on) {
        total += Number(row.dataset.tokens) || 0;
        selected.push(row);
      }
    }

    const pct = Math.min(100, (total / LIMIT) * 100);
    const status = pct > 75 ? 'danger' : pct > 30 ? 'warning' : 'good';

    tokensEl.textContent = `${total.toLocaleString()} / ${LIMIT.toLocaleString()} tok`;
    tokensEl.dataset.status = status;
    barEl.style.width = `${Math.max(pct, total > 0 ? 3 : 0)}%`;
    barEl.dataset.status = status;
    countEl.textContent = String(selected.length);

    chipsEl.innerHTML = '';
    if (selected.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'ctx-empty';
      empty.textContent = 'No sections pinned. Orion starts with a blank slate.';
      chipsEl.appendChild(empty);
      return;
    }

    for (const row of selected) {
      const label = row.dataset.label || '';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ctx-chip';
      chip.textContent = `${label} ×`;
      chip.setAttribute('aria-label', `Remove ${label} from AI context`);
      chip.addEventListener('click', () => {
        row.classList.remove('is-on');
        updateCtx();
      });
      chipsEl.appendChild(chip);
    }
  };

  rows.forEach((row) => {
    row.addEventListener('click', () => {
      row.classList.toggle('is-on');
      updateCtx();
    });
  });

  updateCtx();
}

const loreEyeCard = document.getElementById('lore-eye-card');
const loreEyeBtn = document.getElementById('lore-eye-btn');
const loreEyeBadge = document.getElementById('lore-eye-badge');

if (loreEyeCard && loreEyeBtn && loreEyeBadge) {
  loreEyeBtn.addEventListener('click', () => {
    const isHidden = loreEyeCard.classList.toggle('is-hidden-entry');
    loreEyeBtn.setAttribute('aria-pressed', String(!isHidden));
    loreEyeBadge.textContent = isHidden ? 'Hidden from AI' : 'Included';
  });
}

/* ---------- Screenshot Lightbox ---------- */

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const stageZoomBtn = document.getElementById('stage-zoom-btn');
const loreZoomBtn = document.getElementById('lore-zoom-btn');

if (lightbox && lightboxImg && lightboxClose) {
  let lastTrigger = null;

  const openLightbox = (img, trigger) => {
    if (!img) return;
    lastTrigger = trigger || img;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    if (lightboxCaption) lightboxCaption.textContent = img.alt;
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
      lightbox.hidden = true;
      lightboxImg.removeAttribute('src');
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }, 180);
  };

  document.querySelectorAll('img.zoomable').forEach((img) => {
    img.addEventListener('click', () => openLightbox(img, img));
  });

  if (stageZoomBtn) {
    stageZoomBtn.addEventListener('click', () => {
      const visibleImg = document.querySelector('.stage-panel:not([hidden]) img');
      openLightbox(visibleImg, stageZoomBtn);
    });
  }

  if (loreZoomBtn) {
    loreZoomBtn.addEventListener('click', () => {
      const visibleImg = document.querySelector('.lore-panel:not([hidden]) img');
      openLightbox(visibleImg, loreZoomBtn);
    });
  }

  lightboxClose.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
}
