export const DEFAULT_STATE = {
  version: 2,
  settings: {
    emisor: {
      nombre: '',
      nif: '',
      email: '',
      telefono: '',
      direccion: '',
      cp: '',
      localidad: ''
    },
    notasDefecto: '--- FORMA DE PAGO: deberá abonarse el 40% al comienzo de los trabajos.\n• A mitad de los trabajos realizados debe estar pagado el 80% del presupuesto.\n• Al terminar se deberá abonar el 20% restante del total del presupuesto.',
    ivaActivo: false,
    ivaPorcentaje: 21,
    validezDefecto: 30,
    siguienteNumero: 1
  },
  presupuestos: [],
  backup: {
    lastExternalBackupAt: null,
    changesSinceExternalBackup: 0
  }
};

export const STORAGE_KEY = 'presupuestos_app_v1';

// A línea (concepto) holds a list of items, each with its own texto + precio;
// the concepto's total is the sum of its items (see calcLineaTotal). Older
// saved data used a single lump price per concepto — map it onto one item so
// existing totals are preserved exactly.
export function normalizeLinea(l) {
  if (Array.isArray(l.items)) {
    return { titulo: '', ...l, items: l.items.map(it => ({ texto: '', precio: '', ...it })) };
  }
  let total = '';
  if (l.precioUnitario != null && l.precioUnitario !== '') {
    const cantidad = l.cantidad === '' || l.cantidad == null ? 1 : (parseFloat(l.cantidad) || 0);
    total = cantidad * (parseFloat(l.precioUnitario) || 0);
  } else if (l.precio != null && l.precio !== '') {
    total = l.precio;
  }
  const texto = (l.descripcion || '').split('\n').map(s => s.trim()).filter(Boolean).join(' · ');
  return {
    titulo: l.titulo || '',
    items: [{ texto, precio: total }]
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.error('Error loading state', e);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Only backups produced by this app may replace the current data.  Keep this
// deliberately strict: a malformed import must never turn a real budget list
// into an empty one.
export function isValidBackup(data) {
  return !!data && data.type === 'presupuestos-backup' && data.version === 1 &&
    !!data.state && typeof data.state === 'object' && !Array.isArray(data.state) &&
    Array.isArray(data.state.presupuestos) &&
    (!data.state.settings || (typeof data.state.settings === 'object' && !Array.isArray(data.state.settings)));
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return structuredClone(DEFAULT_STATE);
  const s = structuredClone(raw);
  s.version = DEFAULT_STATE.version;
  s.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
  s.settings.emisor = Object.assign({}, DEFAULT_STATE.settings.emisor, s.settings.emisor || {});
  s.presupuestos = Array.isArray(s.presupuestos) ? s.presupuestos
    .filter(p => p && typeof p === 'object' && !Array.isArray(p))
    .map(p => ({
      ...p,
      id: typeof p.id === 'string' && p.id ? p.id : (globalThis.crypto?.randomUUID?.() || `recovered_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      cliente: Object.assign({ dni: '', nombre: '', direccion: '', localidad: '' }, p.cliente || {}),
      lineas: Array.isArray(p.lineas) ? p.lineas.map(normalizeLinea) : []
    })) : [];
  s.backup = Object.assign({}, DEFAULT_STATE.backup, s.backup || {});
  return s;
}
