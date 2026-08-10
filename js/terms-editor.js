// terms-editor.js — custom-term form, delete confirmation, and optional backup.
import { addCustomTerm, updateCustomTerm, deleteCustomTerm, exportCustomTerms, importCustomTerms } from "./db.js";
import { CATEGORIES } from "./ui.js";

let afterChange = () => {};
let editingId = null;

function dialog(id) { return document.querySelector(id); }
function closeOpenDialogs() { document.querySelectorAll("dialog[open]").forEach((item) => item.close()); }

export function setupEditor(onChange) {
  afterChange = onChange;
  const select = dialog("#field-category");
  CATEGORIES.forEach((category) => { const option = document.createElement("option"); option.value = category; option.textContent = category; select.append(option); });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.onclick = () => button.closest("dialog").close());
  dialog("#term-form").addEventListener("submit", save);
  dialog("#confirm-dialog-confirm").onclick = confirmDelete;
  dialog("#backup-export-btn").onclick = downloadBackup;
  dialog("#backup-import-input").addEventListener("change", importBackup);
}

export function openAdd() { editingId = null; const form = dialog("#term-form"); form.reset(); dialog("#term-form-heading").textContent = "Add a Term"; dialog("#term-form-submit").textContent = "Save Term"; dialog("#term-form-error").hidden = true; dialog("#term-form-dialog").showModal(); dialog("#field-term").focus(); }
export function openEdit(term) { editingId = term.id; const form = dialog("#term-form"); Object.entries({ term: term.term, category: term.category, pronunciation: term.pronunciation || "", shortDefinition: term.shortDefinition || "", extendedDefinition: term.extendedDefinition || "", relatedTerms: (term.relatedTerms || []).join(", "), example: term.example || "" }).forEach(([name, value]) => { form.elements[name].value = value; }); dialog("#term-form-heading").textContent = "Edit Your Term"; dialog("#term-form-submit").textContent = "Save Changes"; dialog("#term-form-error").hidden = true; dialog("#term-form-dialog").showModal(); dialog("#field-term").focus(); }

async function save(event) { event.preventDefault(); const form = event.currentTarget; const input = Object.fromEntries(new FormData(form)); const error = dialog("#term-form-error"); if (!input.term.trim() || !input.category) { error.textContent = "Term name and category are required."; error.hidden = false; return; } try { editingId ? await updateCustomTerm(editingId, input) : await addCustomTerm(input); dialog("#term-form-dialog").close(); await afterChange(editingId ? "Term updated." : "Term added."); } catch (err) { error.textContent = err.message || "Could not save this term."; error.hidden = false; } }

export function askToDelete(term) { dialog("#confirm-dialog").dataset.termId = term.id; dialog("#confirm-dialog-message").textContent = `Delete “${term.term}”? This can't be undone.`; dialog("#confirm-dialog").showModal(); }
async function confirmDelete() { const id = dialog("#confirm-dialog").dataset.termId; try { await deleteCustomTerm(id); closeOpenDialogs(); await afterChange("Term deleted."); } catch (err) { dialog("#confirm-dialog").close(); } }

export async function openBackup(customCount) { dialog("#backup-export-count").textContent = `You have ${customCount} custom term${customCount === 1 ? "" : "s"}.`; dialog("#backup-import-error").hidden = true; dialog("#backup-import-success").hidden = true; dialog("#backup-dialog").showModal(); }
async function downloadBackup() { const data = await exportCustomTerms(); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "ws-terms-custom-backup.json"; a.click(); URL.revokeObjectURL(url); }
async function importBackup(event) { const error = dialog("#backup-import-error"), success = dialog("#backup-import-success"); error.hidden = true; success.hidden = true; try { const text = await event.target.files[0].text(); const result = await importCustomTerms(JSON.parse(text)); success.textContent = `Imported ${result.imported} term${result.imported === 1 ? "" : "s"}${result.skipped ? `; skipped ${result.skipped} invalid record(s).` : "."}`; success.hidden = false; await afterChange("Backup restored."); } catch (err) { error.textContent = "That file could not be imported. Choose a valid backup JSON file."; error.hidden = false; } finally { event.target.value = ""; } }
