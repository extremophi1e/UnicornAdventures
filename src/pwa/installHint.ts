export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Shows a one-time iOS "Add to Home Screen" hint banner (no framework needed). */
export function maybeShowIosInstallHint(): void {
  if (!isIos() || isStandalone()) return;
  const b = document.createElement("div");
  b.textContent = "Tap ⬆️ then 'Add to Home Screen' to play full screen ✨";
  Object.assign(b.style, {
    position: "fixed",
    left: "0",
    right: "0",
    top: "0",
    padding: "10px",
    background: "#ff8fcf",
    color: "#fff",
    font: "16px sans-serif",
    textAlign: "center",
    zIndex: "9999",
  } satisfies Partial<CSSStyleDeclaration>);
  b.addEventListener("click", () => b.remove());
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 8000);
}

/** PC/Android only: request true fullscreen on a user gesture. */
export function requestFullscreenOnce(): void {
  const onFirst = () => {
    if (!isIos() && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    window.removeEventListener("pointerdown", onFirst);
  };
  window.addEventListener("pointerdown", onFirst);
}
