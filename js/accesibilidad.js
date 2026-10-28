// Accesibilidad común a todas las páginas:
// - une cada etiqueta (<label>) con su campo, también en las pantallas que se arman después (lectores de pantalla)
// - enlace "Saltar al contenido" para quien navega con el teclado
// - contorno visible del foco al navegar con el teclado
(function () {
  const CSS = `:focus-visible{outline:3px solid #1d6fe0!important;outline-offset:2px!important;border-radius:4px}
.saltar-contenido{position:fixed;left:12px;top:-60px;z-index:99999;background:#0f2740;color:#fff;padding:10px 16px;border-radius:10px;font:700 15px system-ui,sans-serif;text-decoration:none;transition:top .15s}
.saltar-contenido:focus{top:12px}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}`;
  let n = 0;
  const CONTROL = 'input:not([type=hidden]),select,textarea';
  // <div class="campo"><label>Email</label><input></div> → <label for="…"> + id en el campo
  const unirEtiquetas = raiz => raiz.querySelectorAll('label:not([for])').forEach(l => {
    if (l.querySelector(CONTROL)) return;                       // la etiqueta ya envuelve al campo
    let c = l.nextElementSibling;
    if (c && !c.matches(CONTROL)) c = c.querySelector(CONTROL);  // p. ej. <div class="pass"><input>…
    if (!c || c.closest('label')) return;
    if (!c.id) c.id = 'campo-' + (++n);
    l.htmlFor = c.id;
  });
  // Campos sin etiqueta: usan el placeholder o el título como nombre accesible
  const nombrarCampos = raiz => raiz.querySelectorAll(CONTROL).forEach(c => {
    if (c.labels && c.labels.length || c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')) return;
    const t = c.getAttribute('placeholder') || c.getAttribute('title') || (c.tagName === 'SELECT' && c.options[0] && c.options[0].text);
    if (t) c.setAttribute('aria-label', t);
  });
  // Botones que solo tienen un ícono: usan su título como nombre
  const nombrarBotones = raiz => raiz.querySelectorAll('button[title]:not([aria-label]),a[title]:not([aria-label])').forEach(b => {
    if (!b.textContent.trim() || /^[\W\d_]{1,3}$/u.test(b.textContent.trim())) b.setAttribute('aria-label', b.title);
  });
  const revisar = raiz => { unirEtiquetas(raiz); nombrarCampos(raiz); nombrarBotones(raiz); };

  const saltar = () => {
    const destino = document.querySelector('main,#main,#cont,#app,#contenido,.contenido');
    if (!destino || document.querySelector('.saltar-contenido')) return;
    if (!destino.id) destino.id = 'contenido-principal';
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    const a = document.createElement('a'); a.className = 'saltar-contenido'; a.href = '#' + destino.id; a.textContent = 'Saltar al contenido';
    a.onclick = e => { e.preventDefault(); destino.focus(); destino.scrollIntoView(); };
    document.body.prepend(a);
  };

  const iniciar = () => {
    const s = document.createElement('style'); s.id = 'a11y-css'; s.textContent = CSS; document.head.append(s);
    revisar(document); saltar();
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; revisar(document); }); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
