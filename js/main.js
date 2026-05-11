import { loadState, saveState } from './state.js';
import { renderHome, renderEditor, renderSettings } from './views.js';
import { createActions } from './actions.js';
import { calcSubtotal, calcTotal, formatPrice, setPath } from './utils.js';

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
    if (ui.currentView === 'editor' && ui.draft) {
      actions.saveDraft();
    }
  }, 600);
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
  // Ensure all lineas have titulo field
  const draft = structuredClone(p);
  draft.lineas = (draft.lineas || []).map(l => ({ titulo: '', ...l }));
  ui = { ...ui, currentView: 'editor', currentPresupuestoId: id, draft };
  render();
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
    el.addEventListener('click', () => actions.handleAction(el.dataset.action))
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

  root.querySelectorAll('[data-line-field]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx, 10);
      const field = el.dataset.lineField;
      let val = el.value;
      if (field === 'precio') val = val === '' ? '' : parseFloat(val);
      if (!ui.draft.lineas[idx]) ui.draft.lineas[idx] = { titulo: '', descripcion: '', precio: '' };
      ui.draft.lineas[idx][field] = val;
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
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.log));
}

render();
