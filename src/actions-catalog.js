/* =========================================================
   ManguiTrack · acciones de catálogos e inventario
   ========================================================= */
import {
    state, ui, esc, money, transact, logMov, stockOf, totalStock,
    cat, prv, cli, loc, prod, dijkstra, routeText, locName, prvName, catName,
    nextSku, esDescendiente
} from "./state.js";
import { openForm, openConfirm, toast } from "./ui.js";

const number = value => Number(value);
const validQty = q => Number.isInteger(q) && q > 0;
const catOptions = (selected, excluir = null) => [
    { value: "", label: "Sin categoría" },
    ...state.categories.filter(c => c.id !== excluir && !esDescendiente(c.id, excluir))
        .map(c => ({ value: c.id, label: c.name }))
];
const prvOptions = () => [{ value: "", label: "Sin proveedor" }, ...state.providers.map(p => ({ value: p.id, label: p.name }))];
const locOptions = () => state.locations.map(l => ({ value: l.id, label: l.name }));
const productOptions = () => state.products.map(p => ({ value: p.sku, label: `${p.sku} · ${p.name}` }));
const typeOptions = () => ["central", "bodega", "sucursal"].map(t => ({
    value: t, label: { central: "Central", bodega: "Bodega", sucursal: "Sucursal" }[t]
}));

/* ---------- Productos ---------- */
function productFields(sku) {
    return [
        { key: "sku", label: "SKU", required: true, value: sku, hint: "Identificador único del producto." },
        { key: "name", label: "Nombre del producto", required: true },
        { key: "categoryId", label: "Categoría", type: "select", options: catOptions() },
        { key: "providerId", label: "Proveedor", type: "select", options: prvOptions() },
        { key: "price", label: "Precio ($)", type: "number", min: 0, step: "0.01", required: true, full: true }
    ];
}

export function newProduct() {
    openForm({
        title: "Nuevo producto", fields: productFields(nextSku()), submit: "Crear producto",
        onSubmit: d => {
            const sku = d.sku.trim().toUpperCase();
            if (!sku || !d.name.trim()) return toast("Completa los campos obligatorios.", "error");
            if (prod(sku)) return toast("Ya existe un producto con ese SKU.", "error");
            transact(() => {
                state.products.push({ sku, name: d.name.trim(), categoryId: d.categoryId || null, providerId: d.providerId || null, price: number(d.price) });
                state.locations.forEach(l => { state.stock[l.id] = state.stock[l.id] || {}; state.stock[l.id][sku] = 0; });
                logMov("Producto", `Se creó ${sku} · ${d.name.trim()}`, sku);
            }, "Producto creado correctamente.");
        }
    });
}

export function editProduct(sku) {
    const p = prod(sku);
    if (!p) return;
    const fields = productFields(sku).map(f => f.key === "sku" ? { ...f, hint: "El SKU no se puede modificar." } : f);
    openForm({
        title: "Editar producto", subtitle: sku, fields,
        values: { ...p },
        onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                Object.assign(p, { name: d.name.trim(), categoryId: d.categoryId || null, providerId: d.providerId || null, price: number(d.price) });
                logMov("Producto", `Se actualizó ${sku} · ${p.name}`, sku);
            }, "Producto actualizado.");
        }
    });
}

export function deleteProduct(sku) {
    const p = prod(sku);
    if (!p) return;
    const usado = totalStock(sku) > 0 || state.sales.some(v => v.items.some(i => i.sku === sku)) || state.orders.some(o => o.items.some(i => i.sku === sku));
    if (usado) return toast("No se puede eliminar: el producto tiene stock o movimientos asociados.", "error");
    openConfirm("Eliminar producto", `¿Eliminar "${p.name}" (${sku}) del catálogo?`, () => transact(() => {
        state.products = state.products.filter(x => x.sku !== sku);
        state.locations.forEach(l => { delete state.stock[l.id]?.[sku]; });
        logMov("Producto", `Se eliminó ${sku} · ${p.name}`, sku);
    }, "Producto eliminado."), "Eliminar");
}

/* ---------- Categorías ---------- */
function categoryFields(id = null) {
    return [
        { key: "name", label: "Nombre de la categoría", required: true },
        { key: "parentId", label: "Categoría padre", type: "select", options: catOptions(null, id) }
    ];
}

export function newCategory(parentId = null) {
    openForm({
        title: "Nueva categoría", fields: categoryFields(), values: { parentId }, submit: "Crear categoría",
        onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                const id = "CAT" + (++state.counters.cat);
                state.categories.push({ id, name: d.name.trim(), parentId: d.parentId || null });
                logMov("Categoría", `Se creó la categoría ${d.name.trim()}`, id);
            }, "Categoría creada.");
        }
    });
}

export function editCategory(id) {
    const c = cat(id);
    if (!c) return;
    openForm({
        title: "Editar categoría", fields: categoryFields(id), values: { ...c }, onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            if (d.parentId === id) return toast("Una categoría no puede ser su propio padre.", "error");
            transact(() => {
                Object.assign(c, { name: d.name.trim(), parentId: d.parentId || null });
                logMov("Categoría", `Se actualizó la categoría ${c.name}`, id);
            }, "Categoría actualizada.");
        }
    });
}

export function deleteCategory(id) {
    const c = cat(id);
    if (!c) return;
    openConfirm("Eliminar categoría", `Se eliminará "${c.name}". Sus subcategorías y productos pasarán a la categoría padre (o quedarán sin categoría).`, () => transact(() => {
        state.categories.filter(x => x.parentId === id).forEach(x => { x.parentId = c.parentId || null; });
        state.products.filter(p => p.categoryId === id).forEach(p => { p.categoryId = c.parentId || null; });
        state.categories = state.categories.filter(x => x.id !== id);
        logMov("Categoría", `Se eliminó la categoría ${c.name}`, id);
    }, "Categoría eliminada."), "Eliminar");
}

/* ---------- Proveedores ---------- */
export function newProvider() {
    openForm({
        title: "Nuevo proveedor", fields: [
            { key: "name", label: "Nombre", required: true },
            { key: "contact", label: "Contacto", placeholder: "correo o teléfono" }
        ], onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                const id = "PRV" + (++state.counters.prv);
                state.providers.push({ id, name: d.name.trim(), contact: d.contact.trim() });
                logMov("Proveedor", `Se registró el proveedor ${d.name.trim()}`, id);
            }, "Proveedor registrado.");
        }
    });
}

export function editProvider(id) {
    const p = prv(id);
    if (!p) return;
    openForm({
        title: "Editar proveedor", values: { ...p }, fields: [
            { key: "name", label: "Nombre", required: true }, { key: "contact", label: "Contacto" }
        ], onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                Object.assign(p, { name: d.name.trim(), contact: d.contact.trim() });
                logMov("Proveedor", `Se actualizó el proveedor ${p.name}`, id);
            }, "Proveedor actualizado.");
        }
    });
}

export function deleteProvider(id) {
    const p = prv(id);
    if (!p) return;
    if (state.products.some(x => x.providerId === id)) return toast("No se puede eliminar: hay productos asociados.", "error");
    openConfirm("Eliminar proveedor", `¿Eliminar a "${p.name}"?`, () => transact(() => {
        state.providers = state.providers.filter(x => x.id !== id);
        logMov("Proveedor", `Se eliminó el proveedor ${p.name}`, id);
    }, "Proveedor eliminado."), "Eliminar");
}

/* ---------- Clientes ---------- */
export function newClient() {
    openForm({
        title: "Nuevo cliente", fields: [
            { key: "name", label: "Nombre del cliente", required: true },
            { key: "phone", label: "Teléfono" }
        ], onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                const id = "C" + (++state.counters.cli);
                state.clients.push({ id, name: d.name.trim(), phone: d.phone.trim() });
                logMov("Cliente", `Se registró el cliente ${d.name.trim()}`, id);
            }, "Cliente registrado.");
        }
    });
}

export function editClient(id) {
    const c = cli(id);
    if (!c) return;
    openForm({
        title: "Editar cliente", values: { ...c }, fields: [
            { key: "name", label: "Nombre del cliente", required: true }, { key: "phone", label: "Teléfono" }
        ], onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                Object.assign(c, { name: d.name.trim(), phone: d.phone.trim() });
                logMov("Cliente", `Se actualizó el cliente ${c.name}`, id);
            }, "Cliente actualizado.");
        }
    });
}

export function deleteClient(id) {
    const c = cli(id);
    if (!c) return;
    openConfirm("Eliminar cliente", `¿Eliminar a "${c.name}"? Las ventas y pedidos anteriores conservarán su nombre.`, () => transact(() => {
        state.clients = state.clients.filter(x => x.id !== id);
        logMov("Cliente", `Se eliminó el cliente ${c.name}`, id);
    }, "Cliente eliminado."), "Eliminar");
}

/* ---------- Ubicaciones ---------- */
function locationFields(id = null) {
    return [
        { key: "id", label: "Código", required: true, hint: "Ej. BN, SM. No se puede cambiar después.", full: true },
        { key: "name", label: "Nombre", required: true },
        { key: "type", label: "Tipo", type: "select", options: typeOptions() }
    ];
}

export function newLocation() {
    openForm({
        title: "Nueva ubicación", fields: locationFields(), submit: "Crear ubicación", onSubmit: d => {
            const id = d.id.trim().toUpperCase();
            if (!id || !d.name.trim()) return toast("Completa el código y el nombre.", "error");
            if (loc(id)) return toast("Ya existe una ubicación con ese código.", "error");
            transact(() => {
                state.locations.push({ id, name: d.name.trim(), type: d.type });
                state.stock[id] = {};
                state.products.forEach(p => { state.stock[id][p.sku] = 0; });
                logMov("Ubicación", `Se creó ${id} · ${d.name.trim()}`, id);
            }, "Ubicación creada.");
        }
    });
}

export function editLocation(id) {
    const l = loc(id);
    if (!l) return;
    const fields = locationFields(id).filter(f => f.key !== "id");
    openForm({
        title: "Editar ubicación", subtitle: id, fields, values: { ...l }, onSubmit: d => {
            if (!d.name.trim()) return toast("El nombre es obligatorio.", "error");
            transact(() => {
                Object.assign(l, { name: d.name.trim(), type: d.type });
                logMov("Ubicación", `Se actualizó ${id} · ${l.name}`, id);
            }, "Ubicación actualizada.");
        }
    });
}

export function deleteLocation(id) {
    const l = loc(id);
    if (!l) return;
    const unidades = Object.values(state.stock[id] || {}).reduce((a, b) => a + b, 0);
    if (unidades || state.edges.some(e => e.a === id || e.b === id) ||
        state.orders.some(o => o.destination === id || o.origin === id) || state.sales.some(v => v.locationId === id)) {
        return toast("No se puede eliminar: tiene stock, conexiones u operaciones asociadas.", "error");
    }
    openConfirm("Eliminar ubicación", `¿Eliminar "${l.name}" (${id})?`, () => transact(() => {
        state.locations = state.locations.filter(x => x.id !== id);
        delete state.stock[id];
        logMov("Ubicación", `Se eliminó ${id} · ${l.name}`, id);
    }, "Ubicación eliminada."), "Eliminar");
}

/* ---------- Inventario: entradas y salidas ---------- */
export function invMovement(kind) {
    const locationId = document.getElementById("inv-loc")?.value;
    const sku = document.getElementById("inv-prod")?.value;
    const q = number(document.getElementById("inv-qty")?.value);
    const note = document.getElementById("inv-note")?.value.trim() || "";
    if (!locationId || !sku || !validQty(q)) return toast("La cantidad debe ser un entero mayor que cero.", "error");
    if (kind === "out" && stockOf(locationId, sku) < q) return toast("No hay existencias suficientes en esa ubicación.", "error");
    transact(() => {
        state.stock[locationId][sku] = stockOf(locationId, sku) + (kind === "in" ? q : -q);
        const tipo = kind === "in" ? "Entrada" : "Salida";
        logMov(tipo, `${tipo} de ${q} × ${prod(sku)?.name || sku} en ${locName(locationId)}${note ? ` · ${note}` : ""}`, sku);
    }, kind === "in" ? "Entrada registrada." : "Salida registrada.");
}

export function newTransfer() {
    const from = document.getElementById("tr-from")?.value;
    const to = document.getElementById("tr-to")?.value;
    const sku = document.getElementById("tr-prod")?.value;
    const q = number(document.getElementById("tr-qty")?.value);
    if (!from || !to || !sku || !validQty(q)) return toast("Completa los datos con una cantidad válida.", "error");
    if (from === to) return toast("Origen y destino deben ser distintos.", "error");
    if (stockOf(from, sku) < q) return toast("Existencias insuficientes en el origen.", "error");
    const route = dijkstra(from, to);
    if (!route) return toast("No existe ruta entre esas ubicaciones.", "error");
    transact(() => {
        state.stock[from][sku] -= q;
        state.stock[to][sku] = stockOf(to, sku) + q;
        logMov("Transferencia", `${q} × ${prod(sku)?.name || sku}: ${routeText(route.path)} (${route.km} km)`, sku);
    }, `Transferencia realizada (${route.km} km).`);
}

export { locOptions, productOptions };
