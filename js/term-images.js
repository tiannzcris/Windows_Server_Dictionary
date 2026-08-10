// Offline sample imagery for the official dataset. Each category gets a
// compact blueprint illustration, so all 100 official terms have a visual
// without relying on a network image host.
import { CATEGORY_ICONS } from "./icons.js";

const SUBJECTS = {
  "Active Directory & Identity": "Identity map",
  "Networking Services": "Network links",
  "Storage & File Systems": "Storage array",
  "Virtualization & Containers": "Virtual stack",
  "Security & Compliance": "Security shield",
  "PowerShell & Management": "Admin console",
  "File & Print Services": "File services",
  "Web & Application Services": "Web endpoint",
  "Remote Access & Desktop Services": "Remote desktop",
  "High Availability, Clustering & Backup": "Cluster quorum",
};

function sampleSvg(category) {
  const label = SUBJECTS[category] || "Windows Server";
  const iconName = CATEGORY_ICONS[category] || "info";
  // The central rack/connection drawing is deliberately generic: it acts as
  // a sample visual while the supplied label describes the category clearly.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" role="img" aria-label="${label}">
    <rect width="800" height="420" fill="#10192a"/>
    <g stroke="#26314A" stroke-width="1"><path d="M0 70H800M0 140H800M0 210H800M0 280H800M0 350H800"/><path d="M80 0V420M160 0V420M240 0V420M320 0V420M400 0V420M480 0V420M560 0V420M640 0V420M720 0V420"/></g>
    <g fill="#141B2D" stroke="#4C8DFF" stroke-width="3"><rect x="255" y="65" width="290" height="290" rx="12"/><rect x="285" y="105" width="230" height="48" rx="5"/><rect x="285" y="185" width="230" height="48" rx="5"/><rect x="285" y="265" width="230" height="48" rx="5"/></g>
    <g fill="#34D399"><circle cx="310" cy="129" r="7"/><circle cx="310" cy="209" r="7"/><circle cx="310" cy="289" r="7"/></g>
    <g fill="none" stroke="#4C8DFF" stroke-width="4"><path d="M255 130H150V85H90M545 290H650V335H710"/><circle cx="90" cy="85" r="16"/><circle cx="710" cy="335" r="16"/></g>
    <text x="400" y="395" fill="#E7ECF5" text-anchor="middle" font-family="monospace" font-size="20" letter-spacing="2">${label.toUpperCase()} · ${iconName.toUpperCase()}</text>
  </svg>`;
}

export function imageForTerm(term) {
  if (term.image) return term.image;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg(term.category))}`;
}
