import { seedIfNeeded, getAllTerms, toggleFavorite } from "./db.js";
import { buildSearchIndex, filterTerms, getSuggestions } from "./search.js";
import * as ui from "./ui.js";
import * as editor from "./terms-editor.js";

const state = { terms: [], index: [], query: "", category: "all", favoritesOnly: false, view: "grid", suggestions: [], activeSuggestion: -1 };
let debounce;

async function refresh(message) { state.terms = await getAllTerms(); state.index = buildSearchIndex(state.terms); render(); if (message) ui.announce(message); }
function counts() { const result = { all: state.terms.length }; state.terms.forEach((t) => result[t.category] = (result[t.category] || 0) + 1); return result; }
function filtered() { return filterTerms(state.index, state); }
function render() { const terms = filtered(); ui.renderCategories(ui.CATEGORIES, counts(), state.category, chooseCategory); ui.renderResults(terms, state, { open: openTerm, favorite: favorite }); ui.updateStatus(state.terms, state.category); document.querySelector("#search-clear").hidden = !state.query; document.querySelector("#favorites-toggle-btn").setAttribute("aria-pressed", String(state.favoritesOnly)); }
function chooseCategory(category) { state.category = category; render(); closeDrawer(); }
function openTerm(term) { ui.closeSuggestions(); state.activeSuggestion = -1; ui.showDetail(term, state.terms, { open: openTerm, favorite, edit: editor.openEdit, remove: editor.askToDelete, image: editor.openImagePicker, resetImage: editor.resetImage }); }
async function favorite(term, keepOpen) { await toggleFavorite(term.id); await refresh(term.favorite ? "Removed from favorites." : "Added to favorites."); if (keepOpen) openTerm(state.terms.find((item) => item.id === term.id)); }
function updateSuggestions() { state.suggestions = getSuggestions(state.index, state.query); state.activeSuggestion = -1; ui.renderSuggestions(state.suggestions, state.query, state.activeSuggestion, selectSuggestion); }
function selectSuggestion(term) { document.querySelector("#search-input").value = term.term; state.query = term.term; ui.closeSuggestions(); render(); openTerm(term); }
function closeDrawer() { document.querySelector("#category-rail").classList.remove("is-open"); document.querySelector("#rail-scrim").hidden = true; document.querySelector("#drawer-toggle").setAttribute("aria-expanded", "false"); }

function bind() {
  const search = document.querySelector("#search-input");
  search.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(() => { state.query = search.value; render(); updateSuggestions(); }, 150); });
  search.addEventListener("keydown", (event) => { if (event.key === "ArrowDown" && state.suggestions.length) { event.preventDefault(); state.activeSuggestion = (state.activeSuggestion + 1) % state.suggestions.length; ui.renderSuggestions(state.suggestions, state.query, state.activeSuggestion, selectSuggestion); search.setAttribute("aria-activedescendant", `suggestion-${state.activeSuggestion}`); } else if (event.key === "ArrowUp" && state.suggestions.length) { event.preventDefault(); state.activeSuggestion = (state.activeSuggestion - 1 + state.suggestions.length) % state.suggestions.length; ui.renderSuggestions(state.suggestions, state.query, state.activeSuggestion, selectSuggestion); } else if (event.key === "Enter" && state.activeSuggestion >= 0) { event.preventDefault(); selectSuggestion(state.suggestions[state.activeSuggestion]); } else if (event.key === "Escape") { ui.closeSuggestions(); } });
  document.querySelector("#search-clear").onclick = () => { search.value = ""; state.query = ""; render(); ui.closeSuggestions(); search.focus(); };
  document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") { event.preventDefault(); search.focus(); } if (event.key === "Escape") { ui.closeSuggestions(); closeDrawer(); document.querySelectorAll("dialog[open]").forEach((d) => d.close()); } });
  document.querySelector("#clear-filters-btn").onclick = () => { state.query = ""; state.category = "all"; state.favoritesOnly = false; search.value = ""; render(); };
  document.querySelector("#add-term-btn").onclick = editor.openAdd;
  document.querySelector("#favorites-toggle-btn").onclick = () => { state.favoritesOnly = !state.favoritesOnly; render(); };
  [["#view-grid-btn", "grid"], ["#view-az-btn", "az"]].forEach(([selector, view]) => document.querySelector(selector).onclick = () => { state.view = view; document.querySelector("#view-grid-btn").setAttribute("aria-pressed", String(view === "grid")); document.querySelector("#view-az-btn").setAttribute("aria-pressed", String(view === "az")); render(); });
  document.querySelector("#theme-toggle-btn").onclick = () => { const light = document.documentElement.dataset.theme !== "light"; document.documentElement.dataset.theme = light ? "light" : "dark"; document.querySelector("#theme-toggle-btn").setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme"); };
  document.querySelector("#backup-btn").onclick = () => editor.openBackup(state.terms.filter((t) => t.source === "custom").length);
  document.querySelector("#drawer-toggle").onclick = () => { const rail = document.querySelector("#category-rail"), open = !rail.classList.contains("is-open"); rail.classList.toggle("is-open", open); document.querySelector("#rail-scrim").hidden = !open; document.querySelector("#drawer-toggle").setAttribute("aria-expanded", String(open)); };
  document.querySelector("#rail-scrim").onclick = closeDrawer;
  window.addEventListener("online", ui.updateConnection); window.addEventListener("offline", ui.updateConnection);
}

async function start() { ui.hydrateStaticIcons(); bind(); editor.setupEditor(refresh); ui.updateConnection(); try { await seedIfNeeded(); await refresh(); } catch (error) { ui.announce("Could not load the dictionary. Visit once online to cache its data."); console.error(error); } }
start();
