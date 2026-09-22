import { DEFAULT_STATE, isValidBackup, normalizeLinea, saveState } from './state.js';
import { setPath, todayISO, uuid, clampVat } from './utils.js';
import { generatePDF } from './pdf.js';

export function createActions(ctx) {
  const { getState, setState, getUI, setUI, render, toast } = ctx;
  const storage = ctx.storage || { save: async state => { saveState(state); return state; } };

  async function persist(state, options) {
    try {
      const saved = await storage.save(state, options);
      setState(saved);
      return true;
    } catch (error) {
      console.error('No se pudo guardar', error);
      toast('❌ No se pudo guardar. No cierres la app.');
      return false;
    }
  }

  async function saveSettings() {
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
    await persist(state);
    toast('Ajustes guardados');
  }

  async function saveDraft() {
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
    return persist(state);
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
          lineas: [{ titulo: '', items: [{ texto: '', precio: '' }] }],
          notas: state.settings.notasDefecto || '',
          ivaActivo: !!state.settings.ivaActivo,
          ivaPorcentaje: state.settings.ivaPorcentaje || 21,
          validez: state.settings.validezDefecto || 30
        }
      });
      render();

    } else if (action === 'save') {
      await saveDraft();
      toast('✅ Presupuesto guardado');
      render();

    } else if (action === 'pdf') {
      await saveDraft();
      toast('Generando PDF…');
      await generatePDF(getUI().draft, state);

    } else if (action === 'add-line') {
      ui.draft.lineas.push({ titulo: '', items: [{ texto: '', precio: '' }] });
      render();

    } else if (action === 'duplicate') {
      const { draft } = ui;
      if (!draft) return;
      await saveDraft();
      const newNum = state.settings.siguienteNumero || (state.presupuestos.length + 1);
      const clone = structuredClone(draft);
      clone.id = uuid();
      clone.numero = newNum;
      clone.fecha = new Date().toISOString().slice(0, 10);
      state.settings.siguienteNumero = newNum + 1;
      state.presupuestos.push(clone);
      await persist(state);
      toast('Presupuesto duplicado');
      setUI({ ...ui, currentView: 'editor', currentPresupuestoId: clone.id, draft: clone });
      render();

    } else if (action === 'delete') {
      const { draft } = ui;
      if (!draft) return;
      if (!confirm('¿Eliminar este presupuesto?\n\nEsta acción no se puede deshacer.')) return;
      state.presupuestos = state.presupuestos.filter(x => x.id !== draft.id);
      await persist(state);
      toast('Presupuesto eliminado');
      setUI({ ...ui, currentView: 'home', draft: null, currentPresupuestoId: null });
      render();

    } else if (action === 'save-settings') {
      await saveSettings();
      setUI({ ...ui, currentView: 'home' });
      render();

    } else if (action === 'reset') {
      if (!confirm('⚠️ ¿Seguro que quieres BORRAR todos los presupuestos?\n\nEsta acción no se puede deshacer.')) return;
      state.presupuestos = [];
      state.settings.siguienteNumero = 1;
      await persist(state);
      toast('Presupuestos borrados');
      render();

    } else if (action === 'export') {
      const data = JSON.stringify({ type: 'presupuestos-backup', version: 1, state }, null, 2);
      const file = new File([data], 'presupuestos-backup.json', { type: 'application/json' });
      const canShareFiles = /Android/i.test(navigator.userAgent) && navigator.share && navigator.canShare && navigator.canShare({ files: [file] });
      if (canShareFiles) {
        try { await navigator.share({ files: [file], title: 'Backup presupuestos' }); }
        catch (e) { if (e?.name === 'AbortError') return; console.error(e); }
      } else if (el.dataset.setting === 'ivaPorcentaje') {
        val = clampVat(el.value);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      }
      state.backup = { ...state.backup, lastExternalBackupAt: new Date().toISOString(), changesSinceExternalBackup: 0 };
      await persist(state, { countAsChange: false });
      toast('✅ Copia de seguridad creada');

    } else if (action === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const f = input.files[0];
        if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          if (!isValidBackup(data)) throw new Error('Archivo no válido');
          const next = { ...data.state, presupuestos: data.state.presupuestos.map(p => ({ ...p, lineas: (p.lineas || []).map(normalizeLinea) })) };
          if (!confirm(`Vas a sustituir ${state.presupuestos.length} presupuesto(s) por ${next.presupuestos.length}. Se creará una copia de seguridad antes. ¿Continuar?`)) return;
          const result = await storage.replaceFromImport(next);
          setState(result.state);
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
