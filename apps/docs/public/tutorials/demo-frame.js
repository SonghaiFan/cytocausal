(() => {
  const report = () => parent.postMessage({ type: 'demo:resize', height: document.body.scrollHeight }, location.origin);
  new ResizeObserver(report).observe(document.body);
  addEventListener('load', report);
  report();
})();
// Resize the renderer when the shared layout or viewport changes width.
(() => {
  const container = document.getElementById('cy');
  if (!container) return;
  new ResizeObserver(() => {
    if (typeof cy !== 'undefined') { cy.resize(); cy.fit(undefined, 30); }
  }).observe(container);
})();

// Download helper used by the standalone import/export chapter.
function saveAs(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
