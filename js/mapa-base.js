// Fondo de los mapas: lo pone js/mapa-gl.js al crear cada mapa (OpenFreeMap vectorial, con el mapa clásico
// de OpenStreetMap como respaldo). Se mantiene capaBase() para no cambiar las pantallas que la llaman.
(function () { window.capaBase = function () { return null; }; })();
