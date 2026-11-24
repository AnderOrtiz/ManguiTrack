/* =========================================================
   ManguiTrack · ventas, pedidos, entregas, rutas y ajustes
   ========================================================= */
import {
    state, ui, hooks, esc, money, fmtDateTime, transact, logMov, replaceState,
    seedState, stockOf, prod, cliName, locName, dijkstra, bfs, routeText
} from "./state.js";
import { openForm, openConfirm, toast, setTheme, download } from "./ui.js";

/* ---------- Carrito compartido ---------- */
const FORM_IDS = ["sale-client", "sale-loc", "order-client", "order-dest", "route-from", "route-to"];

/** Redibuja el carrito sin perder las selecciones aún no guardadas. */
function renderKeepingForm() {
    const values = {};
    FORM_IDS.forEach(id => { const element = document.getElementById(id); if (element) values[id] = element.value; });
    hooks.render();
    Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.value = value; });
}

export function cartAdd() {
    const sku = document.getElementById("cart-product")?.value;
    const q = Number(document.getElementById("cart-qty")?.value);
    if (!sku || !Number.isInteger(q) || q <= 0) return toast("Elige un producto y una cantidad válida.", "error");
    const existing = ui.cart.find(i => i.sku === sku);
    if (existing) existing.qty += q;
    else ui.cart.push({ sku, qty: q });
    renderKeepingForm();
    toast(`${prod(sku)?.name || sku} agregado al carrito.`);
}

export function cartRemove(sku) {
    ui.cart = ui.cart.filter(i => i.sku !== sku);
    renderKeepingForm();
}

export function cartQtyChange(sku, value) {
    const q = Number(value);
    const item = ui.cart.find(i => i.sku === sku);
    if (!item) return;
    if (!Number.isInteger(q) || q <= 0) return toast("La cantidad debe ser un entero mayor que cero.", "error");
    item.qty = q;
    renderKeepingForm();
}

function clearCart() { ui.cart = []; }

/* ---------- Ventas ---------- */
export function newSale() {
    if (!ui.cart.length) return toast("Agrega al menos un producto al carrito.", "error");
    const clientId = document.getElementById("sale-client")?.value;
    const locationId = document.getElementById("sale-loc")?.value;
    if (!clientId || !locationId) return toast("Selecciona cliente y ubicación.", "error");
    const needed = {};
    ui.cart.forEach(i => { needed[i.sku] = (needed[i.sku] || 0) + i.qty; });
    for (const [sku, qty] of Object.entries(needed)) {
        if (stockOf(locationId, sku) < qty) return toast(`Stock insuficiente de ${prod(sku)?.name || sku} en ${locName(locationId)}.`, "error");
    }
    transact(() => {
        const items = ui.cart.map(i => ({ sku: i.sku, name: prod(i.sku)?.name || i.sku, qty: i.qty, price: prod(i.sku)?.price || 0 }));
        const total = items.reduce((s, i) => s + i.qty * i.price, 0);
        const id = "V" + (++state.counters.sale);
        state.sales.unshift({ id, date: new Date().toISOString(), clientId, clientName: cliName(clientId), locationId, items, total });
        items.forEach(i => { state.stock[locationId][i.sku] -= i.qty; });
        logMov("Venta", `${id}: ${items.map(i => `${i.qty} × ${i.name}`).join(", ")} a ${cliName(clientId)} desde ${locName(locationId)}`, id);
        clearCart();
    }, "Venta registrada correctamente.");
}

function showInfo(title, html) {
    openForm({ title, fields: [], submit: "Cerrar", onSubmit: () => {} });
    document.querySelector("#modal .modal-body").innerHTML = html;
}

export function saleDetail(id) {
    const v = state.sales.find(x => x.id === id);
    if (!v) return;
    showInfo(`Venta ${v.id}`, `<div class="detail">
        <div class="detail-row"><span>Fecha</span><strong>${esc(fmtDateTime(v.date))}</strong></div>
        <div class="detail-row"><span>Cliente</span><strong>${esc(v.clientName)}</strong></div>
        <div class="detail-row"><span>Ubicación</span><strong>${esc(locName(v.locationId))}</strong></div>
        <table class="mini-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>
        ${v.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${esc(money(i.price))}</td><td>${esc(money(i.qty * i.price))}</td></tr>`).join("")}
        </tbody></table><div class="detail-row total"><span>Total</span><strong>${esc(money(v.total))}</strong></div>
    </div>`);
}

/* ---------- Pedidos ---------- */
export function newOrder() {
    if (!ui.cart.length) return toast("Agrega al menos un producto al pedido.", "error");
    const clientId = document.getElementById("order-client")?.value;
    const destination = document.getElementById("order-dest")?.value;
    if (!clientId || !destination) return toast("Selecciona cliente y destino.", "error");
    transact(() => {
        const items = ui.cart.map(i => ({ sku: i.sku, name: prod(i.sku)?.name || i.sku, qty: i.qty }));
        const id = "PD" + (++state.counters.order);
        const fecha = new Date().toISOString();
        state.orders.push({
            id, date: fecha, clientId, clientName: cliName(clientId), destination, items,
            status: "pendiente", origin: null, route: null, km: 0, dispatchedAt: null, deliveredAt: null,
            history: [{ status: "pendiente", date: fecha, note: "Pedido registrado en la cola FIFO" }]
        });
        logMov("Pedido", `${id} en cola: ${items.map(i => `${i.qty} × ${i.name}`).join(", ")} para ${locName(destination)}`, id);
        clearCart();
    }, "Pedido creado y agregado a la cola.");
}

export const STATUS_LABEL = {
    pendiente: "Pendiente", despachado: "En camino", entregado: "Entregado", cancelado: "Cancelado"
};

export function orderDetail(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    showInfo(`Pedido ${o.id}`, `<div class="detail">
        <div class="detail-row"><span>Estado</span><strong>${esc(STATUS_LABEL[o.status] || o.status)}</strong></div>
        <div class="detail-row"><span>Cliente</span><strong>${esc(o.clientName)}</strong></div>
        <div class="detail-row"><span>Destino</span><strong>${esc(locName(o.destination))}</strong></div>
        <div class="detail-row"><span>Registro</span><strong>${esc(fmtDateTime(o.date))}</strong></div>
        ${o.origin ? `<div class="detail-row"><span>Origen</span><strong>${esc(locName(o.origin))}</strong></div>` : ""}
        ${o.km ? `<div class="detail-row"><span>Ruta</span><strong>${esc(routeText(o.route))} · ${o.km} km</strong></div>` : ""}
        <table class="mini-table"><thead><tr><th>Producto</th><th>Cantidad</th></tr></thead><tbody>
        ${o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td></tr>`).join("")}</tbody></table>
        <h3>Seguimiento</h3><div class="timeline">${(o.history || []).map(h => `
            <div class="timeline-item"><span class="dot"></span><div><strong>${esc(STATUS_LABEL[h.status] || h.status)}</strong><small>${esc(fmtDateTime(h.date))}${h.note ? " · " + esc(h.note) : ""}</small></div></div>`).join("")}</div>
    </div>`);
}

export function dispatchOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o || o.status !== "pendiente") return;
    const candidates = state.locations.filter(l => l.type !== "sucursal" && o.items.every(i => stockOf(l.id, i.sku) >= i.qty))
        .map(l => ({ location: l, route: dijkstra(l.id, o.destination) }))
        .filter(x => x.route);
    if (!candidates.length) return toast("Ninguna bodega tiene todo el stock o no hay ruta al destino.", "error");
    candidates.sort((a, b) => a.route.km - b.route.km);
    openForm({
        title: `Despachar ${o.id}`,
        subtitle: `Destino: ${locName(o.destination)} · se sugiere la bodega más cercana con stock`,
        fields: [{ key: "origin", label: "Bodega de origen", type: "select",
            options: candidates.map(c => ({ value: c.location.id, label: `${c.location.name} · ${c.route.km} km` })) }],
        submit: "Confirmar despacho",
        onSubmit: d => {
            const chosen = candidates.find(c => c.location.id === d.origin);
            if (!chosen) return toast("Selecciona una bodega válida.", "error");
            transact(() => {
                o.items.forEach(i => {
                    state.stock[d.origin][i.sku] -= i.qty;
                    state.stock[o.destination][i.sku] = stockOf(o.destination, i.sku) + i.qty;
                });
                o.status = "despachado";
                o.origin = d.origin;
                o.route = chosen.route.path;
                o.km = chosen.route.km;
                o.dispatchedAt = new Date().toISOString();
                o.history.push({ status: "despachado", date: o.dispatchedAt, note: `Desde ${locName(d.origin)} · ${chosen.route.km} km` });
                logMov("Despacho", `${o.id}: desde ${locName(d.origin)} por ${routeText(chosen.route.path)} (${chosen.route.km} km)`, o.id);
            }, `${o.id} despachado desde ${locName(d.origin)}.`);
        }
    });
}

export function deliverOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o || o.status !== "despachado") return;
    transact(() => {
        o.status = "entregado";
        o.deliveredAt = new Date().toISOString();
        o.history.push({ status: "entregado", date: o.deliveredAt, note: "Entrega confirmada" });
        logMov("Entrega", `${o.id} entregado en ${locName(o.destination)}`, o.id);
    }, "Entrega confirmada.");
}

export function cancelOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o || ["entregado", "cancelado"].includes(o.status)) return;
    if (o.status === "despachado" && o.items.some(i => stockOf(o.destination, i.sku) < i.qty)) {
        return toast("No se puede cancelar: el destino ya consumió parte del stock despachado.", "error");
    }
    openConfirm("Cancelar pedido", `¿Cancelar ${o.id}?${o.status === "despachado" ? " El stock regresará a la bodega de origen." : ""}`, () => transact(() => {
        if (o.status === "despachado" && o.origin) {
            o.items.forEach(i => {
                state.stock[o.destination][i.sku] -= i.qty;
                state.stock[o.origin][i.sku] = stockOf(o.origin, i.sku) + i.qty;
            });
        }
        o.status = "cancelado";
        o.history.push({ status: "cancelado", date: new Date().toISOString(), note: "Pedido cancelado" });
        logMov("Cancelación", `${o.id} cancelado${o.origin ? ` · stock devuelto a ${locName(o.origin)}` : ""}`, o.id);
    }, "Pedido cancelado."), "Cancelar pedido");
}

/* ---------- Rutas y conexiones ---------- */
export function calculateRoute() {
    const a = document.getElementById("route-from")?.value;
    const b = document.getElementById("route-to")?.value;
    if (!a || !b || a === b) return toast("Elige dos ubicaciones distintas.", "error");
    const short = dijkstra(a, b);
    const few = bfs(a, b);
    ui.route = `<div class="route-result">
        ${short ? `<div class="route-card"><h3> Menor distancia (Dijkstra)</h3><p class="path">${short.path.map(x => `<b>${esc(locName(x))}</b>`).join(" → ")}</p><strong>${short.km} km</strong></div>` : ""}
        ${few ? `<div class="route-card"><h3> Menos tramos (BFS)</h3><p class="path">${few.map(x => `<b>${esc(locName(x))}</b>`).join(" → ")}</p><strong>${few.length - 1} tramo(s)</strong></div>` : ""}
        ${!short && !few ? `<p class="muted">No hay ruta disponible entre esas ubicaciones.</p>` : ""}
    </div>`;
    hooks.render();
}

function edgeFields(a = "", b = "") {
    return [
        { key: "a", label: "Desde", type: "select", options: state.locations.map(l => ({ value: l.id, label: l.name })), value: a },
        { key: "b", label: "Hasta", type: "select", options: state.locations.map(l => ({ value: l.id, label: l.name })), value: b },
        { key: "km", label: "Distancia (km)", type: "number", min: 1, step: "1", required: true, full: true }
    ];
}

export function newEdge() {
    openForm({ title: "Nueva conexión", fields: edgeFields(), submit: "Crear conexión", onSubmit: d => {
        if (d.a === d.b) return toast("Elige dos ubicaciones distintas.", "error");
        if (state.edges.some(e => (e.a === d.a && e.b === d.b) || (e.a === d.b && e.b === d.a))) return toast("Esa conexión ya existe.", "error");
        transact(() => {
            state.edges.push({ id: "R" + (++state.counters.route), a: d.a, b: d.b, km: Number(d.km) });
            logMov("Conexión", `Se agregó ${locName(d.a)} ↔ ${locName(d.b)} (${d.km} km)`, d.a);
        }, "Conexión creada.");
    } });
}

export function editEdge(id) {
    const e = state.edges.find(x => x.id === id);
    if (!e) return;
    openForm({ title: "Editar conexión", subtitle: `${locName(e.a)} ↔ ${locName(e.b)}`, fields: edgeFields(e.a, e.b).filter(f => f.key === "km"), values: { km: e.km }, onSubmit: d => {
        transact(() => {
            e.km = Number(d.km);
            logMov("Conexión", `Se actualizó ${locName(e.a)} ↔ ${locName(e.b)} (${e.km} km)`, e.a);
        }, "Distancia actualizada.");
    } });
}

export function deleteEdge(id) {
    const e = state.edges.find(x => x.id === id);
    if (!e) return;
    openConfirm("Eliminar conexión", `¿Eliminar el tramo ${locName(e.a)} ↔ ${locName(e.b)} (${e.km} km)?`, () => transact(() => {
        state.edges = state.edges.filter(x => x.id !== id);
        logMov("Conexión", `Se eliminó ${locName(e.a)} ↔ ${locName(e.b)}`, e.a);
    }, "Conexión eliminada."), "Eliminar");
}

/* ---------- Ajustes ---------- */
export function exportCSV() {
    const filas = [["Fecha", "Tipo", "Detalle", "Referencia"], ...state.movements.map(m => [fmtDateTime(m.date), m.type, m.detail, m.ref || ""])];
    const csv = "\uFEFF" + filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), "manguitrack-bitacora.csv");
    toast("Bitácora exportada en CSV.");
}

export function exportJSON() {
    download(new Blob([JSON.stringify({ ...state, undo: [] }, null, 2)], { type: "application/json" }), "manguitrack-respaldo.json");
    toast("Respaldo descargado.");
}

export function importClick() { document.getElementById("import-file")?.click(); }

export function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch { return toast("El archivo no es un JSON válido.", "error"); }
        if (data?.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.locations)) return toast("El respaldo no es compatible.", "error");
        openConfirm("Importar respaldo", "Se reemplazarán todos los datos actuales con los del archivo seleccionado.", () => {
            replaceState(data);
            toast("Respaldo importado correctamente.");
        }, "Importar");
    };
    reader.readAsText(file);
}

export function resetDemo() {
    openConfirm("Restaurar datos", "Se borrarán ventas, pedidos y movimientos, y se restaurará el catálogo de ejemplo.", () => {
        replaceState(seedState());
        ui.cart = [];
        ui.route = null;
        toast("Datos de ejemplo restaurados.");
    }, "Restaurar");
}

export function setThemeAction(theme) {
    setTheme(theme);
    hooks.render();
}
