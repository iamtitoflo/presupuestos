import { loadState, saveState, normalizeLinea } from './state.js';
import { renderHome, renderEditor, renderSettings } from './views.js';
import { createActions } from './actions.js';
import { calcSubtotal, calcTotal, calcLineaTotal, formatPrice, setPath } from './utils.js';

let state = loadState();
let ui = { currentView: 'home', currentPresupuestoId: null, draft: null, search: '' };

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

const actions = createActions({ getState, setState, getUI, setUI, render, toast });

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
function flushAutoSave() {
  if (!autoSaveTimer) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  if (ui.currentView === 'editor' && ui.draft) {
    actions.saveDraft();
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
    el.addEventListener('click', () => { flushAutoSave(); actions.handleAction(el.dataset.action); })
  );

  root.querySelectorAll('[data-open]').forEach(el =>
    el.addEventListener('click', () => openPresupuesto(el.dataset.open))
  );

  const searchInput = root.querySelector('[data-search]');
  if (searchInput) {
    searchInput.addEventListener('input', () => { ui.search = searchInput.value; render(); });
  }

  root.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', () => {
      const path = el.dataset.field;
      let val = el.value;
      if (el.type === 'number') val = val === '' ? '' : parseFloat(val);
      setPath(ui.draft, path, val);
      updateTotalCard();
      scheduleAutoSave();
    });
  });

  const NUMERIC_LINE_FIELDS = ['cantidad', 'precioUnitario'];
  root.querySelectorAll('[data-line-field]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx, 10);
      const field = el.dataset.lineField;
      let val = el.value;
      if (NUMERIC_LINE_FIELDS.includes(field)) val = val === '' ? '' : parseFloat(val);
      if (!ui.draft.lineas[idx]) ui.draft.lineas[idx] = { titulo: '', descripcion: '', cantidad: 1, precioUnitario: '' };
      ui.draft.lineas[idx][field] = val;
      if (NUMERIC_LINE_FIELDS.includes(field)) updateLineSubtotal(idx);
      updateTotalCard();
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
      const hidden = document.getElementById('ivaActivoHidden');
      if (hidden) hidden.value = isOn ? 'true' : 'false';
      const pctField = document.getElementById('settings-iva-pct');
      if (pctField) pctField.classList.toggle('hidden', !isOn);
    });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.log));
}

render();
