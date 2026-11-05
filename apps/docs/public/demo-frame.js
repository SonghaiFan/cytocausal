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
