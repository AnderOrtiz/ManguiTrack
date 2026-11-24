/* =========================================================
   ManguiTrack · estructura, navegación y vistas de catálogos
   ========================================================= */
import {
    state, ui, esc, money, fmtDateTime, prod, cat, prv, cli, loc,
    catName, prvName, locName, cliName, stockOf, totalStock, stockBajo,
    pedidosPendientes, entregasActivas, ventasTotales
} from "./state.js";
import { badge, empty, panel, sectionHead, table } from "./ui.js";
import { renderOperacion, renderLogistica, renderAuditoria } from "./views-op.js";

const GROUPS = [
    { label: "General", items: [["resumen", "Resumen"]] },
    { label: "Catálogos", items: [
        ["productos", "Productos"], ["categorias", "Categorías"],
        ["proveedores", "Proveedores"], ["clientes", "Clientes"],
        ["ubicaciones", "Ubicaciones"]
    ] },
    { label: "Operación", items: [
        ["inventario", "Inventario"], ["transferencias", "Transferencias"],
        ["ventas", "Ventas"], ["pedidos", "Pedidos"],
        ["entregas", "Entregas"]
    ] },
    { label: "Logística", items: [["rutas", "Rutas y conexiones"]] },
    { label: "Auditoría", items: [["bitacora", "Bitácora"], ["ajustes", "Ajustes"]] }
];

const TITLES = Object.fromEntries(GROUPS.flatMap(g => g.items));

const itemCount = id => id === "pedidos" ? pedidosPendientes().length
    : id === "entregas" ? entregasActivas().length : 0;

function nav() {
    return GROUPS.map(group => {
        const active = group.items.some(([id]) => id === ui.section);
        const count = group.items.reduce((sum, [id]) => sum + itemCount(id), 0);
        return `<div class="nav-group ${active ? "active" : ""}">
            <button class="nav-trigger" aria-haspopup="true" title="Mostrar opciones de ${esc(group.label)}">
                ${esc(group.label)}${count ? `<span class="nav-count">${count}</span>` : ""}<span class="nav-caret" aria-hidden="true"></span>
            </button>
            <div class="nav-menu">
                ${group.items.map(([id, label]) => `<button class="nav-item ${ui.section === id ? "active" : ""}" data-act="nav" data-section="${id}">
                    ${esc(label)}${itemCount(id) ? `<span class="nav-count">${itemCount(id)}</span>` : ""}
                </button>`).join("")}
            </div>
        </div>`;
    }).join("");
}

function header() {
    const current = TITLES[ui.section] || "Resumen";
    const themeLabel = { auto: "Auto", light: "Claro", dark: "Oscuro" }[ui.theme] || "Auto";
    return `<header class="app-header">
        <div class="header-top">
            <div class="brand"><div class="brand-mark">M</div><div><strong>ManguiTrack</strong><small>Los Manguitos · Chivo NET</small></div></div>
            <div class="header-actions">
                <span class="current-page">${esc(current)}</span>
                <button class="btn ghost sm" data-act="undo">Deshacer</button>
                <button class="btn ghost sm" data-act="theme">Tema: ${themeLabel}</button>
            </div>
        </div>
        <nav class="topnav" aria-label="Navegación principal">${nav()}</nav>
    </header>`;
}

export function render() {
    document.getElementById("app").innerHTML = `${header()}<main class="content">${view()}</main>`;
}

function view() {
    switch (ui.section) {
        case "resumen": return viewResumen();
        case "productos": return viewProductos();
        case "categorias": return viewCategorias();
        case "proveedores": return viewProveedores();
        case "clientes": return viewClientes();
        case "ubicaciones": return viewUbicaciones();
        case "inventario": return viewInventario();
        case "transferencias": return viewTransferencias();
        case "rutas": return renderLogistica();
        default:
            return ["ventas", "pedidos", "entregas"].includes(ui.section)
                ? renderOperacion(ui.section)
                : renderAuditoria(ui.section);
    }
}

/* ---------- Resumen ---------- */
function viewResumen() {
    const kpis = [
        ["Productos", state.products.length, `${state.categories.length} categorías`],
        ["Unidades en stock", state.locations.reduce((n, l) => n + Object.values(state.stock[l.id] || {}).reduce((a, b) => a + b, 0), 0).toLocaleString("es-SV"), `${state.locations.length} ubicaciones`],
        ["Ventas", money(ventasTotales()), `${state.sales.length} operaciones`],
        ["Pedidos pendientes", pedidosPendientes().length, `${entregasActivas().length} en camino`]
    ];
    const bajos = stockBajo().slice(0, 6);
    const pendientes = pedidosPendientes().slice(0, 5);
    return `${sectionHead("Resumen general", "Una vista rápida del estado del negocio", `
        <button class="btn primary" data-act="nav" data-section="ventas">+ Nueva venta</button>
        <button class="btn" data-act="nav" data-section="pedidos">+ Nuevo pedido</button>`)}
        <div class="kpi-grid">${kpis.map(([label, value, note]) => `
            <div class="kpi"><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div></div>`).join("")}</div>
        <div class="two-col">
            ${panel("Alertas de stock", bajos.length ? `<div class="list">${bajos.map(x => `
                <div class="list-row"><div><strong>${esc(x.product.name)}</strong><small>${esc(locName(x.location.id))}</small></div>${badge(`${x.qty} uds`, "danger")}</div>`).join("")}</div>`
                : empty("", "Todo en orden", "Ningún producto está por debajo del mínimo."),
                `<button class="link" data-act="nav" data-section="inventario">Ver inventario →</button>`)}
            ${panel("Cola de pedidos (FIFO)", pendientes.length ? `<div class="list">${pendientes.map(o => `
                <div class="list-row"><div><strong>${esc(o.id)} · ${esc(cliName(o.clientId))}</strong><small>${esc(locName(o.destination))} · ${o.items.length} producto(s)</small></div>${badge("Pendiente", "warn")}</div>`).join("")}</div>`
                : empty("", "Sin pedidos pendientes", "Los nuevos pedidos aparecerán aquí."),
                `<button class="link" data-act="nav" data-section="pedidos">Ver pedidos →</button>`)}
        </div>
        ${panel("Actividad reciente", state.movements.length ? `<div class="list">${state.movements.slice(0, 6).map(m => `
            <div class="list-row"><div><strong>${esc(m.type)}</strong><small>${esc(m.detail)}</small></div><small>${esc(fmtDateTime(m.date))}</small></div>`).join("")}</div>`
            : empty("", "Aún no hay movimientos", "Registra una entrada, venta o pedido para comenzar."),
            `<button class="link" data-act="nav" data-section="bitacora">Ver bitácora →</button>`)}`;
}

/* ---------- Productos ---------- */
function viewProductos() {
    const q = ui.filters.productos.trim().toLowerCase();
    const rows = state.products.filter(p =>
        !q || `${p.sku} ${p.name} ${catName(p.categoryId)} ${prvName(p.providerId)}`.toLowerCase().includes(q)
    ).map(p => `<tr>
        <td><span class="mono">${esc(p.sku)}</span></td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${badge(catName(p.categoryId))}</td>
        <td>${esc(prvName(p.providerId))}</td>
        <td class="right">${esc(money(p.price))}</td>
        <td class="right">${totalStock(p.sku).toLocaleString("es-SV")}</td>
        <td class="row-actions">
            <button class="icon-btn" data-act="edit-product" data-id="${esc(p.sku)}" title="Editar">Editar</button>
            <button class="icon-btn danger" data-act="delete-product" data-id="${esc(p.sku)}" title="Eliminar">×</button>
        </td></tr>`);
    return `${sectionHead("Productos", "Catálogo con precios, categorías y proveedores", `<button class="btn primary" data-act="new-product">+ Nuevo producto</button>`)}
        ${panel("Catálogo de productos", `
            <div class="toolbar"><input class="search" type="search" placeholder="Buscar por SKU, nombre, categoría o proveedor…" data-filter="productos" value="${esc(ui.filters.productos)}"></div>
            ${table(["SKU", "Producto", "Categoría", "Proveedor", "Precio", "Stock", ""], rows) || empty("", "No hay productos", "Crea el primer producto del catálogo.", `<button class="btn primary" data-act="new-product">+ Nuevo producto</button>`)}`)}`;
}

/* ---------- Categorías ---------- */
function categoryStock(id) {
    const direct = state.products.filter(p => p.categoryId === id).reduce((s, p) => s + totalStock(p.sku), 0);
    return direct + state.categories.filter(c => c.parentId === id).reduce((s, c) => s + categoryStock(c.id), 0);
}
function categoryRows(parentId = null, level = 0) {
    return state.categories.filter(c => c.parentId === parentId).flatMap(c => {
        const count = state.products.filter(p => p.categoryId === c.id).length;
        const row = `<tr>
            <td style="padding-left:${12 + level * 20}px">${level ? "└ " : ""}<strong>${esc(c.name)}</strong></td>
            <td>${count} producto(s)</td>
            <td class="right">${categoryStock(c.id).toLocaleString("es-SV")} uds</td>
            <td class="row-actions">
                <button class="icon-btn" data-act="add-subcategory" data-id="${esc(c.id)}" title="Agregar subcategoría">+</button>
                <button class="icon-btn" data-act="edit-category" data-id="${esc(c.id)}" title="Editar">Editar</button>
                <button class="icon-btn danger" data-act="delete-category" data-id="${esc(c.id)}" title="Eliminar">×</button>
            </td></tr>`;
        return [row, ...categoryRows(c.id, level + 1)];
    });
}
function viewCategorias() {
    return `${sectionHead("Categorías", "Árbol de categorías con existencias calculadas", `<button class="btn primary" data-act="new-category">+ Nueva categoría</button>`)}
        ${panel("Estructura del catálogo", table(["Categoría", "Productos directos", "Stock total", ""], categoryRows()) || empty("", "Sin categorías", "Crea una categoría para organizar tus productos."))}`;
}

/* ---------- Proveedores ---------- */
function viewProveedores() {
    const rows = state.providers.map(p => {
        const n = state.products.filter(x => x.providerId === p.id).length;
        return `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.contact || "—")}</td>
            <td>${badge(n + " producto(s)")}</td><td class="row-actions">
            <button class="icon-btn" data-act="edit-provider" data-id="${esc(p.id)}" title="Editar">Editar</button>
            <button class="icon-btn danger" data-act="delete-provider" data-id="${esc(p.id)}" title="Eliminar">×</button></td></tr>`;
    });
    return `${sectionHead("Proveedores", "Registro de proveedores y sus productos", `<button class="btn primary" data-act="new-provider">+ Nuevo proveedor</button>`)}
        ${panel("Proveedores", table(["Proveedor", "Contacto", "Productos", ""], rows) || empty("", "Sin proveedores", "Agrega tu primer proveedor."))}`;
}

/* ---------- Clientes ---------- */
function viewClientes() {
    const q = ui.filters.clientes.trim().toLowerCase();
    const rows = state.clients.filter(c => !q || `${c.name} ${c.phone || ""}`.toLowerCase().includes(q)).map(c => {
        const n = state.sales.filter(v => v.clientId === c.id).length;
        return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone || "—")}</td>
            <td>${n} compra(s)</td><td class="row-actions">
            <button class="icon-btn" data-act="edit-client" data-id="${esc(c.id)}" title="Editar">Editar</button>
            <button class="icon-btn danger" data-act="delete-client" data-id="${esc(c.id)}" title="Eliminar">×</button></td></tr>`;
    });
    return `${sectionHead("Clientes", "Clientes registrados para ventas y pedidos", `<button class="btn primary" data-act="new-client">+ Nuevo cliente</button>`)}
        ${panel("Clientes", `<div class="toolbar"><input class="search" type="search" placeholder="Buscar cliente…" data-filter="clientes" value="${esc(ui.filters.clientes)}"></div>
        ${table(["Cliente", "Teléfono", "Compras", ""], rows) || empty("", "No hay clientes", "Registra un cliente para empezar a vender.")}`)}`;
}

/* ---------- Ubicaciones ---------- */
const TIPO_LABEL = { central: "Central", bodega: "Bodega", sucursal: "Sucursal" };
function viewUbicaciones() {
    const rows = state.locations.map(l => {
        const unidades = Object.values(state.stock[l.id] || {}).reduce((a, b) => a + b, 0);
        return `<tr><td><span class="mono">${esc(l.id)}</span></td><td><strong>${esc(l.name)}</strong></td>
            <td>${badge(TIPO_LABEL[l.type] || l.type, l.type === "bodega" ? "info" : l.type === "sucursal" ? "purple" : "ok")}</td>
            <td class="right">${unidades.toLocaleString("es-SV")}</td><td class="row-actions">
            <button class="icon-btn" data-act="edit-location" data-id="${esc(l.id)}" title="Editar">Editar</button>
            <button class="icon-btn danger" data-act="delete-location" data-id="${esc(l.id)}" title="Eliminar">×</button></td></tr>`;
    });
    return `${sectionHead("Ubicaciones", "Central, bodegas y sucursales con existencias propias", `<button class="btn primary" data-act="new-location">+ Nueva ubicación</button>`)}
        ${panel("Ubicaciones registradas", table(["Código", "Nombre", "Tipo", "Unidades", ""], rows) || empty("", "Sin ubicaciones", "Agrega bodegas y sucursales."))}`;
}

/* ---------- Inventario ---------- */
function viewInventario() {
    const bajos = stockBajo();
    const heads = ["SKU", "Producto", ...state.locations.map(l => esc(l.name)), "Total"];
    const rows = state.products.map(p => `<tr>
        <td><span class="mono">${esc(p.sku)}</span></td><td><strong>${esc(p.name)}</strong></td>
        ${state.locations.map(l => `<td class="right ${stockOf(l.id, p.sku) < 8 ? "low" : ""}">${stockOf(l.id, p.sku).toLocaleString("es-SV")}</td>`).join("")}
        <td class="right"><strong>${totalStock(p.sku).toLocaleString("es-SV")}</strong></td></tr>`);
    const locOptions = state.locations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    const prodOptions = state.products.map(p => `<option value="${esc(p.sku)}">${esc(p.name)}</option>`).join("");
    return `${sectionHead("Inventario", "Existencias por ubicación, entradas y salidas")}
        ${panel("Movimiento de inventario", `<div class="form-grid four">
            <div class="field"><label for="inv-loc">Ubicación</label><select id="inv-loc">${locOptions}</select></div>
            <div class="field"><label for="inv-prod">Producto</label><select id="inv-prod">${prodOptions}</select></div>
            <div class="field"><label for="inv-qty">Cantidad</label><input id="inv-qty" type="number" min="1" value="1"></div>
            <div class="field"><label for="inv-note">Nota (opcional)</label><input id="inv-note" type="text" placeholder="Ej. Factura 001"></div>
        </div><div class="form-actions"><button class="btn primary" data-act="inv-in">↓ Registrar entrada</button><button class="btn danger-ghost" data-act="inv-out">↑ Registrar salida</button></div>`)}
        ${bajos.length ? panel("Stock bajo (menos de 8 unidades)", `<div class="chips">${bajos.map(x => `<span class="chip warn">${esc(x.product.name)} · ${esc(locName(x.location.id))} · ${x.qty}</span>`).join("")}</div>`) : ""}
        ${panel("Existencias por ubicación", table(heads, rows) || empty("", "Sin productos", "Registra productos para ver el inventario."))}`;
}

/* ---------- Transferencias ---------- */
function viewTransferencias() {
    const locOptions = state.locations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    const prodOptions = state.products.map(p => `<option value="${esc(p.sku)}">${esc(p.name)}</option>`).join("");
    const historial = state.movements.filter(m => m.type === "Transferencia").slice(0, 15)
        .map(m => `<tr><td>${esc(fmtDateTime(m.date))}</td><td>${esc(m.detail)}</td><td><span class="mono">${esc(m.ref || "—")}</span></td></tr>`);
    return `${sectionHead("Transferencias", "Mueve stock entre bodegas y sucursales calculando la ruta")}
        ${panel("Nueva transferencia", `<div class="form-grid four">
            <div class="field"><label for="tr-from">Origen</label><select id="tr-from">${locOptions}</select></div>
            <div class="field"><label for="tr-to">Destino</label><select id="tr-to">${locOptions}</select></div>
            <div class="field"><label for="tr-prod">Producto</label><select id="tr-prod">${prodOptions}</select></div>
            <div class="field"><label for="tr-qty">Cantidad</label><input id="tr-qty" type="number" min="1" value="1"></div>
        </div><div class="form-actions"><button class="btn primary" data-act="new-transfer"> Transferir</button></div>`)}
        ${panel("Últimas transferencias", table(["Fecha", "Detalle", "Referencia"], historial) || empty("", "Sin transferencias", "Las transferencias aparecerán aquí."))}`;
}


