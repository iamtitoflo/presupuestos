import { DEFAULT_STATE, saveState } from './state.js';
import { setPath, todayISO, uuid } from './utils.js';
import { generatePDF } from './pdf.js';

export function createActions(ctx) {
  const { getState, setState, getUI, setUI, render, toast } = ctx;

  function saveSettings() {
    const state = getState();
    document.querySelectorAll('[data-setting]').forEach(el => {
      let val;
      if (el.type === 'checkbox') {
        val = el.checked;
      } else if (el.type === 'number') {
        val = parseFloat(el.value || 0);
      } else if (el.value === 'true' || el.value === 'false') {
        // select with true/false string values
        val = el.value === 'true';
      } else {
        val = el.value;
      }
      setPath(state.settings, el.dataset.setting, val);
    });
    saveState(state);
    toast('Ajustes guardados');
  }

  function saveDraft() {
    const { draft } = getUI();
    if (!draft) return;
    const state = getState();
    const idx = state.presupuestos.findIndex(x => x.id === draft.id);
    draft.modificado = new Date().toISOString();
    if (idx === -1) {
      state.presupuestos.push(structuredClone(draft));
      if (draft.numero >= (state.settings.siguienteNumero || 1)) {
        state.settings.siguienteNumero = (parseInt(draft.numero, 10) || 0) + 1;
      }
    } else {
      state.presupuestos[idx] = structuredClone(draft);
    }
    saveState(state);
  }

  async function handleAction(action) {
    const ui = getUI();
    const state = getState();

    if (action === 'settings') {
      setUI({ ...ui, currentView: 'settings' });
      render();

    } else if (action === 'back') {
      setUI({ ...ui, currentView: 'home', draft: null, currentPresupuestoId: null });
      render();

    } else if (action === 'new') {
      const num = state.settings.siguienteNumero || (state.presupuestos.length + 1);
      setUI({
        ...ui,
        currentView: 'editor',
        draft: {
          id: uuid(),
          numero: num,
          fecha: todayISO(),
          cliente: { dni: '', nombre: '', direccion: '', localidad: '' },
          lineas: [{ titulo: '', descripcion: '', precio: '' }],
          notas: state.settings.notasDefecto || '',
          ivaActivo: !!state.settings.ivaActivo,
          ivaPorcentaje: state.settings.ivaPorcentaje || 21
        }
      });
      render();

    } else if (action === 'save') {
      saveDraft();
      toast('✅ Presupuesto guardado');

    } else if (action === 'pdf') {
      saveDraft();
      toast('Generando PDF…');
      await generatePDF(getUI().draft, state);

    } else if (action === 'add-line') {
      ui.draft.lineas.push({ titulo: '', descripcion: '', precio: '' });
      render();

    } else if (action === 'save-settings') {
      saveSettings();
      setUI({ ...ui, currentView: 'home' });
      render();

    } else if (action === 'reset') {
      if (!confirm('⚠️ ¿Seguro que quieres BORRAR todos los presupuestos?\n\nEsta acción no se puede deshacer.')) return;
      state.presupuestos = [];
      state.settings.siguienteNumero = 1;
      saveState(state);
      toast('Presupuestos borrados');
      render();

    } else if (action === 'export') {
      const data = JSON.stringify({ type: 'presupuestos-backup', version: 1, state }, null, 2);
      const file = new File([data], 'presupuestos-backup.json', { type: 'application/json' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Backup presupuestos' }); }
        catch (e) { if (e && e.name !== 'AbortError') console.error(e); }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      }

    } else if (action === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const f = input.files[0];
        if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          const next = data.state;
          next.settings = Object.assign({}, DEFAULT_STATE.settings, next.settings || {});
          next.settings.emisor = Object.assign({}, DEFAULT_STATE.settings.emisor, next.settings.emisor || {});
          setState(next);
          saveState(next);
          toast('✅ Datos importados');
          render();
        } catch (e) {
          toast('❌ Error al importar el archivo');
        }
      };
      input.click();
    }
  }

  return { handleAction, saveSettings, saveDraft };
}
