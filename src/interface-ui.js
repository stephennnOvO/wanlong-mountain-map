// One foreground surface at a time, including panels created by feature modules.
const interfacePanels = (() => {
  const ids = [
    ...dockPanelIds,
    'registration-workbench',
    'bike-perspective-panel',
    'reference-modal',
  ];
  const panels = ids.map((id) => $(id)).filter(Boolean);
  for (const id of dockPanelIds) $(id).classList.add('map-dock-panel');
  let active = null,
    launchContext = null;
  const inertRoots = new Map();
  let currentModal = null;
  function syncModal() {
    const modal =
      active &&
      ['reference-modal', 'registration-workbench', 'bike-perspective-panel'].includes(active.id) &&
      visible(active)
        ? active
        : null;
    if (modal === currentModal) return;
    for (const [el, value] of inertRoots) el.inert = value;
    inertRoots.clear();
    currentModal = modal;
    if (modal)
      for (const el of document.body.children) {
        if (el === modal || el.contains(modal) || ['SCRIPT', 'STYLE'].includes(el.tagName))
          continue;
        inertRoots.set(el, el.inert);
        el.inert = true;
      }
  }
  const parents = new Map();
  const visible = (el) =>
    !el.hidden &&
    (el.id !== 'sidebar' ||
      (!document.body.classList.contains('catalog-collapsed') &&
        !el.classList.contains('mobile-hidden')));
  function close(el) {
    if (el.id === 'sidebar') toggleCatalogue(false);
    else if (el.id === 'settings') setSettingsOpen(false);
    else el.hidden = true;
  }
  function clean(root) {
    const selectors = '.detail-note,.photo-note,.detail-sub,.eyebrow,.weather-note';
    root.querySelectorAll(selectors).forEach((el) => el.remove());
    root
      .querySelectorAll(
        '#detail p:not(.guest-description),#official-features-panel p,.official-feature span,.map-key-content>p,#reference-caption',
      )
      .forEach((el) => {
        if (el.childNodes.length) el.replaceChildren();
      });
    root.querySelectorAll('#detail .profile-title').forEach((el) => {
      if (el.textContent.includes('建筑观察')) el.remove();
    });
    if (root.id === 'detail') {
      const badge = root.querySelector('.badge');
      const selected = state.selected;
      let label = null;
      if (selected?.kind === 'trail') {
        const trail = trails.find((t) => t.id === selected.id);
        if (trail) {
          const grade = trailGrade(trail);
          label = grade.symbol + ' ' + grade.label;
        }
      } else if (selected?.kind === 'lift') {
        const lift = lifts.find((l) => l.id === selected.id);
        if (lift)
          label =
            (lift.capacity ? lift.capacity + ' 人' : '') +
            (lift.type === 'gondola' ? '吊厢' : '吊椅');
      }
      if (badge && label && badge.textContent !== label) badge.textContent = label;
      if (
        badge &&
        !label &&
        !badge.classList.contains('reference-model-badge') &&
        /官方|参考|建模|模拟/.test(badge.textContent) &&
        !badge.classList.contains('interface-copy')
      )
        badge.classList.add('interface-copy');
    }
    if (DELIVERY_MODE) cleanDeliveryPanel(root);
    layoutPanel(root);
  }
  // The header never shares the scrolling area with the contents. This also
  // prevents translucent sticky headings from painting over labels and controls.
  function layoutPanel(root) {
    const selector = {
      detail: '.detail-top',
      'dining-panel': '.detail-top',
      settings: '.settings-heading',
      'official-features-panel': '.settings-heading',
      'legend-panel': '.settings-heading',
    }[root.id];
    if (!selector) return;
    const header = root.querySelector(':scope>' + selector);
    if (!header) return;
    let body = root.querySelector(':scope>.panel-scroll');
    if (!body) {
      body = document.createElement('div');
      body.className = 'panel-scroll';
      root.append(body);
    }
    if (root.id === 'detail' && !header.querySelector('h2')) {
      const title = root.querySelector(':scope>h2') || body.querySelector(':scope>h2');
      if (title) header.prepend(title);
    }
    for (const child of [...root.childNodes])
      if (child !== header && child !== body) body.append(child);
    root.classList.add('panel-framed');
    header.classList.add('panel-fixed-heading');
    const dismiss = header.querySelector(
      '.close,#official-features-close,#settings-close,#legend-close',
    );
    dismiss?.classList.add('panel-dismiss');
    if (root.id === 'detail' && dismiss) {
      if (dismiss.textContent !== '收起 ×') dismiss.textContent = '收起 ×';
      if (dismiss.getAttribute('aria-label') !== '收起详情')
        dismiss.setAttribute('aria-label', '收起详情');
    }
  }
  const scrollArea = (panel) => panel.querySelector(':scope>.panel-scroll') || panel;
  // Modules retain their data and diagnostics. Explanatory copy has no scene UI.
  // IDs used by simulation updates remain available as hidden, empty nodes.
  const staticCopy = [
    'night-note',
    'hint',
    'reference-warning',
    'coordinate-readout',
    'geometry-summary',
    'reference-caption',
  ];
  for (const id of staticCopy) {
    const el = $(id);
    if (el) {
      el.replaceChildren();
      el.classList.add('interface-copy');
    }
  }
  document
    .querySelectorAll(
      '.panel-bottom,.scene-caption,.key-intro,.map-key-content>p,.reference-zoom>span',
    )
    .forEach((el) => el.classList.add('interface-copy'));
  for (const id of ['about', 'settings-about']) $(id).hidden = true;
  $('sidebar').querySelector('h1').textContent = '目录';
  document
    .querySelectorAll('.panel-head .eyebrow,.panel-head .stats')
    .forEach((el) => el.classList.add('interface-copy'));
  const legend = $('legend-panel'),
    legendButton = $('map-key');
  legendButton.onclick = () => {
    legend.hidden = !legend.hidden;
  };
  $('legend-close').onclick = () => {
    close(legend);
    legendButton.focus({ preventScroll: true });
  };
  const labels = {
    'imagery-switch': '卫星影像',
    'forest-boundary-switch': '当前林带边界',
    'paths-switch': '山径',
  };
  for (const [id, label] of Object.entries(labels)) {
    const el = $(id);
    if (el) {
      el.closest('.switch-row').querySelector('span').textContent = label;
      el.setAttribute('aria-label', label);
    }
  }
  function sync() {
    syncModal();
    const chain = new Set();
    let branch = active;
    while (branch && !chain.has(branch)) {
      chain.add(branch);
      branch = parents.get(branch)?.panel;
    }
    let guestSection = null;
    if (active && visible(active)) {
      if (chain.has($('official-features-panel'))) guestSection = 'official-features-open';
      else if (chain.has(diningPanel)) guestSection = 'dining-toggle';
      else if (
        (chain.has($('sidebar')) && state.tab === 'hotels') ||
        (chain.has($('detail')) && state.selected?.kind === 'hotel')
      )
        guestSection = 'stay-open';
    }
    for (const id of ['stay-open', 'dining-toggle', 'official-features-open'])
      $(id)?.setAttribute('aria-expanded', String(id === guestSection));
    legendButton.classList.toggle('active', visible(legend));
    document.body.classList.toggle('foreground-open', !!active && visible(active));
    for (const [id, control] of [
      ['sidebar', 'toggle-list'],
      ['settings', 'settings-toggle'],
      ['legend-panel', 'map-key'],
      ['detail', 'selection-detail'],
    ]) {
      $(control).setAttribute('aria-controls', id);
      $(control).setAttribute('aria-expanded', String(visible($(id))));
    }
  }
  function restore(el) {
    if (['ski', 'lift', 'tour'].includes(state.mode)) {
      parents.clear();
      active = null;
      toggleCatalogue(false);
      sync();
      return;
    }
    const parent = parents.get(el);
    parents.delete(el);
    if (!parent) {
      const control = {
        sidebar: state.tab === 'hotels' ? 'stay-open' : 'toggle-list',
        'dining-panel': 'dining-toggle',
        'official-features-panel': 'official-features-open',
      }[el.id];
      if (control && el.contains(document.activeElement))
        $(control)?.focus({ preventScroll: true });
      return;
    }
    active = parent.panel;
    if (active.id === 'sidebar') toggleCatalogue(true);
    else if (active.id === 'settings') setSettingsOpen(true);
    else active.hidden = false;
    sync();
    scrollArea(active).scrollTop = parent.scrollTop || 0;
    if (parent.control?.isConnected) parent.control.focus({ preventScroll: true });
  }
  function activate(el) {
    if (el === active) return;
    const launch = launchContext;
    launchContext = null;
    if (launch && launch.panel !== el) {
      const path = [];
      for (let branch = launch.panel; branch; branch = parents.get(branch)?.panel) {
        path.push(branch);
        if (branch === el) break;
      }
      if (path.at(-1) === el) {
        path.pop();
        for (const child of path) parents.delete(child);
      } else parents.set(el, launch);
    } else parents.clear();
    active = el;
    for (const panel of panels) if (panel !== el && visible(panel)) close(panel);
    $('tooltip').hidden = true;
    if (['reference-modal', 'registration-workbench', 'bike-perspective-panel'].includes(el.id)) {
      el.setAttribute('aria-modal', 'true');
      if (!el.contains(document.activeElement)) el.querySelector('button')?.focus();
    }
    sync();
    updateSceneFraming();
    requestSceneFrame();
  }
  function openRoot(panel, open, toggle = true) {
    parents.clear();
    launchContext = null;
    if (toggle && active === panel && visible(panel)) {
      close(panel);
      return;
    }
    open();
    activate(panel);
    sync();
  }
  function dismissPanels() {
    parents.clear();
    launchContext = null;
    active = null;
    for (const panel of panels) if (visible(panel)) close(panel);
    sync();
    updateSceneFraming();
    requestSceneFrame();
  }
  const observed = new Map(panels.map((el) => [el, visible(el)]));
  for (const panel of panels) {
    clean(panel);
    new MutationObserver((records) => {
      if (
        records.some(
          (r) => r.type === 'childList' && [...r.addedNodes].some((n) => n.nodeType === 1),
        )
      ) {
        clean(panel);
        sync();
      }
      // Text updates and descendant styling do not change panel navigation.
      if (!records.some((r) => r.type === 'attributes' && r.target === panel)) return;
      const open = visible(panel),
        was = observed.get(panel);
      observed.set(panel, open);
      if (open && !was) activate(panel);
      if (!open && was && active === panel) {
        active = null;
        restore(panel);
      }
      sync();
      if (open !== was) updateSceneFraming();
      requestSceneFrame();
    }).observe(panel, {
      attributes: true,
      attributeFilter: ['hidden', 'class', 'open'],
      childList: true,
      subtree: true,
    });
  }
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && (active || !measurementResult.hidden)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!active) {
          $('measurement-close').click();
          $('measure-toggle').focus();
          return;
        }
        if (active.id === 'official-features-panel' && !$('official-features-back').hidden) {
          $('official-features-back').click();
          return;
        }
        const closing = active;
        close(closing);

        const control = {
          sidebar: state.tab === 'hotels' && DELIVERY_MODE ? 'stay-open' : 'toggle-list',
          detail: 'selection-detail',
          settings: 'settings-toggle',
          'legend-panel': 'map-key',
          'dining-panel': 'dining-toggle',
          'official-features-panel': 'official-features-open',
        }[closing.id];
        if (control) $(control).focus();
        sync();
        requestSceneFrame();
      }
      if (
        e.key === 'Tab' &&
        ['reference-modal', 'registration-workbench', 'bike-perspective-panel'].includes(active?.id)
      ) {
        const controls = [
          ...active.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]'),
        ].filter(
          (el) =>
            !el.disabled &&
            el.tabIndex >= 0 &&
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== 'hidden',
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first) return;
        if (!active.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    true,
  );
  document.addEventListener(
    'click',
    (e) => {
      const control = e.target.closest('button,a,summary');
      const context =
        control && active && active.contains(control)
          ? { panel: active, control, scrollTop: scrollArea(active).scrollTop }
          : null;
      launchContext = context;
      setTimeout(() => {
        if (launchContext === context) launchContext = null;
      }, 0);
    },
    true,
  );
  document.addEventListener(
    'toggle',
    (e) => {
      if (!(e.target instanceof HTMLDetailsElement) || !e.target.open) return;
      for (const sibling of e.target.parentElement.children)
        if (sibling !== e.target && sibling instanceof HTMLDetailsElement) sibling.open = false;
    },
    true,
  );
  const interfaceToggle = $('interface-toggle');
  document.querySelector('.toolbar').append(interfaceToggle);
  interfaceToggle.classList.remove('glass');
  interfaceToggle.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path class="panel-toggle-arrow" d="m15 9-3 3 3 3"/></svg>';
  interfaceToggle.setAttribute('aria-label', '收起面板');
  interfaceToggle.title = '收起面板';
  interfaceToggle.onclick = () => {
    const clean = document.body.classList.toggle('clean-view');
    interfaceToggle.setAttribute('aria-pressed', String(clean));
    interfaceToggle.setAttribute('aria-label', clean ? '显示菜单' : '收起面板');
    interfaceToggle.title = clean ? '显示菜单' : '收起面板';
  };
  $('interface-toggle').addEventListener('click', () => {
    if (document.body.classList.contains('clean-view')) {
      dismissPanels();
      if (!measurementResult.hidden) $('measurement-close').click();
    }
  });
  window.addEventListener('resize', () => {
    if (active) for (const panel of panels) if (panel !== active && visible(panel)) close(panel);
    sync();
  });
  sync();
  return {
    get blocksScene() {
      return !!currentModal;
    },
    openRoot,
    dismissPanels,
    close: () => {
      if (active) close(active);
    },
  };
})();
