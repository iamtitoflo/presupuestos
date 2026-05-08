import { DEFAULT_STATE, saveState } from './state.js';
import { setPath, todayISO, uuid } from './utils.js';
import { generatePDF } from './pdf.js';

export function createActions(ctx){
  const {getState,setState,getUI,setUI,render,toast}=ctx;
  function saveSettings(){ const state=getState(); document.querySelectorAll('[data-setting]').forEach(el=>setPath(state.settings,el.dataset.setting,el.type==='number'?parseFloat(el.value||0):el.value)); saveState(state); toast('Ajustes guardados'); }
  function saveDraft(){ const {draft}=getUI(); if(!draft) return; const state=getState(); const idx=state.presupuestos.findIndex(x=>x.id===draft.id); draft.modificado=new Date().toISOString(); if(idx===-1){ state.presupuestos.push(structuredClone(draft)); if(draft.numero>= (state.settings.siguienteNumero||1)) state.settings.siguienteNumero=(parseInt(draft.numero,10)||0)+1; } else state.presupuestos[idx]=structuredClone(draft); saveState(state); }
  async function handleAction(action){ const ui=getUI(); const state=getState();
    if(action==='settings'){ setUI({...ui,currentView:'settings'}); render(); }
    else if(action==='back'){ setUI({...ui,currentView:'home',draft:null,currentPresupuestoId:null}); render(); }
    else if(action==='new'){ const num=state.settings.siguienteNumero||(state.presupuestos.length+1); setUI({...ui,currentView:'editor',draft:{id:uuid(),numero:num,fecha:todayISO(),cliente:{nombre:'',direccion:'',localidad:''},lineas:[{descripcion:'',precio:''}],notas:state.settings.notasDefecto||'',ivaActivo:!!state.settings.ivaActivo,ivaPorcentaje:state.settings.ivaPorcentaje||21}}); render(); }
    else if(action==='save'){ saveDraft(); toast('Presupuesto guardado'); }
    else if(action==='pdf'){ saveDraft(); await generatePDF(getUI().draft,state); }
    else if(action==='add-line'){ ui.draft.lineas.push({descripcion:'',precio:''}); render(); }
    else if(action==='reset'){ state.presupuestos=[]; state.settings.siguienteNumero=1; saveState(state); render(); }
    else if(action==='export'){
      const file = new File([JSON.stringify({type:'presupuestos-backup',version:1,state},null,2)], 'presupuestos-backup.json', {type:'application/json'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file], title:'Backup presupuestos'}); }
        catch(e){ if(e && e.name!=='AbortError') console.error(e); }
      }else{
        const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=file.name; a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      }
    }
    else if(action==='import'){ const input=document.createElement('input'); input.type='file'; input.accept='.json,application/json'; input.onchange=async()=>{const f=input.files[0]; if(!f) return; const data=JSON.parse(await f.text()); const next=data.state; next.settings=Object.assign({},DEFAULT_STATE.settings,next.settings||{}); next.settings.emisor=Object.assign({},DEFAULT_STATE.settings.emisor,next.settings.emisor||{}); setState(next); saveState(next); render(); }; input.click(); }
  }
  return { handleAction, saveSettings, saveDraft };
}
