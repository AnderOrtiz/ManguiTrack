/* =========================================================
   ManguiTrack · punto de entrada y eventos globales
   ========================================================= */
import { hooks, ui, undo } from "./state.js";
import { toast, closeModal, handleModalSubmit, initTheme } from "./ui.js";
import { render } from "./views.js";
import {
    newProduct, editProduct, deleteProduct,
    newCategory, editCategory, deleteCategory,
    newProvider, editProvider, deleteProvider,
    newClient, editClient, deleteClient,
    newLocation, editLocation, deleteLocation,
    invMovement, newTransfer
} from "./actions-catalog.js";
import {
    cartAdd, cartRemove, cartQtyChange, newSale, saleDetail,
    newOrder, orderDetail, dispatchOrder, deliverOrder, cancelOrder,
    calculateRoute, newEdge, editEdge, deleteEdge,
    exportCSV, exportJSON, importClick, importFile, resetDemo, setThemeAction
} from "./actions-op.js";

hooks.render = render;
hooks.toast = toast;

const simple = {
    "undo": undo,
    "modal-close": closeModal,
    "new-product": newProduct,
    "new-category": () => newCategory(),
    "new-provider": newProvider,
    "new-client": newClient,
    "new-location": newLocation,
    "new-transfer": newTransfer,
    "inv-in": () => invMovement("in"),
    "inv-out": () => invMovement("out"),
    "cart-add": cartAdd,
    "new-sale": newSale,
    "new-order": newOrder,
    "calculate-route": calculateRoute,
    "new-edge": newEdge,
    "export-csv": exportCSV,
    "export-json": exportJSON,
    "import-click": importClick,
    "reset-demo": resetDemo
};

const byId = {
    "edit-product": editProduct, "delete-product": deleteProduct,
    "edit-category": editCategory, "delete-category": deleteCategory,
    "add-subcategory": newCategory,
    "edit-provider": editProvider, "delete-provider": deleteProvider,
    "edit-client": editClient, "delete-client": deleteClient,
    "edit-location": editLocation, "delete-location": deleteLocation,
    "cart-remove": cartRemove,
    "sale-detail": saleDetail,
    "order-detail": orderDetail, "order-dispatch": dispatchOrder,
    "order-deliver": deliverOrder, "order-cancel": cancelOrder,
    "edit-edge": editEdge, "delete-edge": deleteEdge
};

document.addEventListener("click", event => {
    const target = event.target.closest("[data-act]");
    if (!target) return;
    const action = target.dataset.act;
    if (action === "nav") {
        ui.section = target.dataset.section;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }
    if (action === "theme") {
        const order = ["auto", "light", "dark"];
        setThemeAction(order[(order.indexOf(ui.theme) + 1) % order.length]);
        return;
    }
    if (action === "set-theme") { setThemeAction(target.dataset.theme); return; }
    if (simple[action]) { simple[action](); return; }
    if (byId[action]) { byId[action](target.dataset.id); return; }
});

document.addEventListener("input", event => {
    const key = event.target.dataset.filter;
    if (!key) return;
    ui.filters[key] = event.target.value;
    const caret = event.target.selectionStart;
    render();
    const again = document.querySelector(`[data-filter="${key}"]`);
    if (again) { again.focus(); if (caret !== null) again.setSelectionRange(caret, caret); }
});

document.addEventListener("change", event => {
    const target = event.target;
    if (target.dataset.filter) {
        ui.filters[target.dataset.filter] = target.value;
        render();
        return;
    }
    if (target.dataset.cartQty) return cartQtyChange(target.dataset.cartQty, target.value);
    if (target.id === "import-file") return importFile(target.files?.[0]);
});

document.addEventListener("submit", handleModalSubmit);

const modal = document.getElementById("modal");
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });

initTheme();
render();
