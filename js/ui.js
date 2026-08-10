// ui.js — DOM rendering only. Keeping rendering separate makes the app state
// and IndexedDB layer easy to inspect and test.
import { CATEGORY_ICONS, icon } from "./icons.js";
import { highlightSegments } from "./search.js";
import { imageForTerm } from "./term-images.js";

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

function el(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function fillIcon(node, name, size = 20) {
  node.innerHTML = icon(name, { size });
}

export function hydrateStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    fillIcon(node, node.dataset.icon);
  });
}

export function renderCategories(categories, counts, activeCategory, onChoose) {
  const list = document.querySelector("#category-list");
  list.querySelectorAll("li:not(:first-child)").forEach((item) => item.remove());
  document.querySelector("#count-all").textContent = counts.all || 0;
  const allButton = list.querySelector('[data-category="all"]');
  allButton.classList.toggle("is-active", activeCategory === "all");
  allButton.setAttribute("aria-pressed", String(activeCategory === "all"));
  allButton.onclick = () => onChoose("all");
  categories.forEach((category) => {
    const li = el("li");
    const button = el("button", "rail-chip");
    button.type = "button";
    button.dataset.category = category;
    const active = category === activeCategory;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    const glyph = el("span", "rail-chip-icon");
    fillIcon(glyph, CATEGORY_ICONS[category], 18);
    button.append(glyph, el("span", "rail-chip-label", category), el("span", "rail-chip-count", counts[category] || 0));
    button.onclick = () => onChoose(category);
    li.append(button);
    list.append(li);
  });
}

function card(term, query, onOpen, onFavorite) {
  const node = el("article", "term-card");
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  node.setAttribute("aria-label", `Open ${term.term}`);
  node.addEventListener("click", () => onOpen(term));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(term); }
  });
  const image = el("img", "term-card-image");
  image.src = imageForTerm(term); image.alt = term.image ? `${term.term} image` : `${term.category} sample illustration`;
  node.append(image);
  const top = el("div", "term-card-top");
  const glyph = el("span", "term-card-icon");
  fillIcon(glyph, CATEGORY_ICONS[term.category] || "info", 20);
  const favorite = el("button", "icon-btn term-card-favorite");
  favorite.type = "button";
  favorite.setAttribute("aria-label", term.favorite ? `Remove ${term.term} from favorites` : `Add ${term.term} to favorites`);
  favorite.setAttribute("aria-pressed", String(Boolean(term.favorite)));
  favorite.innerHTML = icon(term.favorite ? "bookmark-check" : "bookmark", { size: 16 });
  favorite.addEventListener("click", (event) => { event.stopPropagation(); onFavorite(term); });
  top.append(glyph, favorite);
  node.append(top, el("div", "term-card-category", term.category));
  const name = el("h3", "term-card-name");
  appendHighlighted(name, term.term, query);
  node.append(name);
  if (term.source === "custom") node.append(el("span", "badge badge-custom", "Added by you"));
  node.append(el("p", "term-card-def", term.shortDefinition || term.extendedDefinition || "No definition added yet."));
  return node;
}

function appendHighlighted(node, text, query) {
  highlightSegments(text, query).forEach((segment) => {
    node.append(segment.matched ? el("mark", "", segment.value) : document.createTextNode(segment.value));
  });
}

export function renderResults(terms, state, actions) {
  const grid = document.querySelector("#grid-view");
  const az = document.querySelector("#az-view");
  const empty = document.querySelector("#empty-state");
  grid.replaceChildren(); az.replaceChildren();
  empty.hidden = terms.length !== 0;
  grid.hidden = state.view === "az" || terms.length === 0;
  az.hidden = state.view !== "az" || terms.length === 0;
  if (state.view === "grid") terms.forEach((term) => grid.append(card(term, state.query, actions.open, actions.favorite)));
  else renderAz(az, terms, actions.open);
  const label = state.favoritesOnly ? " favorites" : " terms";
  document.querySelector("#results-count").textContent = `${terms.length}${label}`;
  document.querySelector("#results-heading").textContent = state.category === "all" ? (state.favoritesOnly ? "Favorites" : "All Terms") : state.category;
  document.querySelector("#clear-filters-btn").hidden = !(state.query || state.category !== "all" || state.favoritesOnly);
}

function renderAz(container, terms, onOpen) {
  const groups = new Map();
  terms.forEach((term) => {
    const letter = (term.term[0] || "#").toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(term);
  });
  [...groups.keys()].sort().forEach((letter) => {
    const section = el("section"); section.append(el("h3", "az-group-heading", letter));
    const list = el("ul", "az-list");
    groups.get(letter).forEach((term) => {
      const li = el("li"); const button = el("button", "az-item-btn", term.term); button.type = "button";
      const glyph = el("span"); fillIcon(glyph, CATEGORY_ICONS[term.category] || "info", 15);
      button.prepend(glyph); button.onclick = () => onOpen(term); li.append(button); list.append(li);
    });
    section.append(list); container.append(section);
  });
}

export function renderSuggestions(terms, query, active, onChoose) {
  const list = document.querySelector("#autocomplete-list");
  list.replaceChildren(); list.hidden = terms.length === 0;
  document.querySelector("#search-input").setAttribute("aria-expanded", String(terms.length > 0));
  terms.forEach((term, i) => {
    const item = el("li", "autocomplete-item"); item.id = `suggestion-${i}`; item.role = "option";
    item.setAttribute("aria-selected", String(i === active));
    const glyph = el("span"); fillIcon(glyph, CATEGORY_ICONS[term.category] || "info", 17);
    const text = el("span", "autocomplete-item-text"); const name = el("span", "autocomplete-item-name");
    appendHighlighted(name, term.term, query); text.append(name, el("span", "autocomplete-item-category", term.category)); item.append(glyph, text);
    item.onmousedown = (event) => { event.preventDefault(); onChoose(term); }; list.append(item);
  });
}

export function closeSuggestions() { document.querySelector("#autocomplete-list").hidden = true; document.querySelector("#search-input").setAttribute("aria-expanded", "false"); }

export function showDetail(term, allTerms, actions) {
  const dialog = document.querySelector("#detail-dialog");
  dialog.dataset.termId = term.id;
  document.querySelector("#detail-category-label").textContent = term.category;
  document.querySelector("#detail-term-name").textContent = term.term;
  const detailImage = document.querySelector("#detail-image"); detailImage.src = imageForTerm(term); detailImage.alt = term.image ? `${term.term} image` : `${term.category} sample illustration`;
  const glyph = document.querySelector("#detail-category-icon"); fillIcon(glyph, CATEGORY_ICONS[term.category] || "info", 26);
  const pronunciation = document.querySelector("#detail-pronunciation"); pronunciation.hidden = !term.pronunciation; pronunciation.textContent = term.pronunciation ? `Pronounced: ${term.pronunciation}` : "";
  document.querySelector("#detail-short-def").textContent = term.shortDefinition || "No short definition added.";
  document.querySelector("#detail-extended-def").textContent = term.extendedDefinition || "";
  const exampleWrap = document.querySelector("#detail-example-wrap"); exampleWrap.hidden = !term.example; document.querySelector("#detail-example").textContent = term.example || "";
  const badge = document.querySelector("#detail-custom-badge"); badge.hidden = term.source !== "custom";
  const fav = document.querySelector("#detail-favorite-btn"); fav.setAttribute("aria-pressed", String(Boolean(term.favorite))); fav.setAttribute("aria-label", term.favorite ? "Remove from favorites" : "Add to favorites"); fav.innerHTML = icon(term.favorite ? "bookmark-check" : "bookmark", { size: 18 }); fav.onclick = () => actions.favorite(term, true);
  const relatedWrap = document.querySelector("#detail-related-wrap"); const related = document.querySelector("#detail-related-list"); related.replaceChildren();
  (term.relatedTerms || []).forEach((name) => { const found = allTerms.find((item) => item.term === name); const button = el("button", "chip", name); button.type = "button"; if (found) button.onclick = () => actions.open(found); else button.classList.add("is-static"); related.append(button); });
  relatedWrap.hidden = !related.children.length;
  const antonymWrap = document.querySelector("#detail-antonym-wrap"); antonymWrap.hidden = !term.antonym; document.querySelector("#detail-antonym").textContent = term.antonym || "";
  const custom = document.querySelector("#detail-custom-actions"); custom.hidden = term.source !== "custom";
  document.querySelector("#detail-edit-btn").onclick = () => actions.edit(term);
  document.querySelector("#detail-delete-btn").onclick = () => actions.remove(term);
  document.querySelector("#detail-change-image-btn").onclick = () => actions.image(term);
  document.querySelector("#detail-reset-image-btn").hidden = !term.image;
  document.querySelector("#detail-reset-image-btn").onclick = () => actions.resetImage(term);
  if (!dialog.open) dialog.showModal();
}

export function updateStatus(terms, category) {
  const official = terms.filter((t) => t.source === "official").length;
  const custom = terms.filter((t) => t.source === "custom").length;
  document.querySelector("#status-cached").textContent = `${official}/100 official terms cached`;
  const customStatus = document.querySelector("#status-custom"); customStatus.hidden = custom === 0; customStatus.textContent = `+${custom} custom`;
  document.querySelector("#status-category").textContent = `Category: ${category === "all" ? "All" : category}`;
}

export function updateConnection() {
  const online = navigator.onLine; document.querySelector("#status-dot").classList.toggle("is-offline", !online);
  document.querySelector("#status-connection-text").textContent = online ? "Online" : "Offline";
}

export function announce(message) { document.querySelector("#live-region").textContent = message; }
