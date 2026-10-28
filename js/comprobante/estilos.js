// Estilos del comprobante de viaje, del ticket imprimible y de los diálogos que comparten su diseño.
// CP_CSS se inyecta en la página (cpEstilos) y también va dentro del ticket imprimible (ticketHtml).
const CP_CSS = `.cp-desg{margin:0 18px 4px;padding:8px 12px;background:#f6f8fb;border-radius:12px;font-size:13.5px;color:#33475b}
.cp-dl{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 0}
.cp-dl b{color:#0f2740;white-space:nowrap}
.cp-info summary{display:block;list-style:none;cursor:pointer}
.cp-info summary::-webkit-details-marker,.cp-info summary::marker{display:none;content:''}
.cp-dl>span{display:inline-block;min-width:0;text-align:left}
.cp-i{display:inline-block;width:17px;height:17px;line-height:17px;text-align:center;border-radius:50%;background:#2a86e8;color:#fff;font:italic 700 11.5px/17px Georgia,serif;margin-left:6px;vertical-align:middle}
.cp-info p{margin:4px 0 2px;padding:7px 10px;background:#e8f1fc;color:#1d4f86;border-radius:9px;font-size:12.5px;line-height:1.4}
.cp-cargo{display:block;margin-top:8px;font-style:normal;font-size:12.5px;color:#9b5b00;background:#fff4e5;border-radius:10px;padding:5px 10px}
.cp-dlg{position:fixed;inset:0;z-index:7000;background:rgba(10,25,45,.6);display:flex;align-items:center;justify-content:center;padding:16px}
.cp-dlg-c{background:#fff;width:100%;max-width:420px;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:cpIn .2s ease-out;color:#0f2740;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.cp-dlg-h{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:18px 16px 14px}
.cp-dlg-h .e{font-size:34px}
.cp-dlg-h h3{margin:4px 0 0;font-size:19px}
.cp-dlg-b{padding:16px 18px 6px;font-size:15px;line-height:1.5;color:#33475b}
.cp-dlg-b ul{margin:8px 0;padding-left:0;list-style:none}
.cp-dlg-b li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:12px;margin:6px 0;background:#f4f7fa}
.cp-dlg-b li b{color:#0f2740}
.cp-dlg-b li.v{background:#eaf7ee}
.cp-dlg-b li.a{background:#fff6e5}
.cp-dlg-b li.r{background:#fdeeee}
.cp-dlg-b .t{font-size:20px;line-height:1.2}
.cp-dlg-b .nota{font-size:13px;color:#627280;margin:8px 0}
.cp-dlg-b .monto{font-size:30px;font-weight:900;color:#b42323;text-align:center;margin:6px 0}
.cp-dlg-f{display:flex;flex-direction:column;gap:6px;padding:12px 18px 18px}
.cp-dlg-f button{border:0;border-radius:14px;padding:14px;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
.cp-dlg-f .si{background:#4a8125;color:#fff}
.cp-dlg-f .si.rojo{background:#d43d3d}
.cp-dlg-f .no{background:none;color:#627280;font-weight:700;font-size:14.5px;padding:8px}
.cp-mov{display:flex;gap:12px;align-items:stretch}
.cp-mov-n{flex:0 0 74px;border-radius:14px;background:linear-gradient(135deg,#183c62,#215181);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px}
.cp-mov-n small{font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;opacity:.8;font-weight:700}
.cp-mov-n b{font-size:30px;line-height:1.1}
.cp-mov-d{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.cp-mov-c{display:flex;gap:8px;align-items:flex-start}
.cp-mov-c>span{font-size:17px;line-height:1.2}
.cp-mov-c small{display:block;font-size:11px;color:#627280;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.cp-mov-c b{display:block;font-size:14.5px;color:#0f2740;word-break:break-word}
.cp-mov-c em{display:block;font-style:normal;font-size:12.5px;color:#5b6b7b}
.cp-mov-t{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cp-pat{display:inline-block;border:2px solid #0f2740;border-top:6px solid #1f4e9c;border-radius:6px;padding:1px 9px;font:800 14px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:1.5px;color:#0f2740;background:#fff}
.cp-lic{font-size:12.5px;font-weight:700;color:#33475b;background:#eef2f6;border-radius:999px;padding:3px 10px}
.cp-ov{position:fixed;inset:0;z-index:5500;background:#eef2f6;display:flex;flex-direction:column;animation:cpIn .2s ease-out}
@keyframes cpIn{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.cp-bar{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:#0f2740;color:#fff}
.cp-bar b{flex:1;font-size:17px}.cp-bar span{width:38px}
.cp-vol{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:26px;line-height:1;cursor:pointer}
.cp-scroll{flex:1;overflow:auto;padding:16px 14px 20px}
.cp{max-width:440px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,39,64,.12)}
.cp-cab{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:18px 16px 22px;position:relative}
.cp-cab img{height:38px;width:auto;opacity:.95}
.cp-ok{width:46px;height:46px;border-radius:50%;background:#64a135;color:#fff;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:12px auto 6px;box-shadow:0 0 0 6px rgba(122,193,67,.25)}
.cp-cab h3{margin:4px 0 2px;font-size:19px}.cp-cab small{opacity:.8}
.cp-num{display:table;margin:8px auto 0;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 12px;font-weight:800;font-size:13px;letter-spacing:.3px}
.cp-tot{text-align:center;padding:16px 16px 12px}.cp-tot small{display:block;color:#627280;font-size:13px}
.cp-tot b{display:block;font-size:38px;font-weight:900;color:#0f2740;letter-spacing:-.5px;margin:2px 0 8px}
.cp-pago{display:inline-block;background:#eef2f6;color:#33475b;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700}.cp-pago.ok{background:#e3f6e8;color:#1b6e31}
.cp-corte{height:22px;position:relative;margin:0 -1px}
.cp-corte::before{content:'';position:absolute;left:22px;right:22px;top:10px;border-top:2px dashed #d5dee6}
.cp-corte::after{content:'';position:absolute;left:-11px;right:-11px;top:0;height:22px;background:radial-gradient(circle at 11px 11px,#eef2f6 10.5px,transparent 11px) left/100% 100% no-repeat,radial-gradient(circle at calc(100% - 11px) 11px,#eef2f6 10.5px,transparent 11px) left/100% 100% no-repeat}
.cp-sec{padding:12px 18px;border-bottom:1px solid #eef2f6}
.cp-ruta{position:relative;display:flex;flex-direction:column;gap:12px}
.cp-ruta>div{position:relative;padding-left:24px}.cp-ruta small{display:block;color:#627280;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px}.cp-ruta b{font-size:14.5px;color:#0f2740}
.cp-ruta i{position:absolute;left:3px;top:4px;width:12px;height:12px;border-radius:50%}.cp-ruta i.o{background:#278449;box-shadow:0 0 0 3px #dff3e6}.cp-ruta i.d{background:#2a86e8;box-shadow:0 0 0 3px #dcebfb}
.cp-ruta>div:first-child:not(:last-child)::after{content:'';position:absolute;left:8px;top:20px;bottom:-12px;border-left:2px dotted #b9c6d2}
.cp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px}
.cp-d{display:flex;gap:8px;align-items:flex-start;min-width:0}.cp-d>span{width:30px;height:30px;flex:none;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:15px}
.cp-d div{min-width:0}.cp-d small{display:block;color:#627280;font-size:11.5px}.cp-d b{display:block;font-size:13.5px;color:#0f2740;word-break:break-word}
.cp-cal{display:flex;justify-content:space-between;align-items:center;color:#33475b;font-size:14px}.cp-cal b{color:#f5a623;font-size:18px;letter-spacing:2px}.cp-cal i{color:#d5dee6;font-style:normal}
.cp-pie{text-align:center;padding:16px;color:#33475b;font-weight:700}.cp-pie small{font-weight:400;color:#8696a5}
.cp-acc{display:flex;gap:10px;padding:12px 14px;padding-bottom:calc(12px + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -4px 14px rgba(0,0,0,.06)}
.cp-acc .btn{flex:1;margin:0}
.cp-pdf .cp-corte::after{display:none}
.cp-sh{position:fixed;inset:0;z-index:6000;background:rgba(10,20,30,.45);display:flex;align-items:flex-end;justify-content:center;animation:cpIn .15s}
.cp-sh>div{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom))}
.cp-sh h4{margin:2px 4px 12px;font-size:16px;color:#0f2740}
.cp-sh-g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cp-sh-g a,.cp-sh-g button{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:8px 2px;font:inherit;font-size:12.5px;color:#33475b;text-decoration:none;cursor:pointer;border-radius:12px}
.cp-sh-g a:active,.cp-sh-g button:active{background:#f1f5f9}
.cp-sh-g i{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:24px;color:#fff}
.cp-sh-x{display:block;width:100%;margin-top:12px;border:0;background:#eef2f6;border-radius:12px;padding:12px;font:inherit;font-weight:700;color:#33475b;cursor:pointer}`;
function cpEstilos() { if (document.getElementById('cp-css')) return; const s = document.createElement('style'); s.id = 'cp-css'; s.textContent = CP_CSS; document.head.append(s); }
