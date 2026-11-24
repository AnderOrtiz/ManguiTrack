/* =========================================================
   ManguiTrack · componentes de interfaz reutilizables
   ========================================================= */
import { esc, THEME_KEY, ui } from "./state.js";

let pendingSubmit = null;

export const $ = selector => document.querySelector(selector);

export function toast(message, kind = "ok") {
    const box = $("#toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    el.textContent = message;
    box.append(el);
    setTimeout(() => {
        el.classList.add("out");
        setTimeout(() => el.remove(), 250);
    }, 3200);
}

export function closeModal() {
    const modal = $("#modal");
    if (modal?.open) modal.close();
    if (modal) modal.innerHTML = "";
    pendingSubmit = null;
}

export function fieldHTML(field, values = {}) {
    const value = values[field.key] ?? field.value ?? "";
    const attrs = `name="${esc(field.key)}" id="f-${esc(field.key)}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.step ? `step="${field.step}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""}`;
    let control;
    if (field.type === "select") {
        const options = (field.options || []).map(o =>
            `<option value="${esc(o.value)}" ${String(value) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`
        ).join("");
        control = `<select ${attrs}>${options}</select>`;
    } else if (field.type === "textarea") {
        control = `<textarea ${attrs} rows="3" placeholder="${esc(field.placeholder || "")}">${esc(value)}</textarea>`;
    } else {
        control = `<input ${attrs} type="${field.type || "text"}" value="${esc(value)}" placeholder="${esc(field.placeholder || "")}">`;
    }
    return `<div class="field ${field.full ? "full" : ""}"><label for="f-${esc(field.key)}">${esc(field.label)}</label>${control}${field.hint ? `<small>${esc(field.hint)}</small>` : ""}</div>`;
}

export function openForm({ title, subtitle, fields, values = {}, submit = "Guardar", onSubmit, wide = false }) {
    const modal = $("#modal");
    modal.className = wide ? "wide" : "";
    modal.innerHTML = `
        <div class="modal-head">
            <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
            <button type="button" class="icon-btn" data-act="modal-close" aria-label="Cerrar">×</button>
        </div>
        <form id="modal-form">
            <div class="modal-body form-grid">${fields.map(f => fieldHTML(f, values)).join("")}</div>
            <div class="modal-foot">
                <button type="button" class="btn ghost" data-act="modal-close">Cancelar</button>
                <button type="submit" class="btn primary">${esc(submit)}</button>
            </div>
        </form>`;
    pendingSubmit = onSubmit;
    modal.showModal();
    modal.querySelector("input, select, textarea")?.focus();
}

export function openConfirm(title, message, onConfirm, label = "Confirmar") {
    openForm({
        title,
        fields: [],
        submit: label,
        onSubmit: () => { onConfirm(); },
        values: {}
    });
    const body = $("#modal .modal-body");
    body.innerHTML = `<p class="confirm-text">${esc(message)}</p>`;
    $("#modal-form .btn.primary").classList.add("danger");
}

export function handleModalSubmit(event) {
    if (event.target.id !== "modal-form") return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const result = pendingSubmit?.(data);
    if (result === false) return;
    closeModal();
}

export function badge(text, tone = "") {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
}

export function empty(icon, title, text, action = "") {
    return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

export function table(heads, rows) {
    if (!rows.length) return "";
    return `<div class="table-wrap"><table>
        <thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.join("")}</tbody>
    </table></div>`;
}

export function sectionHead(title, subtitle, actions = "") {
    return `<div class="section-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="head-actions">${actions}</div></div>`;
}

export function panel(title, body, actions = "") {
    return `<section class="card"><div class="card-head"><h2>${esc(title)}</h2>${actions}</div>${body}</section>`;
}

export function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function setTheme(theme) {
    ui.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme === "auto" ? "" : theme;
    if (theme === "auto") delete document.documentElement.dataset.theme;
}

export function initTheme() {
    setTheme(ui.theme || "auto");
}
