// Unit tests for the state-mutating logic in actions.js, in isolation from
// the DOM/browser. createActions() takes its dependencies (getState/setState/
// getUI/setUI/render/toast) as an injected context, so the branches that
// don't touch `document` directly (new/save/duplicate/delete/add-line/reset/
// navigation) can be driven and asserted on without a real page. The
// DOM-heavy branches (save-settings, export, import, pdf) are covered by the
// e2e suite instead.
import './localStorage-shim.js';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createActions } from '../../js/actions.js';
import { DEFAULT_STATE } from '../../js/state.js';

function makeHarness(stateOverrides = {}, uiOverrides = {}) {
  let state = structuredClone({ ...DEFAULT_STATE, ...stateOverrides });
  let ui = { currentView: 'home', currentPresupuestoId: null, draft: null, search: '', ...uiOverrides };
  const renderCalls = [];
  const toasts = [];
  const ctx = {
    getState: () => state,
    setState: (s) => { state = s; },
    getUI: () => ui,
    setUI: (u) => { ui = u; },
    render: () => renderCalls.push(true),
    toast: (msg) => toasts.push(msg),
  };
  const actions = createActions(ctx);
  return {
    actions,
    getState: () => state,
    getUI: () => ui,
    renderCalls,
    toasts,
  };
}

function draftFixture(overrides = {}) {
  return {
    id: 'd1', numero: 1, fecha: '2026-01-01',
    cliente: { dni: '', nombre: 'Cliente', direccion: '', localidad: '' },
    lineas: [{ titulo: 'X', items: [{ texto: 'Y', precio: 10 }] }],
    notas: '', ivaActivo: false, ivaPorcentaje: 21, validez: 30,
    ...overrides
  };
}

beforeEach(() => { localStorage.clear(); });

describe('handleAction("new")', () => {
  test('crea un draft nuevo con la forma correcta y el número siguiente', async () => {
    const h = makeHarness({ settings: { ...DEFAULT_STATE.settings, siguienteNumero: 5, notasDefecto: 'Notas por defecto' } });
    await h.actions.handleAction('new');
    const ui = h.getUI();
    assert.equal(ui.currentView, 'editor');
    assert.equal(ui.draft.numero, 5);
    assert.equal(ui.draft.notas, 'Notas por defecto');
    assert.deepEqual(ui.draft.lineas, [{ titulo: '', items: [{ texto: '', precio: '' }] }]);
    assert.deepEqual(ui.draft.cliente, { dni: '', nombre: '', direccion: '', localidad: '' });
    assert.equal(h.renderCalls.length, 1);
  });

  test('cada draft nuevo recibe un id distinto', async () => {
    const h = makeHarness();
    await h.actions.handleAction('new');
    const id1 = h.getUI().draft.id;
    await h.actions.handleAction('new');
    const id2 = h.getUI().draft.id;
    assert.notEqual(id1, id2);
  });
});

describe('handleAction("save")', () => {
  test('guarda un presupuesto nuevo, lo añade a la lista y vuelve a renderizar', async () => {
    const h = makeHarness({}, { currentView: 'editor', draft: draftFixture() });
    await h.actions.handleAction('save');
    assert.equal(h.getState().presupuestos.length, 1);
    assert.equal(h.getState().presupuestos[0].id, 'd1');
    assert.equal(h.renderCalls.length, 1, 'debe re-renderizar para que el header/isNew se actualicen');
  });

  test('guardar un presupuesto ya existente lo actualiza en el sitio, sin duplicarlo', async () => {
    const h = makeHarness({ presupuestos: [draftFixture({ cliente: { nombre: 'Viejo' } })] }, { currentView: 'editor', draft: draftFixture({ cliente: { nombre: 'Nuevo' } }) });
    await h.actions.handleAction('save');
    assert.equal(h.getState().presupuestos.length, 1);
    assert.equal(h.getState().presupuestos[0].cliente.nombre, 'Nuevo');
  });

  test('guardar con numero >= siguienteNumero avanza el contador', async () => {
    const h = makeHarness({ settings: { ...DEFAULT_STATE.settings, siguienteNumero: 1 } }, { currentView: 'editor', draft: draftFixture({ numero: 7 }) });
    await h.actions.handleAction('save');
    assert.equal(h.getState().settings.siguienteNumero, 8);
  });
});

describe('handleAction("duplicate")', () => {
  test('crea una copia con id y número nuevos, y avanza siguienteNumero', async () => {
    const original = draftFixture();
    const h = makeHarness(
      { presupuestos: [original], settings: { ...DEFAULT_STATE.settings, siguienteNumero: 2 } },
      { currentView: 'editor', draft: original }
    );
    await h.actions.handleAction('duplicate');
    const state = h.getState();
    assert.equal(state.presupuestos.length, 2);
    const clone = state.presupuestos[1];
    assert.notEqual(clone.id, original.id);
    assert.equal(clone.numero, 2);
    assert.deepEqual(clone.lineas, original.lineas, 'las líneas se copian tal cual');
    assert.equal(state.settings.siguienteNumero, 3);
    assert.equal(h.getUI().draft.id, clone.id, 'el editor pasa a mostrar la copia');
  });
});

describe('handleAction("delete")', () => {
  test('con confirmación aceptada, elimina el presupuesto y vuelve a home', async () => {
    const draft = draftFixture();
    const h = makeHarness({ presupuestos: [draft] }, { currentView: 'editor', draft });
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
      await h.actions.handleAction('delete');
    } finally {
      globalThis.confirm = originalConfirm;
    }
    assert.equal(h.getState().presupuestos.length, 0);
    assert.equal(h.getUI().currentView, 'home');
  });

  test('si el usuario cancela la confirmación, no se elimina nada', async () => {
    const draft = draftFixture();
    const h = makeHarness({ presupuestos: [draft] }, { currentView: 'editor', draft });
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => false;
    try {
      await h.actions.handleAction('delete');
    } finally {
      globalThis.confirm = originalConfirm;
    }
    assert.equal(h.getState().presupuestos.length, 1, 'el presupuesto sigue existiendo');
    assert.equal(h.getUI().currentView, 'editor', 'no navega fuera del editor');
  });
});

describe('handleAction("reset")', () => {
  test('con confirmación aceptada, borra todos los presupuestos y reinicia la numeración', async () => {
    const h = makeHarness({
      presupuestos: [draftFixture({ id: 'a' }), draftFixture({ id: 'b' })],
      settings: { ...DEFAULT_STATE.settings, siguienteNumero: 9 }
    });
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
      await h.actions.handleAction('reset');
    } finally {
      globalThis.confirm = originalConfirm;
    }
    assert.equal(h.getState().presupuestos.length, 0);
    assert.equal(h.getState().settings.siguienteNumero, 1);
  });

  test('si el usuario cancela, no se borra nada', async () => {
    const h = makeHarness({ presupuestos: [draftFixture()] });
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => false;
    try {
      await h.actions.handleAction('reset');
    } finally {
      globalThis.confirm = originalConfirm;
    }
    assert.equal(h.getState().presupuestos.length, 1);
  });
});

describe('handleAction("add-line")', () => {
  test('añade un concepto en blanco con un item vacío', async () => {
    const draft = draftFixture();
    const h = makeHarness({}, { currentView: 'editor', draft });
    await h.actions.handleAction('add-line');
    assert.equal(h.getUI().draft.lineas.length, 2);
    assert.deepEqual(h.getUI().draft.lineas[1], { titulo: '', items: [{ texto: '', precio: '' }] });
  });
});

describe('navegación', () => {
  test('"back" vuelve a home y limpia el draft', async () => {
    const h = makeHarness({}, { currentView: 'editor', draft: draftFixture(), currentPresupuestoId: 'd1' });
    await h.actions.handleAction('back');
    const ui = h.getUI();
    assert.equal(ui.currentView, 'home');
    assert.equal(ui.draft, null);
    assert.equal(ui.currentPresupuestoId, null);
  });

  test('"settings" cambia a la vista de ajustes', async () => {
    const h = makeHarness();
    await h.actions.handleAction('settings');
    assert.equal(h.getUI().currentView, 'settings');
  });
});

describe('saveDraft', () => {
  test('persiste el draft en localStorage a través de saveState', async () => {
    const draft = draftFixture();
    const h = makeHarness({}, { currentView: 'editor', draft });
    await h.actions.handleAction('save');
    const raw = JSON.parse(localStorage.getItem('presupuestos_app_v1'));
    assert.equal(raw.presupuestos.length, 1);
    assert.equal(raw.presupuestos[0].id, 'd1');
  });
});
