import { normalizeLinea } from './state.js';
import { createStorage } from './storage.js';
import { renderHome, renderEditor, renderSettings } from './views.js';
import { createActions } from './actions.js';
import { calcSubtotal, calcTotal, calcLineaTotal, formatPrice, setPath, parseAmount, clampVat } from './utils.js';

let state;
let ui = { currentView: 'home', currentPresupuestoId: null, draft: null, search: '' };
let storage;
let deferredInstallPrompt = null;

const getState = () => state;
const setState = (s) => { state = s; };
const getUI = () => ui;
const setUI = (u) => { ui = u; };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2400);
}

let actions;

let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    if (ui.currentView === 'editor' && ui.draft) {
      actions.saveDraft();
    }
  }, 600);
}

// Flushes a pending autosave immediately so quick navigation (e.g. tapping
// "back" right after typing) never drops the last edit made within the
// 600ms debounce window.
async function flushAutoSave() {
  if (!autoSaveTimer) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  if (ui.currentView === 'editor' && ui.draft) {
    await actions.saveDraft();
  }
}

function updateTotalCard() {
  const card = document.querySelector('.total-card');
  if (!card || !ui.draft) return;
  const subtotal = calcSubtotal(ui.draft);
  const total = calcTotal(ui.draft);
  card.querySelector('.amount').textContent = formatPrice(total) + '€';
  const left = card.querySelector('div');
  left.innerHTML = '<div class="label">TOTAL</div>' +
    (ui.draft.ivaActivo ? `<div style="font-size:12px;opacity:0.85">Base ${formatPrice(subtotal)}€ + IVA ${ui.draft.ivaPorcentaje}%</div>` : '');
}

function openPresupuesto(id) {
  const p = state.presupuestos.find(x => x.id === id);
  if (!p) return;
  const draft = structuredClone(p);
  draft.lineas = (draft.lineas || []).map(normalizeLinea);
  ui = { ...ui, currentView: 'editor', currentPresupuestoId: id, draft };
  render();
}

function updateLineSubtotal(idx) {
  const el = document.querySelector(`[data-line-subtotal="${idx}"]`);
  if (el) el.textContent = formatPrice(calcLineaTotal(ui.draft.lineas[idx])) + '€';
}

function render() {
  const root = document.getElementById('app');
  if (ui.currentView === 'home') root.innerHTML = renderHome(state, ui.search);
  else if (ui.currentView === 'editor') root.innerHTML = renderEditor(state, ui.draft);
  else root.innerHTML = renderSettings(state);
  attachHandlers();
}

function attachHandlers() {
  const root = document.getElementById('app');

  root.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', async () => { await flushAutoSave(); await actions.handleAction(el.dataset.action); })
  );

  root.querySelectorAll('[data-update-app]').forEach(el => el.addEventListener('click', async () => {
    await flushAutoSave();
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }));
  root.querySelectorAll('[data-install-app]').forEach(el => el.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    document.getElementById('install-banner')?.classList.add('hidden');
  }));

  root.querySelectorAll('[data-open]').forEach(el =>
    el.addEventListener('click', () => openPresupuesto(el.dataset.open))
  );

  const searchInput = root.querySelector('[data-search]');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      ui.search = searchInput.value;
      const cards = root.querySelector('.card-list, .empty-state');
      const fresh = new DOMParser().parseFromString(renderHome(state, ui.search), 'text/html').querySelector('.card-list, .empty-state');
      if (cards && fresh) cards.replaceWith(fresh);
      root.querySelectorAll('[data-open]').forEach(el =>
        el.addEventListener('click', () => openPresupuesto(el.dataset.open))
      );
    });
  }

  root.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', () => {
      const path = el.dataset.field;
      let val = el.value;
      if (path === 'ivaPorcentaje') val = clampVat(el.value);
      else if (el.type === 'number') val = val === '' ? '' : parseFloat(el.value);
      setPath(ui.draft, path, val);
      updateTotalCard();
      scheduleAutoSave();
    });
  });

  root.querySelectorAll('[data-line-field]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx, 10);
      const field = el.dataset.lineField;
      if (!ui.draft.lineas[idx]) ui.draft.lineas[idx] = { titulo: '', items: [{ texto: '', precio: '' }] };
      ui.draft.lineas[idx][field] = el.value;
      scheduleAutoSave();
    });
  });

  root.querySelectorAll('[data-remove-line]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      ui.draft.lineas.splice(parseInt(el.dataset.removeLine, 10), 1);
      scheduleAutoSave();
      render();
    });
  });

  // Item rows within a concepto (each with its own texto + precio).
  root.querySelectorAll('[data-item-field]').forEach(el => {
    el.addEventListener('input', () => {
      const lineIdx = parseInt(el.dataset.lineIdx, 10);
      const itemIdx = parseInt(el.dataset.itemIdx, 10);
      const field = el.dataset.itemField;
      let val = el.value;
      if (field === 'precio') {
        val = val === '' ? '' : parseAmount(val);
        if (val === null) {
          el.setCustomValidity('Introduce un importe positivo usando coma o punto decimal.');
          el.value = '';
          val = '';
          toast('El precio debe ser positivo');
        } else el.setCustomValidity('');
      }
      const linea = ui.draft.lineas[lineIdx];
      if (!linea.items[itemIdx]) linea.items[itemIdx] = { texto: '', precio: '' };
      linea.items[itemIdx][field] = val;
      if (field === 'precio') { updateLineSubtotal(lineIdx); updateTotalCard(); }
      scheduleAutoSave();
    });
  });

  root.querySelectorAll('[data-add-item]').forEach(el => {
    el.addEventListener('click', () => {
      const lineIdx = parseInt(el.dataset.addItem, 10);
      ui.draft.lineas[lineIdx].items.push({ texto: '', precio: '' });
      render();
    });
  });

  root.querySelectorAll('[data-remove-item]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const [lineIdx, itemIdx] = el.dataset.removeItem.split(',').map(n => parseInt(n, 10));
      ui.draft.lineas[lineIdx].items.splice(itemIdx, 1);
      updateTotalCard();
      scheduleAutoSave();
      render();
    });
  });

  root.querySelectorAll('[data-setting]').forEach(el => {
    el.addEventListener('change', actions.saveSettings);
    el.addEventListener('blur', actions.saveSettings);
  });

  // IVA toggle in editor
  const ivaToggle = root.querySelector('[data-toggle="iva"]');
  if (ivaToggle) {
    ivaToggle.addEventListener('click', () => {
      ui.draft.ivaActivo = !ui.draft.ivaActivo;
      ivaToggle.classList.toggle('on', ui.draft.ivaActivo);
      ivaToggle.setAttribute('aria-checked', String(ui.draft.ivaActivo));
      const pctRow = document.getElementById('iva-pct-row');
      if (pctRow) pctRow.classList.toggle('hidden', !ui.draft.ivaActivo);
      updateTotalCard();
      scheduleAutoSave();
    });
  }

  // IVA toggle in settings (updates hidden input, does not auto-save)
  const ivaSettingToggle = root.querySelector('[data-toggle="iva-setting"]');
  if (ivaSettingToggle) {
    ivaSettingToggle.addEventListener('click', () => {
      ivaSettingToggle.classList.toggle('on');
      const isOn = ivaSettingToggle.classList.contains('on');
      ivaSettingToggle.setAttribute('aria-checked', String(isOn));
      const hidden = document.getElementById('ivaActivoHidden');
      if (hidden) hidden.value = isOn ? 'true' : 'false';
      const pctField = document.getElementById('settings-iva-pct');
      if (pctField) pctField.classList.toggle('hidden', !isOn);
      actions.saveSettings();
    });
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById('install-banner')?.classList.remove('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('sw.js').catch(console.log);
    if (!registration) return;
    const offerUpdate = () => {
      if (!registration.waiting) return;
      const banner = document.getElementById('update-banner');
      if (banner) banner.classList.remove('hidden');
    };
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
    offerUpdate();
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  });
}

async function bootstrap() {
  storage = await createStorage();
  const result = await storage.init();
  state = result.state;
  actions = createActions({ getState, setState, getUI, setUI, render, toast, storage });
  render();
  const installBanner = document.getElementById('install-banner');
  if (deferredInstallPrompt) installBanner?.classList.remove('hidden');
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone) {
    const message = installBanner?.querySelector('[data-install-message]');
    if (message) message.textContent = 'En iPhone/iPad: pulsa Compartir y luego «Añadir a pantalla de inicio».';
    installBanner?.classList.remove('hidden');
  }
  if (!result.persistence.persisted) toast('⚠️ El navegador podría borrar datos. Haz una copia de seguridad.');
  if (result.migrated) toast('✅ Datos antiguos protegidos y migrados');
  if (result.legacyCorrupt) toast('⚠️ Se detectaron datos antiguos dañados. No se han borrado.');
}

bootstrap().catch(error => {
  console.error(error);
  document.getElementById('app').textContent = 'No se pudieron abrir los datos. No borres los datos del navegador.';
});
