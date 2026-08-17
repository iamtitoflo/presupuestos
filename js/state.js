export const DEFAULT_STATE = {
  version: 1,
  settings: {
    emisor: {
      nombre: '',
      nif: '',
      email: '',
      telefono: '654317796',
      direccion: 'Villar del Arzobispo',
      cp: '46170',
      localidad: 'Higueruelas'
    },
    notasDefecto: '--- FORMA DE PAGO: deberá abonarse el 40% al comienzo de los trabajos.\n• A mitad de los trabajos realizados debe estar pagado el 80% del presupuesto.\n• Al terminar se deberá abonar el 20% restante del total del presupuesto.',
    ivaActivo: false,
    ivaPorcentaje: 21,
    validezDefecto: 30,
    siguienteNumero: 1
  },
  presupuestos: []
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
    const s = JSON.parse(raw);
    s.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
    s.settings.emisor = Object.assign({}, DEFAULT_STATE.settings.emisor, s.settings.emisor || {});
    s.presupuestos = (s.presupuestos || []).map(p => ({
      ...p,
      lineas: (p.lineas || []).map(normalizeLinea)
    }));
    return s;
  } catch (e) {
    console.error('Error loading state', e);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
