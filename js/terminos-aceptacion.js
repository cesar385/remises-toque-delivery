// Aceptación de Términos y condiciones (pasajeros y conductores). Bloquea la app hasta aceptar o salir.
// o: { para: 'pasajeros'|'conductores', primera, version, aceptar: async () => {}, salir: () => {} }
function pedirTyc(o) {
  cpEstilos();
  if (!document.getElementById('tyc-css')) { const st = document.createElement('style'); st.id = 'tyc-css'; st.textContent = `
    .tyc-ov{position:fixed;inset:0;z-index:7000;background:rgba(10,25,45,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)}
    .tyc-c{background:#fff;width:100%;max-width:440px;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:cpIn .2s ease-out;color:#0f2740}
    .tyc-h{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:22px 18px 18px}.tyc-h .e{font-size:40px}.tyc-h h3{margin:6px 0 2px;font-size:20px}.tyc-h small{opacity:.8}
    .tyc-b{padding:18px 18px 6px;font-size:15px;line-height:1.5;color:#33475b}.tyc-b ul{margin:10px 0;padding-left:20px}.tyc-b li{margin:4px 0}
    .tyc-b a.ver{display:flex;align-items:center;justify-content:center;gap:8px;border:2px solid #215181;color:#215181;border-radius:12px;padding:11px;font-weight:800;text-decoration:none;margin:12px 0}
    .tyc-chk{display:flex;gap:10px;align-items:flex-start;background:#f1f5f9;border-radius:12px;padding:12px;cursor:pointer;font-size:14.5px}.tyc-chk input{width:20px;height:20px;min-height:0;margin:1px 0 0;flex:none;accent-color:#215181}
    .tyc-f{display:flex;flex-direction:column;gap:8px;padding:14px 18px 18px}
    .tyc-f button{border:0;border-radius:14px;padding:14px;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
    .tyc-f .si{background:#4a8125;color:#fff}.tyc-f .si:disabled{opacity:.45;cursor:not-allowed}.tyc-f .no{background:none;color:#627280;font-weight:600;font-size:14px;padding:8px}`; document.head.append(st); }
  return new Promise(res => {
    const cond = o.para === 'conductores', url = 'terminos.html?para=' + (cond ? 'conductores' : 'pasajeros') + '&de=' + (cond ? 'conductor.html' : 'pasajero.html');
    const ov = document.createElement('div'); ov.className = 'tyc-ov';
    ov.innerHTML = `<div class="tyc-c" role="dialog" aria-modal="true"><div class="tyc-h"><div class="e">📜</div><h3>${o.primera ? 'Términos y condiciones' : 'Actualizamos los términos'}</h3><small>${cond ? 'App de conductores' : 'App de pasajeros'}</small></div>
      <div class="tyc-b"><p style="margin:0">${o.primera ? 'Para usar la app tenés que leer y aceptar los Términos y condiciones de Remises TOQUE!' : 'Cambiaron los Términos y condiciones. Para seguir usando la app, leelos y aceptalos.'}</p>
        <ul>${cond ? '<li>Requisitos, documentación y conducta.</li><li>Ubicación del móvil mientras estás en servicio.</li><li>Cobros, plan y base de la cuenta.</li>' : '<li>Cómo funcionan los pedidos y las tarifas.</li><li>Pagos, cancelaciones y esperas.</li><li>Seguridad y uso de tus datos.</li>'}</ul>
        <a class="ver" href="${url}" target="_blank" rel="opener">📖 Leer los términos completos</a>
        <label class="tyc-chk"><input type="checkbox" id="tycOk"> <span>Leí y acepto los <b>Términos y condiciones${cond ? ' para conductores' : ''}</b>.</span></label></div>
      <div class="tyc-f"><button class="si" id="tycSi" disabled>Aceptar y continuar</button><button class="no" id="tycNo">${o.textoSalir || 'Ahora no, cerrar sesión'}</button></div></div>`;
    document.body.append(ov);
    const si = ov.querySelector('#tycSi');
    ov.querySelector('#tycOk').onchange = e => { si.disabled = !e.target.checked; };
    si.onclick = async () => { si.disabled = true; si.textContent = 'Guardando…'; try { await o.aceptar(); ov.remove(); res(true); } catch (er) { si.disabled = false; si.textContent = 'Aceptar y continuar'; if (typeof toast === 'function') toast(er.message, 'error'); } };
    ov.querySelector('#tycNo').onclick = () => { ov.remove(); res(false); if (o.salir) o.salir(); };
  });
}
