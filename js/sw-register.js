// Service workers require HTTPS or localhost; failure on file:// is expected.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch((error) => console.error("Service worker registration failed", error)));
}
