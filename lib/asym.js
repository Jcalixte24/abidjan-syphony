/* BOMLAAH — petites fonctions communes (réservation, billet QR, accueil). Nécessite lib/qrcode.js. */
(function () {
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';        // sans I, L, O, 0, 1 : pas de confusion à la lecture

  /** Code de réservation : CC-XXXXXX (ciné-concert) ou MC-XXXXXX (masterclass). */
  function code(prefixe) {
    var a = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(a);
    var s = '';
    for (var i = 0; i < 6; i++) s += ALPHA.charAt(a[i] % ALPHA.length);
    return prefixe + '-' + s;
  }

  /** QR code dessiné dans un canvas carré (fond blanc, marge de 4 modules). */
  function qrCanvas(texte, px) {
    var q = qrcode(0, 'M');
    q.addData(texte);
    q.make();
    var n = q.getModuleCount(), m = 4, cell = Math.max(2, Math.floor(px / (n + 2 * m)));
    var size = cell * (n + 2 * m), c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
    x.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    return c;
  }

  /** Billet à enregistrer (image PNG) : QR + code + infos. `lignes` = textes sous le code. */
  function billetPng(codeBillet, lignes) {
    var W = 900, H = 1280, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d'), sans = 'Montserrat, Arial, Helvetica, sans-serif';
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#FFB347'; x.fillRect(0, 0, W, 18);
    x.textAlign = 'center';
    x.fillStyle = '#fff'; x.font = '800 66px ' + sans; x.fillText('BOMLAAH', W / 2, 140);
    x.fillStyle = '#FFB347'; x.font = '600 30px ' + sans; x.fillText('BILLET · CINÉ-CONCERT', W / 2, 196);
    x.fillStyle = '#fff'; x.beginPath();
    if (x.roundRect) x.roundRect(110, 250, 680, 680, 36); else x.rect(110, 250, 680, 680);
    x.fill();
    x.drawImage(qrCanvas(codeBillet, 640), 130, 270, 640, 640);
    x.fillStyle = '#FFB347'; x.font = '800 78px "Courier New", monospace'; x.fillText(codeBillet, W / 2, 1022);
    x.fillStyle = '#fff'; x.font = '600 38px ' + sans;
    (lignes || []).forEach(function (l, i) { x.fillText(l, W / 2, 1100 + i * 54); });
    return c.toDataURL('image/png');
  }

  function telecharger(dataUrl, nom) {
    var a = document.createElement('a');
    a.href = dataUrl; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /** Appel de l'API Google par balise <script> (JSONP) : fonctionne depuis n'importe quel site, sans réglage. */
  function jsonp(url, ok, ko) {
    var nom = 'asym_cb_' + Math.random().toString(36).slice(2), s = document.createElement('script'), fini = false;
    function nettoyer() { clearTimeout(t); try { delete window[nom]; } catch (e) { window[nom] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); }
    var t = setTimeout(function () { if (!fini) { fini = true; nettoyer(); if (ko) ko(); } }, 15000);
    window[nom] = function (r) { if (!fini) { fini = true; nettoyer(); ok(r); } };
    s.onerror = function () { if (!fini) { fini = true; nettoyer(); if (ko) ko(); } };
    s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + nom;
    document.head.appendChild(s);
  }

  window.ASYM = { code: code, qrCanvas: qrCanvas, billetPng: billetPng, telecharger: telecharger, jsonp: jsonp };
})();
