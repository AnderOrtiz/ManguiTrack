/* =========================================================
   ManguiTrack · estado, persistencia y lógica de negocio
   ========================================================= */

export const STORAGE_KEY = "manguitrack.v1";
export const THEME_KEY = "manguitrack.theme";

const now = () => new Date().toISOString();

export function seedState() {
    const locations = [
        { id: "CEN", name: "Central", type: "central" },
        { id: "BN", name: "Bodega Norte", type: "bodega" },
        { id: "BS", name: "Bodega Sur", type: "bodega" },
        { id: "SS", name: "Suc. Soyapango", type: "sucursal" },
        { id: "SM", name: "Suc. San Miguel", type: "sucursal" },
        { id: "SA", name: "Suc. Santa Ana", type: "sucursal" }
    ];
    const skus = ["P01", "P02", "P03", "P04", "P05", "P06"];
    const stock = {};
    const filas = [
        [40, 80, 30, 120, 100, 60],
        [25, 30, 15, 50, 40, 5],
        [10, 45, 20, 30, 60, 25],
        [6, 12, 4, 20, 18, 9],
        [4, 8, 8, 15, 10, 3],
        [8, 10, 6, 12, 14, 7]
    ];
    locations.forEach((l, i) => {
        stock[l.id] = {};
        skus.forEach((s, j) => { stock[l.id][s] = filas[i][j]; });
    });
    return {
        version: 1,
        categories: [
            { id: "CAT1", name: "Frutas frescas", parentId: null },
            { id: "CAT2", name: "Tropicales", parentId: "CAT1" },
            { id: "CAT3", name: "Cítricos", parentId: "CAT1" },
            { id: "CAT4", name: "Procesados", parentId: null },
            { id: "CAT5", name: "Jugos", parentId: "CAT4" },
            { id: "CAT6", name: "Conservas", parentId: "CAT4" }
        ],
        providers: [
            { id: "PRV1", name: "Finca El Sol", contact: "ventas@fincaelsol.com" },
            { id: "PRV2", name: "Agro Cuscatlán", contact: "2222-1010" },
            { id: "PRV3", name: "Néctares SV", contact: "contacto@nectares.com" }
        ],
        products: [
            { sku: "P01", name: "Mango Tommy (caja)", categoryId: "CAT2", providerId: "PRV1", price: 12.5 },
            { sku: "P02", name: "Piña (unidad)", categoryId: "CAT2", providerId: "PRV1", price: 1.8 },
            { sku: "P03", name: "Limón (saco)", categoryId: "CAT3", providerId: "PRV2", price: 9 },
            { sku: "P04", name: "Jugo de mango 1L", categoryId: "CAT5", providerId: "PRV3", price: 2.2 },
            { sku: "P05", name: "Jugo de naranja 1L", categoryId: "CAT5", providerId: "PRV3", price: 2 },
            { sku: "P06", name: "Mermelada de mango", categoryId: "CAT6", providerId: "PRV3", price: 3.4 }
        ],
        locations,
        stock,
        clients: [
            { id: "C1", name: "Tienda La Esperanza", phone: "2222-0101" },
            { id: "C2", name: "Restaurante El Zonte", phone: "2222-0202" },
            { id: "C3", name: "Super Selectos Ilopango", phone: "2222-0303" },
            { id: "C4", name: "Comedor Doña Rosa", phone: "2222-0404" }
        ],
        edges: [
            { id: "R1", a: "CEN", b: "BN", km: 60 },
            { id: "R2", a: "CEN", b: "BS", km: 45 },
            { id: "R3", a: "CEN", b: "SS", km: 12 },
            { id: "R4", a: "BN", b: "SA", km: 40 },
            { id: "R5", a: "BN", b: "SS", km: 55 },
            { id: "R6", a: "BS", b: "SM", km: 70 },
            { id: "R7", a: "SS", b: "SM", km: 95 }
        ],
        sales: [], orders: [], movements: [],
        counters: { cat: 6, prv: 3, cli: 4, loc: 6, sale: 0, order: 0, mov: 0, route: 7 },
        undo: []
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data?.version === 1 && Array.isArray(data.products) && Array.isArray(data.locations)) {
                return { ...data, undo: Array.isArray(data.undo) ? data.undo : [] };
            }
        }
    } catch (error) {
        console.warn("No se pudo restaurar la información guardada:", error);
    }
    return seedState();
}

export let state = loadState();

/** Estado de la interfaz (no se persiste). */
export const ui = {
    section: "resumen",
    cart: [],
    route: null,
    theme: localStorage.getItem(THEME_KEY) || "auto",
    filters: { productos: "", clientes: "", ventas: "", pedidos: "", bitacora: "", estado: "todos", tipo: "todos" }
};

/** Puente hacia la capa de interfaz, evita dependencias circulares. */
export const hooks = { render() {}, toast() {} };

export function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, undo: [] }));
    } catch (error) {
        hooks.toast("No se pudo guardar en este navegador.", "error");
    }
}

export function logMov(type, detail, ref = "") {
    state.movements.unshift({
        id: "M" + (++state.counters.mov),
        date: now(), type, detail, ref
    });
}

/** Ejecuta una mutación con snapshot para deshacer, guardado y aviso. */
export function transact(fn, message) {
    const before = JSON.stringify({ ...state, undo: [] });
    const result = fn();
    if (result === false) return false;
    state.undo.push(before);
    if (state.undo.length > 30) state.undo.shift();
    saveState();
    hooks.render();
    hooks.toast(typeof message === "function" ? message(result) : (message || "Cambios guardados"));
    return true;
}

export function undo() {
    if (!state.undo.length) return hooks.toast("No hay operaciones para deshacer.", "error");
    const previous = state.undo.pop();
    const stack = state.undo;
    state = { ...JSON.parse(previous), undo: stack };
    saveState();
    hooks.render();
    hooks.toast("Se deshizo la última operación.");
}

export function replaceState(data) {
    state = { ...data, undo: [] };
    saveState();
    hooks.render();
}

/* ---------- Utilidades ---------- */
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
export const money = n => "$" + Number(n || 0).toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = iso => new Date(iso).toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = iso => new Date(iso).toLocaleString("es-SV", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const nextSku = () => "P" + String(state.products.length + 1).padStart(2, "0");

/* ---------- Consultas ---------- */
export const prod = sku => state.products.find(p => p.sku === sku);
export const loc = id => state.locations.find(l => l.id === id);
export const cli = id => state.clients.find(c => c.id === id);
export const cat = id => state.categories.find(c => c.id === id);
export const prv = id => state.providers.find(p => p.id === id);
export const stockOf = (locationId, sku) => state.stock[locationId]?.[sku] || 0;
export const totalStock = sku => state.locations.reduce((sum, l) => sum + stockOf(l.id, sku), 0);
export const catName = id => id ? (cat(id)?.name || "—") : "Sin categoría";
export const prvName = id => id ? (prv(id)?.name || "—") : "Sin proveedor";
export const locName = id => loc(id)?.name || id || "—";
export const cliName = id => cli(id)?.name || "Cliente eliminado";
export const pedidosPendientes = () => state.orders.filter(o => o.status === "pendiente");
export const entregasActivas = () => state.orders.filter(o => o.status === "despachado");
export const ventasTotales = () => state.sales.reduce((sum, v) => sum + v.total, 0);
export const stockBajo = (limite = 8) => state.products.flatMap(p =>
    state.locations.filter(l => stockOf(l.id, p.sku) < limite).map(l => ({ product: p, location: l, qty: stockOf(l.id, p.sku) }))
);
export const esDescendiente = (id, posiblePadre) => {
    let actual = cat(id);
    while (actual?.parentId) {
        if (actual.parentId === posiblePadre) return true;
        actual = cat(actual.parentId);
    }
    return false;
};

/* ---------- Grafo y rutas ---------- */
export function graph() {
    const g = {};
    state.locations.forEach(l => { g[l.id] = {}; });
    state.edges.forEach(e => {
        if (g[e.a] && g[e.b]) { g[e.a][e.b] = e.km; g[e.b][e.a] = e.km; }
    });
    return g;
}

export function dijkstra(a, b) {
    const g = graph();
    if (!g[a] || !g[b] || a === b) return null;
    const dist = {}, prev = {}, pending = new Set(Object.keys(g));
    Object.keys(g).forEach(k => { dist[k] = Infinity; });
    dist[a] = 0;
    while (pending.size) {
        let u = null;
        pending.forEach(k => { if (u === null || dist[k] < dist[u]) u = k; });
        if (u === null || dist[u] === Infinity) break;
        pending.delete(u);
        if (u === b) break;
        for (const [v, km] of Object.entries(g[u])) {
            const alt = dist[u] + km;
            if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
        }
    }
    if (dist[b] === Infinity) return null;
    const path = [];
    for (let x = b; x; x = prev[x]) { path.unshift(x); if (x === a) break; }
    return path[0] === a ? { km: dist[b], path } : null;
}

export function bfs(a, b) {
    const g = graph();
    if (!g[a] || !g[b] || a === b) return null;
    const queue = [[a]], seen = new Set([a]);
    while (queue.length) {
        const path = queue.shift(), u = path[path.length - 1];
        if (u === b) return path;
        for (const v of Object.keys(g[u])) {
            if (!seen.has(v)) { seen.add(v); queue.push([...path, v]); }
        }
    }
    return null;
}

export const routeText = path => (path || []).map(locName).join(" → ");
