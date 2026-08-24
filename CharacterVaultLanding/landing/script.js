document.documentElement.classList.add('js');

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

const toggle = document.querySelector('.nav-toggle');
const navLinks = document.getElementById('nav-links');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealEls = document.querySelectorAll('.reveal');
if (!reducedMotion) {
  document.querySelectorAll('.features-grid, .screenshots-grid').forEach((grid) => {
    grid.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.transitionDelay = `${i * 70}ms`;
    });
  });
}

if ('IntersectionObserver' in window && revealEls.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('visible'));
}

if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });
}

/* ---------- Rotating hero word ---------- */

const heroWord = document.getElementById('heroWord');

if (heroWord && !reducedMotion) {
  const heroWords = ['AI characters', 'lorebooks', 'worlds'];
  let wordIndex = 0;

  setInterval(() => {
    heroWord.classList.add('word-out');
    setTimeout(() => {
      wordIndex = (wordIndex + 1) % heroWords.length;
      heroWord.textContent = heroWords[wordIndex];
      heroWord.classList.add('word-off');
      heroWord.classList.remove('word-out');
      heroWord.classList.add('word-in');
      void heroWord.offsetWidth;
      heroWord.classList.remove('word-off');
      heroWord.classList.remove('word-in');
    }, 320);
  }, 3200);
}

/* ---------- Hero card 3D tilt ---------- */

const heroVisual = document.querySelector('.hero-visual');
const mockStack = heroVisual ? heroVisual.querySelector('.mock-stack') : null;

if (heroVisual && mockStack && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  const MAX_TILT = 8;
  let tiltRaf = 0;

  heroVisual.addEventListener('mousemove', (event) => {
    const rect = heroVisual.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(tiltRaf);
    tiltRaf = requestAnimationFrame(() => {
      mockStack.style.transform = `rotateX(${(-py * MAX_TILT).toFixed(2)}deg) rotateY(${(px * MAX_TILT).toFixed(2)}deg)`;
      mockStack.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
      mockStack.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  });

  heroVisual.addEventListener('mouseenter', () => {
    mockStack.classList.add('tilting');
  });

  heroVisual.addEventListener('mouseleave', () => {
    cancelAnimationFrame(tiltRaf);
    mockStack.classList.remove('tilting');
    mockStack.style.transform = '';
  });
}

/* ---------- Screenshot mouse-follow tilt ---------- */

if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  const SHOT_TILT = 5;

  document.querySelectorAll('figure.screenshot').forEach((fig) => {
    let shotRaf = 0;

    fig.addEventListener('mousemove', (event) => {
      const rect = fig.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;

      cancelAnimationFrame(shotRaf);
      shotRaf = requestAnimationFrame(() => {
        fig.style.transform =
          `perspective(900px) rotateX(${(-py * SHOT_TILT).toFixed(2)}deg) rotateY(${(px * SHOT_TILT).toFixed(2)}deg) translateY(-6px)`;
      });
    });

    fig.addEventListener('mouseleave', () => {
      cancelAnimationFrame(shotRaf);
      fig.style.transform = '';
    });
  });
}

/* ---------- AI ghost preview demo ---------- */

const aiDemo = document.getElementById('ai-demo-editor');

if (aiDemo) {
  const beforeEl = aiDemo.querySelector('.ai-before');
  const targetEl = aiDemo.querySelector('.ai-target');
  const afterEl = aiDemo.querySelector('.ai-after');
  const toolbar = aiDemo.querySelector('.ai-toolbar-mock');
  const instructionEl = aiDemo.querySelector('.ai-instruction');
  const actions = aiDemo.querySelector('.ai-actions');
  const acceptBtn = aiDemo.querySelector('.ai-accept');

  const examples = [
    {
      before: 'Aria Voss charts dead star systems for whoever pays. ',
      target: 'She is tall and has a scar.',
      after: ' She drinks her coffee black and her promises rare.',
      instruction: 'Make it more vivid',
      rewrite: 'A thin scar splits her left brow, pale against skin that has outlived three suns.',
    },
    {
      before: 'The archive hums at night. ',
      target: 'Kael is grumpy but nice.',
      after: ' Nobody asks what he was before the war.',
      instruction: "Show, don't tell",
      rewrite: "Kael's scowl arrives before he does, but he still leaves the porch light on for strays.",
    },
    {
      before: 'Mira runs the last greenhouse on Europa. ',
      target: 'She likes plants.',
      after: ' The domes frost over when the relays fail.',
      instruction: 'Add sensory detail',
      rewrite: 'She names every seedling and hums to the tomatoes when the heaters stutter.',
    },
  ];

  const resetDemo = (example) => {
    beforeEl.textContent = example.before;
    afterEl.textContent = example.after;
    targetEl.className = 'ai-target';
    targetEl.textContent = example.target;
    toolbar.classList.remove('show');
    actions.classList.remove('show');
    acceptBtn.classList.remove('pressed');
  };

  if (reducedMotion) {
    const example = examples[0];
    resetDemo(example);
    targetEl.textContent = example.rewrite;
  } else {
    let running = false;
    let index = 0;
    const timers = new Set();

    const wait = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    const stopDemo = () => {
      running = false;
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };

    const runDemo = async () => {
      if (running) return;
      running = true;

      while (running) {
        const example = examples[index];
        index = (index + 1) % examples.length;

        resetDemo(example);
        await wait(1400);
        if (!running) break;

        targetEl.classList.add('ai-selected');
        instructionEl.textContent = example.instruction;
        toolbar.classList.add('show');
        await wait(1100);
        if (!running) break;

        targetEl.className = 'ai-target ai-ghost';
        targetEl.textContent = '';
        for (const ch of example.rewrite) {
          if (!running) break;
          targetEl.textContent += ch;
          await wait(ch === ' ' ? 45 : 22);
        }
        if (!running) break;

        targetEl.classList.add('ai-ghost--complete');
        actions.classList.add('show');
        await wait(2100);
        if (!running) break;

        acceptBtn.classList.add('pressed');
        targetEl.className = 'ai-target ai-accepted';
        await wait(900);
        if (!running) break;

        toolbar.classList.remove('show');
        actions.classList.remove('show');
        await wait(2200);
      }
    };

    new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runDemo();
          } else {
            stopDemo();
          }
        }
      },
      { threshold: 0.3 }
    ).observe(aiDemo);
  }
}

/* ---------- Context panel demo ---------- */

const ctxDemo = document.getElementById('ctx-demo');

if (ctxDemo) {
  const CTX_LIMIT = 8192;
  const ctxItems = Array.from(ctxDemo.querySelectorAll('.ctx-item'));
  const ctxTokens = document.getElementById('ctxTokens');
  const ctxBar = document.getElementById('ctxBar');
  const ctxCount = document.getElementById('ctxCount');
  const ctxChips = document.getElementById('ctxChips');

  const renderCtx = () => {
    let total = 0;
    const selected = [];

    for (const item of ctxItems) {
      if (item.classList.contains('on')) {
        total += Number(item.dataset.tokens) || 0;
        selected.push({ label: item.dataset.label, clear: () => item.classList.remove('on') });
      }
    }

    const pct = Math.min(100, (total / CTX_LIMIT) * 100);
    const status = pct > 80 ? 'danger' : pct > 50 ? 'warning' : 'good';

    ctxTokens.textContent = `${total.toLocaleString()} / ${CTX_LIMIT.toLocaleString()}`;
    ctxTokens.dataset.status = status;
    ctxBar.style.width = `${pct}%`;
    ctxBar.dataset.status = status;
    ctxCount.textContent = String(selected.length);
    ctxCount.style.display = selected.length > 0 ? '' : 'none';

    ctxChips.innerHTML = '';
    if (selected.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'ctx-empty';
      empty.textContent = 'Nothing selected. Orion works with an empty slate.';
      ctxChips.appendChild(empty);
    } else {
      for (const { label, clear } of selected) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ctx-chip';
        chip.title = `Remove ${label}`;
        chip.innerHTML = `${label} <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
        chip.addEventListener('click', () => {
          clear();
          renderCtx();
        });
        ctxChips.appendChild(chip);
      }
    }
  };

  for (const item of ctxItems) {
    item.addEventListener('click', () => {
      item.classList.toggle('on');
      renderCtx();
    });
  }

  renderCtx();
}

/* ---------- Lorebook entry demo ---------- */

const loreEntryDemo = document.getElementById('loreEntryDemo');
const loreEye = document.getElementById('loreEye');

if (loreEntryDemo && loreEye) {
  loreEye.addEventListener('click', () => {
    const hidden = loreEntryDemo.classList.toggle('hidden');
    loreEye.setAttribute('aria-pressed', String(!hidden));
  });
}

/* ---------- Screenshot lightbox ---------- */

const lightbox = document.getElementById('lightbox');

if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');

  const openLightbox = (img) => {
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('open'));
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      lightbox.hidden = true;
      lightboxImg.src = '';
    }, 200);
  };

  document.querySelectorAll('img.zoomable').forEach((img) => {
    img.addEventListener('click', () => openLightbox(img));
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.closest('.lightbox-close')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) {
      closeLightbox();
    }
  });
}
