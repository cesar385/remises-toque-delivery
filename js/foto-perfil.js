// Foto de perfil (app del pasajero y del conductor): elegir de la cámara o la galería, recortarla cuadrada y achicarla.
// Se guarda como JPEG de 256 px (≈ 15–25 KB) para que viaje rápido.
(function () {
  const LADO = 256, CALIDAD = 0.8;

  // Abre el selector del celular (cámara o galería). Devuelve el archivo elegido o null.
  const elegirArchivo = () => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    i.onchange = () => { res(i.files && i.files[0] || null); i.remove(); };
    document.body.append(i); i.click();
  });

  const cargarImagen = file => new Promise((ok, mal) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto. Probá con otra.')); };
    img.src = url;
  });

  // Recorte cuadrado centrado y achicado a LADO × LADO
  const recortar = img => {
    const l = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement('canvas');
    cv.width = cv.height = LADO;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, LADO, LADO);
    cx.drawImage(img, (img.naturalWidth - l) / 2, (img.naturalHeight - l) / 2, l, l, 0, 0, LADO, LADO);
    return cv.toDataURL('image/jpeg', CALIDAD);
  };

  // Elige y prepara la foto: devuelve el data URL listo para guardar, o null si se canceló
  const elegirFotoPerfil = async () => {
    const f = await elegirArchivo(); if (!f) return null;
    if (!/^image\//.test(f.type || 'image/')) throw new Error('Elegí una foto (JPG, PNG o similar).');
    return recortar(await cargarImagen(f));
  };

  // Círculo con la foto o, si no hay, las iniciales
  const iniciales = nombre => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
  const avatarHtml = (foto, nombre) => foto && /^data:image\//.test(foto)
    ? `<img src="${foto}" alt="Foto de ${String(nombre || 'perfil').replace(/[<>"&]/g, '')}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">`
    : iniciales(nombre).replace(/[<>"&]/g, '');

  window.FOTO_PERFIL = { elegirFotoPerfil, avatarHtml, iniciales };
})();
