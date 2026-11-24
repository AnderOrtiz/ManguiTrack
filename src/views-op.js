/* =========================================================
   ManguiTrack · vistas de operación, logística y auditoría
   ========================================================= */
import {
    state, ui, esc, money, fmtDate, fmtDateTime, prod, cli, loc,
    cliName, locName, routeText, stockOf, pedidosPendientes
} from "./state.js";
import { badge, empty, panel, sectionHead, table } from "./ui.js";

const STATUS = {
    pendiente: ["Pendiente", "warn"],
    despachado: ["En camino", "info"],
    entregado: ["Entregado", "ok"],
    cancelado: ["Cancelado", "muted"]
};
const statusBadge = status => badge((STATUS[status] || [status, ""])[0], (STATUS[status] || ["", ""])[1]);

function clientOptions(selected) {
    return state.clients.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("");
}
function productOptions() {
    return state.products.map(p => `<option value="${esc(p.sku)}">${esc(p.name)} · ${esc(money(p.price))}</option>`).join("");
}
function locationOptions(filter) {
    return state.locations.filter(filter || (() => true)).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
}
function cartTotal() {
    return ui.cart.reduce((sum, item) => sum + (prod(item.sku)?.price || 0) * item.qty, 0);
}
function cartBlock() {
    const rows = ui.cart.map(item => `<tr>
        <td>${esc(prod(item.sku)?.name || item.sku)}</td>
        <td class="right">${esc(money(prod(item.sku)?.price || 0))}</td>
        <td><input class="qty-input" type="number" min="1" value="${item.qty}" data-cart-qty="${esc(item.sku)}" aria-label="Cantidad de ${esc(prod(item.sku)?.name || item.sku)}"></td>
        <td class="right"><strong>${esc(money((prod(item.sku)?.price || 0) * item.qty))}</strong></td>
        <td><button class="icon-btn danger" data-act="cart-remove" data-sku="${esc(item.sku)}" title="Quitar">×</button></td>
    </tr>`);
    return `<div class="cart-box">
        ${table(["Producto", "Precio", "Cant.", "Subtotal", ""], rows) || `<p class="cart-empty">Agrega productos con el formulario de arriba.</p>`}
        <div class="cart-total"><span>Total</span><strong>${esc(money(cartTotal()))}</strong></div>
    </div>`;
}
function addCartForm() {
    return `<div class="form-grid four">
        <div class="field full"><label for="cart-product">Producto</label><select id="cart-product">${productOptions()}</select></div>
        <div class="field"><label for="cart-qty">Cantidad</label><input id="cart-qty" type="number" min="1" value="1"></div>
        <div class="field align-end"><button class="btn" data-act="cart-add">+ Agregar al carrito</button></div>
    </div>`;
}

/* ---------- Ventas ---------- */
function viewVentas() {
    const q = ui.filters.ventas.trim().toLowerCase();
    const rows = state.sales.filter(v => !q || `${v.id} ${v.clientName} ${v.items.map(i => i.name).join(" ")}`.toLowerCase().includes(q))
        .map(v => `<tr>
            <td><span class="mono">${esc(v.id)}</span></td>
            <td>${esc(fmtDate(v.date))}</td>
            <td>${esc(v.clientName)}</td>
            <td>${esc(locName(v.locationId))}</td>
            <td>${v.items.map(i => `${i.qty} × ${esc(i.name)}`).join("<br>")}</td>
            <td class="right"><strong>${esc(money(v.total))}</strong></td>
            <td><button class="icon-btn" data-act="sale-detail" data-id="${esc(v.id)}" title="Ver detalle">Ver</button></td>
        </tr>`);
    return `${sectionHead("Ventas", "Registro de ventas con clientes, productos y precios")}
        ${panel("Nueva venta", `<div class="form-grid three">
            <div class="field"><label for="sale-client">Cliente</label><select id="sale-client">${clientOptions()}</select></div>
            <div class="field"><label for="sale-loc">Ubicación de despacho</label><select id="sale-loc">${locationOptions()}</select></div>
            <div class="field align-end"><small class="hint">Los precios se toman del catálogo al momento de la venta.</small></div>
        </div>${addCartForm()}${cartBlock()}
        <div class="form-actions end"><button class="btn primary" data-act="new-sale"> Registrar venta</button></div>`)}
        ${panel("Historial de ventas", `<div class="toolbar"><input class="search" type="search" placeholder="Buscar venta…" data-filter="ventas" value="${esc(ui.filters.ventas)}"></div>
        ${table(["ID", "Fecha", "Cliente", "Ubicación", "Productos", "Total", ""], rows) || empty("", "Sin ventas", "Registra la primera venta usando el carrito de arriba.")}`)}`;
}

/* ---------- Pedidos ---------- */
function viewPedidos() {
    const q = ui.filters.pedidos.trim().toLowerCase();
    const rows = state.orders.filter(o => {
        const texto = `${o.id} ${cliName(o.clientId)} ${locName(o.destination)}`.toLowerCase();
        return (!q || texto.includes(q)) && (ui.filters.estado === "todos" || o.status === ui.filters.estado);
    }).map(o => `<tr>
        <td><span class="mono">${esc(o.id)}</span></td>
        <td>${esc(fmtDate(o.date))}</td>
        <td>${esc(cliName(o.clientId))}</td>
        <td>${esc(locName(o.destination))}</td>
        <td>${o.items.map(i => `${i.qty} × ${esc(prod(i.sku)?.name || i.sku)}`).join("<br>")}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="row-actions">
            <button class="icon-btn" data-act="order-detail" data-id="${esc(o.id)}" title="Ver detalle">Ver</button>
            ${o.status === "pendiente" ? `<button class="icon-btn" data-act="order-dispatch" data-id="${esc(o.id)}" title="Despachar"></button>` : ""}
            ${o.status === "despachado" ? `<button class="icon-btn" data-act="order-deliver" data-id="${esc(o.id)}" title="Marcar entregado"></button>` : ""}
            ${!["entregado", "cancelado"].includes(o.status) ? `<button class="icon-btn danger" data-act="order-cancel" data-id="${esc(o.id)}" title="Cancelar">×</button>` : ""}
        </td></tr>`);
    const estados = [["todos", "Todos los estados"], ["pendiente", "Pendiente"], ["despachado", "En camino"], ["entregado", "Entregado"], ["cancelado", "Cancelado"]];
    return `${sectionHead("Pedidos", "Cola FIFO, estados y despacho desde la bodega más cercana")}
        ${panel("Nuevo pedido", `<div class="form-grid three">
            <div class="field"><label for="order-client">Cliente</label><select id="order-client">${clientOptions()}</select></div>
            <div class="field"><label for="order-dest">Destino</label><select id="order-dest">${locationOptions(l => l.type !== "bodega")}</select></div>
            <div class="field align-end"><small class="hint">El stock se descuenta al despachar, no al crear el pedido.</small></div>
        </div>${addCartForm()}${cartBlock()}
        <div class="form-actions end"><button class="btn primary" data-act="new-order"> Crear pedido</button></div>`)}
        ${panel("Pedidos registrados", `<div class="toolbar">
            <input class="search" type="search" placeholder="Buscar pedido…" data-filter="pedidos" value="${esc(ui.filters.pedidos)}">
            <select data-filter="estado" class="filter-select">${estados.map(([v, l]) => `<option value="${v}" ${ui.filters.estado === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>${table(["ID", "Fecha", "Cliente", "Destino", "Productos", "Estado", ""], rows) || empty("", "No hay pedidos", "Crea un pedido con el carrito de arriba.")}`)}`;
}

/* ---------- Entregas ---------- */
function viewEntregas() {
    const activas = state.orders.filter(o => ["despachado", "entregado"].includes(o.status) || (o.status === "cancelado" && o.origin));
    const rows = activas.map(o => `<tr>
        <td><span class="mono">${esc(o.id)}</span></td>
        <td>${statusBadge(o.status)}</td>
        <td>${esc(locName(o.origin || "—"))}</td>
        <td>${esc(locName(o.destination))}</td>
        <td>${o.route?.length ? esc(routeText(o.route)) : "—"}</td>
        <td class="right">${o.km ? `${o.km} km` : "—"}</td>
        <td>${o.dispatchedAt ? esc(fmtDate(o.dispatchedAt)) : "—"}</td>
        <td class="row-actions">
            <button class="icon-btn" data-act="order-detail" data-id="${esc(o.id)}" title="Ver detalle">Ver</button>
            ${o.status === "despachado" ? `<button class="icon-btn" data-act="order-deliver" data-id="${esc(o.id)}" title="Confirmar entrega"></button>
            <button class="icon-btn danger" data-act="order-cancel" data-id="${esc(o.id)}" title="Cancelar">×</button>` : ""}
        </td></tr>`);
    const kpis = [
        ["En camino", state.orders.filter(o => o.status === "despachado").length],
        ["Entregadas", state.orders.filter(o => o.status === "entregado").length],
        ["Kilómetros recorridos", state.orders.filter(o => o.km).reduce((s, o) => s + o.km, 0) + " km"]
    ];
    return `${sectionHead("Entregas", "Seguimiento de los pedidos despachados a sucursales")}
        <div class="kpi-grid three">${kpis.map(([label, value]) => `<div class="kpi"><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div></div>`).join("")}</div>
        ${panel("Entregas registradas", table(["Pedido", "Estado", "Origen", "Destino", "Ruta", "Dist.", "Despacho", ""], rows) || empty("", "Sin entregas", "Despacha un pedido para comenzar el seguimiento."),
            `<button class="link" data-act="nav" data-section="pedidos">Ir a pedidos →</button>`)}`;
}

export function renderOperacion(section) {
    return section === "ventas" ? viewVentas() : section === "pedidos" ? viewPedidos() : viewEntregas();
}

/* ---------- Rutas y conexiones ---------- */
export function renderLogistica() {
    const locOptions = state.locations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    const edgeRows = state.edges.map(e => `<tr>
        <td>${esc(locName(e.a))}</td><td>${esc(locName(e.b))}</td>
        <td class="right">${e.km} km</td><td class="row-actions">
        <button class="icon-btn" data-act="edit-edge" data-id="${esc(e.id)}" title="Editar">Editar</button>
        <button class="icon-btn danger" data-act="delete-edge" data-id="${esc(e.id)}" title="Eliminar">×</button></td></tr>`);
    return `${sectionHead("Rutas y conexiones", "Grafo de la red entre central, bodegas y sucursales", `<button class="btn primary" data-act="new-edge">+ Nueva conexión</button>`)}
        ${panel("Consultar ruta", `<div class="form-grid three">
            <div class="field"><label for="route-from">Origen</label><select id="route-from">${locOptions}</select></div>
            <div class="field"><label for="route-to">Destino</label><select id="route-to">${locOptions}</select></div>
            <div class="field align-end"><button class="btn primary" data-act="calculate-route"> Calcular rutas</button></div>
        </div><div id="route-result">${ui.route || ""}</div>`)}
        ${panel("Conexiones de la red", table(["Desde", "Hasta", "Distancia", ""], edgeRows) || empty("", "Sin conexiones", "Agrega tramos para calcular rutas."))}`;
}

/* ---------- Bitácora ---------- */
export function renderAuditoria(section) {
    if (section === "ajustes") return viewAjustes();
    const q = ui.filters.bitacora.trim().toLowerCase();
    const tipos = [...new Set(state.movements.map(m => m.type))].sort();
    const rows = state.movements.filter(m =>
        (!q || `${m.type} ${m.detail} ${m.ref}`.toLowerCase().includes(q)) &&
        (ui.filters.tipo === "todos" || m.type === ui.filters.tipo)
    ).map(m => `<tr>
        <td class="nowrap">${esc(fmtDateTime(m.date))}</td>
        <td>${badge(m.type, "soft")}</td><td>${esc(m.detail)}</td>
        <td><span class="mono">${esc(m.ref || "—")}</span></td></tr>`);
    return `${sectionHead("Bitácora", "Registro de todos los movimientos y operaciones", `
        <button class="btn" data-act="undo"> Deshacer</button>
        <button class="btn primary" data-act="export-csv"> Exportar CSV</button>`)}
        ${panel("Historial de operaciones", `<div class="toolbar">
            <input class="search" type="search" placeholder="Buscar en la bitácora…" data-filter="bitacora" value="${esc(ui.filters.bitacora)}">
            <select data-filter="tipo" class="filter-select"><option value="todos">Todos los tipos</option>
            ${tipos.map(t => `<option value="${esc(t)}" ${ui.filters.tipo === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        </div>${table(["Fecha", "Tipo", "Detalle", "Ref."], rows) || empty("", "Sin movimientos", "Cada operación quedará registrada aquí.")}`)}`;
}

/* ---------- Ajustes ---------- */
function viewAjustes() {
    const themes = [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]];
    return `${sectionHead("Ajustes", "Apariencia, respaldos y datos de demostración")}
        <div class="two-col">
            ${panel("Apariencia", `<p class="muted">El tema se guarda en este navegador.</p><div class="theme-picker">
                ${themes.map(([value, label]) => `<button class="theme-option ${ui.theme === value ? "selected" : ""}" data-act="set-theme" data-theme="${value}">
                    <strong>${label}</strong></button>`).join("")}</div>`)}
            ${panel("Datos", `<p class="muted">Todo se almacena localmente con <strong>localStorage</strong>.</p>
                <div class="stack">
                    <button class="btn" data-act="export-json"> Exportar respaldo JSON</button>
                    <button class="btn" data-act="import-click"> Importar respaldo</button>
                    <input type="file" id="import-file" accept="application/json,.json" hidden>
                    <button class="btn danger-ghost" data-act="reset-demo"> Restaurar datos de ejemplo</button>
                </div>`)}
        </div>
        ${panel("Información", `<div class="list">
            <div class="list-row"><div><strong>Versión</strong><small>ManguiTrack 1.0 · prototipo Chivo NET</small></div>${badge("Activo", "ok")}</div>
            <div class="list-row"><div><strong>Registros</strong><small>${state.products.length} productos · ${state.locations.length} ubicaciones · ${state.clients.length} clientes</small></div>${badge(state.movements.length + " movimientos")}</div>
            <div class="list-row"><div><strong>Pedidos pendientes</strong><small>Atención en orden FIFO</small></div>${badge(pedidosPendientes().length, "warn")}</div>
        </div>`)}`;
}
