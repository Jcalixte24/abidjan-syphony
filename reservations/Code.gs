/**
 * BOMLAAH — Réservations (Google Sheet + e-mails + billet QR + accueil)
 *
 * Ce script reçoit les réservations du site, les enregistre dans ce Google Sheet, puis :
 *   - envoie une confirmation à la personne (avec son code et un lien vers son billet QR)
 *   - prévient l'équipe par e-mail à chaque nouvelle réservation (avec les totaux à jour)
 *   - envoie des rappels automatiques avant l'événement (« Je viens » / « Je ne viens pas »)
 *   - sert la page « billet » (QR code) et la page « accueil » (scan à l'entrée du site)
 *   - tient un tableau de bord : réservations, places, présents, annulations
 *
 * Mode d'emploi : voir README.md.
 */

// ========================= À MODIFIER =========================
const CONFIG = {
  EMAIL_EQUIPE: '',                       // reçoit une alerte à chaque réservation. Plusieurs adresses : 'a@x.com,b@y.com'
  CLE_ACCUEIL: '',                        // clé de l'espace SCAN (équipe d'accueil) : peut seulement valider les billets (12 caractères ou plus)
  CLE_ADMIN: '',                          // clé de l'espace ORGANISATEURS : liste des inscrits, places, accepter / refuser (différente de la précédente)
  URL_ORGANISATEURS: 'https://admin.bomlaah.com/',                  // optionnel : adresse cachée de l'espace organisateurs, ex. 'https://admin.mondomaine.com/' (sinon : site + organisateurs/)
  URL_SCAN: 'https://scan.bomlaah.com/',                           // optionnel : adresse cachée de l'espace scan, ex. 'https://scan.mondomaine.com/' (sinon : site + scan/)
  URL_SITE: 'https://bomlaah.com/',   // adresse du site (avec « / » à la fin)
  NOM_EXPEDITEUR: 'BOMLAAH',
  REPONDRE_A: '',                         // optionnel : adresse qui reçoit les réponses des inscrits
  DATE_EVENEMENT: '2026-11-13',           // AAAA-MM-JJ
  DATE_AFFICHEE: 'vendredi 13 novembre 2026',
  LIEU: 'YELAM’S, Treichville, Abidjan',
  PLACES_CINECONCERT: 400,                // capacité du ciné-concert : au-delà, le formulaire affiche « complet » (0 = pas de limite)
  PLACES_PAR_MASTERCLASS: 12,             // places par masterclass
  MASTERCLASS: [                          // titres exacts du formulaire du site (assets/data.js)
    "Droits d'auteur et économie des industries culturelles et créatives",
    "Le métier de compositeur de musique à l'image",
    "Opportunités de carrière dans les ICC",
    "Réalisateur et compositeur : le film d'animation",
    "Réalisateur et compositeur : le film de fiction"
  ],
  HORAIRES: '',                           // optionnel, ex. 'Masterclass dès 9h · Ciné-concert à 19h'
  JOURS_RAPPELS: [5, 1],                  // rappels envoyés à J-5 et J-1
  HEURE_ENVOI_RAPPELS: 9,                 // heure d'envoi automatique (heure d'Abidjan)
  FUSEAU: 'Africa/Abidjan'
};
// ==============================================================

const FORMULAIRES = {
  cineconcert: {
    onglet: 'Ciné-concert',
    prefixe: 'CC',
    colonnes: [['Prénom', 'prenom'], ['Nom', 'nom'], ['E-mail', 'email'], ['Téléphone', 'telephone'], ['Places', 'places'], ['Profil', 'profil'], ['Précision du profil', 'profil_autre'], ['Connu par', 'source'], ['Droit à l’image', 'droit_image']],
    requis: ['prenom', 'nom', 'email', 'telephone', 'places', 'profil', 'source', 'droit_image']
  },
  masterclass: {
    onglet: 'Masterclass',
    prefixe: 'MC',
    colonnes: [['Prénom', 'prenom'], ['Nom', 'nom'], ['E-mail', 'email'], ['Téléphone', 'telephone'], ['Vous êtes', 'statut'], ['Profil', 'profil'], ['Établissement', 'etablissement'], ['Filière et niveau', 'niveau'], ['Structure', 'structure'], ['Masterclass', 'thematique'], ['Motivation', 'motivation'], ['Connu par', 'source'], ['Droit à l’image', 'droit_image']],
    requis: ['prenom', 'nom', 'email', 'telephone', 'statut', 'thematique', 'source', 'droit_image']
  }
};
const ONGLET_BORD = 'Tableau de bord';
const ONGLET_AVIS = 'Avis';

// Statut de départ. Pour les masterclass, l'équipe passe la ligne à « Retenu » après sélection :
// seuls les statuts de STATUTS_RAPPEL reçoivent des rappels et peuvent entrer.
const STATUT_INITIAL = { cineconcert: 'Inscrit', masterclass: 'Candidature' };
const STATUTS_RAPPEL = ['Inscrit', 'Confirmé', 'Retenu'];
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* ============================ Réception du formulaire ============================ */

/** Anti-robot : au plus 30 demandes par minute au total et 5 par adresse e-mail et par 10 minutes. */
function limiter_(email) {
  try {
    const c = CacheService.getScriptCache(), kg = 'rl_g', ke = 'rl_' + email;
    const g = Number(c.get(kg) || 0), e = Number(c.get(ke) || 0);
    if (g >= 30 || e >= 5) return false;
    c.put(kg, String(g + 1), 60); c.put(ke, String(e + 1), 600);
  } catch (err) { console.warn('limiteur indisponible', err); }
  return true;
}

/** E-mail « déjà enregistré » : renvoie le code existant. Retourne false si l'e-mail n'a pas pu partir. */
function mailDoublon_(type, p, code) {
  try {
    const intro = type === 'masterclass'
      ? 'Vous avez déjà candidaté à cette masterclass : une seule réservation par personne. Votre candidature est enregistrée sous le code ' + code + '.'
      : 'Votre réservation est déjà enregistrée sous le code ' + code + '. Voici de nouveau votre billet.';
    envoyer_(texte_(p.email), (type === 'masterclass' ? 'Votre candidature' : 'Votre billet') + ' · BOMLAAH', 'Bonjour ' + texte_(p.prenom) + ',\n\n' + intro + '\n\nMon billet : ' + lienBillet_(code) + '\n\nBOMLAAH',
      gabarit_('Déjà enregistré', '<p>' + h_(intro) + '</p><p>' + bouton_(lienBillet_(code), type === 'masterclass' ? 'Voir ma candidature' : 'Voir mon billet (QR code)') + '</p>'));
    return true;
  } catch (err) { console.error('doublon', err); return false; }
}

/** Avis laissé par un spectateur (page /avis/, QR code affiché à la fin de la soirée). Écrit dans l'onglet « Avis ». */
function avis_(p) {
  if (p._gotcha) return { ok: true };
  if (!(Number(p.delai) >= 1500)) return { ok: false, erreur: 'robot' };
  const note = Number(p.note);
  if (!(note >= 1 && note <= 5) || note % 1 !== 0) return { ok: false, erreur: 'Note invalide' };
  try {
    const c = CacheService.getScriptCache(), g = Number(c.get('rl_avis') || 0);
    if (g >= 120) return { ok: false, erreur: 'trop_de_demandes' };
    c.put('rl_avis', String(g + 1), 60);
  } catch (err) { console.warn('limiteur indisponible', err); }
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let f = ss.getSheetByName(ONGLET_AVIS);
    if (!f) {
      f = ss.insertSheet(ONGLET_AVIS);
      f.getRange(1, 1, 1, 7).setValues([['Date', 'Note', 'Ce que vous avez aimé', 'À améliorer', 'Message', 'Nom', 'E-mail']]).setFontWeight('bold').setBackground('#101018').setFontColor('#FFB347');
      f.setFrozenRows(1);
    }
    const ligne = [new Date(), note, texte_(p.aime).slice(0, 1000), texte_(p.ameliorer).slice(0, 1000), texte_(p.message).slice(0, 1000), texte_(p.nom).slice(0, 200), texte_(p.email).slice(0, 200)];
    const n = f.getLastRow() + 1;
    f.getRange(n, 1, 1, 7).setNumberFormats([['dd/mm/yyyy hh:mm', '0', '@', '@', '@', '@', '@']]).setValues([ligne]);
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, erreur: 'Erreur serveur' };
  } finally {
    verrou.releaseLock();
  }
}

/** Réception d'un formulaire (envoi classique en POST). */
function doPost(e) {
  return json_(inscrire_((e && e.parameter) || {}));
}

/** Enregistre une réservation ou une candidature et renvoie un résultat que le site peut lire : { ok, code, mail } ou { ok:false, erreur }. */
function inscrire_(p) {
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
    if (p._gotcha) return { ok: true };                       // robot : on ignore en silence
    if (p.humain !== '1' || !(Number(p.delai) >= 2500)) return { ok: false, erreur: 'robot' };   // case « Je ne suis pas un robot » cochée et formulaire rempli en plus de 2,5 s
    const type = p.formulaire === 'masterclass' ? 'masterclass' : 'cineconcert';
    if (!limiter_(texte_(p.email).toLowerCase())) return { ok: false, erreur: 'trop_de_demandes' };
    const erreur = valider_(type, p);
    if (erreur) return { ok: false, erreur: erreur };

    const f = FORMULAIRES[type];
    const feuille = feuille_(type);
    const t = table_(feuille);

    // Même personne qui valide deux fois : on renvoie le code existant, sans doublon ni nouvel e-mail.
    const email = texte_(p.email).toLowerCase();
    const cleDoublon = f.colonnes.map(c => texte_(p[c[1]]).toLowerCase()).join('|');
    const existante = t.valeurs.slice(1).find(l => String(l[t.col['E-mail']]).toLowerCase() === email &&
      f.colonnes.map(c => String(l[t.col[c[0]]]).toLowerCase()).join('|') === cleDoublon);
    if (existante) return { ok: true, code: existante[t.col['Code']], doublon: true, mail: mailDoublon_(type, p, existante[t.col['Code']]) };
    if (type === 'masterclass') {      // une réservation par personne et par masterclass : un doublon ne crée pas de ligne, la personne reçoit son code
      const nomMc = texte_(p.thematique).toLowerCase();
      const deja = t.valeurs.slice(1).find(l => String(l[t.col['E-mail']]).toLowerCase() === email && String(l[t.col['Masterclass']]).toLowerCase() === nomMc &&
        ['Annulé', 'Refusé'].indexOf(String(l[t.col['Statut']])) === -1);
      if (deja) return { ok: true, code: deja[t.col['Code']], doublon: true, mail: mailDoublon_(type, p, deja[t.col['Code']]) };
    }

    const rg = reglages_();
    if ((type === 'cineconcert' && rg.cine.ferme) || (type === 'masterclass' && rg.master.ferme)) return { ok: false, erreur: 'ferme' };
    if (type === 'cineconcert') {
      const cap = rg.cine.capacite;
      if (cap) {
        const pris = lignes_('cineconcert').filter(l => l['Statut'] !== 'Annulé').reduce((s, l) => s + (Number(l['Places']) || 1), 0);
        if (pris + Number(p.places) > cap) return { ok: false, erreur: 'complet', restantes: Math.max(cap - pris, 0) };
      }
    }

    // Le site fabrique le code (pour afficher le QR tout de suite) ; on le garde s'il est valide et libre.
    const codes = t.valeurs.slice(1).map(l => String(l[t.col['Code']]));
    let code = texte_(p.code).toUpperCase();
    const formeOk = new RegExp('^' + f.prefixe + '-[' + ALPHABET_CODE + ']{6}$').test(code);
    if (!formeOk || codes.indexOf(code) !== -1) code = genererCode_(f.prefixe, codes);

    const ligne = [new Date(), code]
      .concat(f.colonnes.map(c => c[1] === 'places' ? Number(p.places) : texte_(p[c[1]])))
      .concat([STATUT_INITIAL[type]])
      .concat(type === 'masterclass' ? [''] : [])
      .concat(CONFIG.JOURS_RAPPELS.map(() => ''))
      .concat(['']);
    // On écrit la ligne en forçant le format texte AVANT les valeurs : « +225 07… » ne devient pas une formule (#ERROR!).
    const eh = entetes_(type), numero = feuille.getLastRow() + 1;
    const zone = feuille.getRange(numero, 1, 1, ligne.length);
    zone.setNumberFormats([ligne.map((v, i) => i === 0 ? 'dd/mm/yyyy hh:mm' : eh[i] === 'Places' ? '0' : '@')]);
    zone.setValues([ligne]);

    verrou.releaseLock();   // la ligne est écrite : on libère le verrou avant d'envoyer les e-mails (plus lents), pour ne pas bloquer les autres réservations
    // Un e-mail qui ne part pas (quota, adresse refusée) ne doit jamais faire perdre la réservation, déjà enregistrée.
    let mail = true;
    try { envoyerConfirmation_(type, p, code); } catch (err) { mail = false; console.error('confirmation', err); }
    try { notifierEquipe_(type, p, code, feuille); } catch (err) { console.error('alerte équipe', err); }
    return { ok: true, code: code, mail: mail };
  } catch (err) {
    console.error(err);
    return { ok: false, erreur: 'Erreur serveur' };
  } finally {
    verrou.releaseLock();
  }
}

function valider_(type, p) {
  const f = FORMULAIRES[type];
  for (let i = 0; i < f.requis.length; i++) {
    if (!texte_(p[f.requis[i]])) return 'Champ manquant : ' + f.requis[i];
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texte_(p.email))) return 'E-mail invalide';
  if (!/^oui$/i.test(texte_(p.droit_image))) return 'Autorisation du droit à l’image requise';
  if (texte_(p.telephone).replace(/\D/g, '').length < 8) return 'Téléphone invalide';
  if (type === 'cineconcert') {
    const n = Number(p.places);
    if (!(n >= 1 && n <= 3) || n % 1 !== 0) return 'Nombre de places invalide';   // 3 places maximum par réservation
    if (/^autre/i.test(texte_(p.profil)) && !texte_(p.profil_autre)) return 'Précisez votre profil';
  } else if (/^étudiant/i.test(texte_(p.statut))) {
    if (!texte_(p.etablissement) || !texte_(p.niveau)) return 'Établissement et filière requis pour un étudiant';
  } else if (!/^amateur/i.test(texte_(p.statut)) && !texte_(p.profil)) {
    return 'Profil requis';
  }
  return '';
}

/* ============================ Confirmation / alerte équipe ============================ */

function lienBillet_(code) { return CONFIG.URL_SITE + 'billet/?c=' + encodeURIComponent(code); }

function envoyerConfirmation_(type, p, code) {
  const prenom = texte_(p.prenom);
  const lignes = [['Code', '<b>' + h_(code) + '</b>'], ['Date', h_(CONFIG.DATE_AFFICHEE)], ['Lieu', h_(CONFIG.LIEU)]];
  if (CONFIG.HORAIRES) lignes.push(['Horaires', h_(CONFIG.HORAIRES)]);
  let sujet, intro, texte, bouton = '';
  if (type === 'cineconcert') {
    const n = Number(p.places);
    lignes.push(['Places', String(n)]);
    lignes.push(['Ouverture des portes', '18h00']);
    sujet = 'Votre billet · BOMLAAH';
    intro = 'Votre réservation pour le ciné-concert est enregistrée (' + n + ' place' + (n > 1 ? 's' : '') + '). Votre billet est un QR code : présentez-le à l\'entrée, sur votre téléphone ou imprimé.';
    bouton = '<p>' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)') + '</p>';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nMon billet : ' + lienBillet_(code) + '\nCode : ' + code + '\nDate : ' + CONFIG.DATE_AFFICHEE + '\nLieu : ' + CONFIG.LIEU + '\n\nÀ bientôt,\nBOMLAAH';
  } else {
    lignes.push(['Masterclass', h_(texte_(p.thematique))]);
    lignes.push(['Horaire', horaireMasterclass_(p.thematique)]);
    sujet = 'Votre candidature · BOMLAAH';
    intro = 'Nous avons bien reçu votre candidature aux masterclass. Chaque masterclass accueille douze participants : vous recevrez une réponse par e-mail.';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nCode : ' + code + '\nMasterclass : ' + texte_(p.thematique) + '\n\nÀ bientôt,\nBOMLAAH';
  }
  const html = gabarit_('Merci ' + prenom, '<p>' + h_(intro) + '</p>' + tableau_(lignes) + bouton +
    '<p style="color:#555;font-size:13px">Pensez à vérifier vos courriers indésirables si vous ne retrouvez pas nos messages.</p>');
  envoyer_(texte_(p.email), sujet, texte, html);
}

/** Horaire d'une masterclass : « Droits » et « film d'animation » à 8h, les trois autres à 10h30. */
function horaireMasterclass_(titre) {
  return /droits|animation/i.test(String(titre)) ? '08h00 – 10h00' : '10h30 – 12h30';
}

function notifierEquipe_(type, p, code, feuille) {
  if (!CONFIG.EMAIL_EQUIPE) return;
  const tot = totaux_(type, feuille);
  const nom = texte_(p.prenom) + ' ' + texte_(p.nom);
  let sujet, lignes;
  if (type === 'cineconcert') {
    sujet = 'Nouvelle réservation ciné-concert · ' + nom + ', ' + Number(p.places) + ' place(s) · total ' + tot.places;
    lignes = [['Nom', h_(nom)], ['E-mail', h_(texte_(p.email))], ['Téléphone', h_(texte_(p.telephone))], ['Places', String(Number(p.places))], ['Profil', h_(texte_(p.profil) + (texte_(p.profil_autre) ? ' : ' + texte_(p.profil_autre) : ''))], ['Connu par', h_(texte_(p.source))], ['Code', h_(code)]];
  } else {
    sujet = 'Nouvelle candidature masterclass · ' + nom + ' · ' + tot.inscriptions + ' candidature(s)';
    lignes = [['Nom', h_(nom)], ['E-mail', h_(texte_(p.email))], ['Téléphone', h_(texte_(p.telephone))], ['Vous êtes', h_(texte_(p.statut))], ['Profil', h_(texte_(p.profil))], ['Établissement', h_(texte_(p.etablissement))], ['Filière', h_(texte_(p.niveau))], ['Structure', h_(texte_(p.structure))], ['Masterclass', h_(texte_(p.thematique))], ['Motivation', h_(texte_(p.motivation))], ['Connu par', h_(texte_(p.source))], ['Code', h_(code)]];
  }
  const total = type === 'cineconcert'
    ? tot.inscriptions + ' réservation(s), ' + tot.places + ' place(s) au total'
    : tot.inscriptions + ' personne(s) candidate(s) au total (une réservation par personne)';
  const lien = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  let validation = '', validationTexte = '';
  if (type === 'masterclass') {      // l'équipe valide en un clic, depuis l'e-mail
    const oui = lienValidation_(code, 'accepter'), non = lienValidation_(code, 'refuser');
    if (oui) {
      validation = '<p><b>Décision :</b></p><p>' + bouton_(oui, 'Accepter la candidature') + ' ' + bouton_(non, 'Refuser (avec motif)', true) + '</p>' +
        '<p style="color:#555;font-size:13px">Accepter envoie son billet QR au candidat. Refuser demande un motif, envoyé au candidat.</p>';
      validationTexte = '\n\nACCEPTER : ' + oui + '\nREFUSER : ' + non;
    }
  }
  const html = gabarit_('Nouvelle inscription', tableau_(lignes) +
    '<p><b>Total à jour :</b> ' + h_(total) + '</p>' + validation + bouton_(lien, 'Ouvrir la liste (Google Sheet)', !!validation));
  const texte = sujet + '\n\n' + lignes.map(l => l[0] + ' : ' + l[1].replace(/<[^>]+>/g, '')).join('\n') + '\n\nTotal : ' + total + validationTexte + '\n' + lien;
  envoyer_(CONFIG.EMAIL_EQUIPE, sujet, texte, html);
}

function totaux_(type, feuille) {
  const t = table_(feuille);
  const actives = t.valeurs.slice(1).filter(l => l[t.col['Code']] && l[t.col['Statut']] !== 'Annulé');
  const res = { inscriptions: actives.length, places: 0 };
  if (type === 'cineconcert') res.places = actives.reduce((s, l) => s + (Number(l[t.col['Places']]) || 0), 0);
  return res;
}

/* ============================ Rappels automatiques ============================ */

function envoyerRappels() {
  return envoyerRappels_(new Date());
}

function envoyerRappels_(maintenant) {
  const jours = joursAvant_(maintenant);
  if (jours < 0) return 0;
  const paliers = CONFIG.JOURS_RAPPELS.slice().sort((a, b) => a - b);
  const palier = paliers.filter(n => jours <= n)[0];               // plus petit palier atteint
  if (palier === undefined) return 0;
  const colPalier = 'Rappel J-' + palier;
  let envoyes = 0;

  Object.keys(FORMULAIRES).forEach(type => {
    const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES[type].onglet);
    if (!feuille || feuille.getLastRow() < 2) return;
    const t = table_(feuille);
    for (let r = 1; r < t.valeurs.length; r++) {
      const l = t.valeurs[r];
      if (!l[t.col['Code']] || STATUTS_RAPPEL.indexOf(l[t.col['Statut']]) === -1) continue;
      if (l[t.col[colPalier]]) continue;                            // déjà envoyé
      const inscrit = l[t.col['Date']];
      if (inscrit instanceof Date && maintenant - inscrit < 12 * 3600 * 1000) continue;   // vient de s'inscrire
      if (MailApp.getRemainingDailyQuota() < 1) { console.warn('Quota e-mail du jour atteint : la suite partira demain'); return; }

      envoyerRappel_(type, t, l, jours);
      feuille.getRange(r + 1, t.col[colPalier] + 1).setValue('Envoyé ' + Utilities.formatDate(maintenant, CONFIG.FUSEAU, 'dd/MM HH:mm'));
      paliers.filter(n => n > palier).forEach(n => {               // paliers plus lointains : plus d'actualité
        if (!l[t.col['Rappel J-' + n]]) feuille.getRange(r + 1, t.col['Rappel J-' + n] + 1).setValue('ignoré');
      });
      envoyes++;
    }
  });
  return envoyes;
}

function envoyerRappel_(type, t, l, jours) {
  const code = l[t.col['Code']];
  const prenom = l[t.col['Prénom']];
  const quand = jours === 0 ? 'C\'est aujourd\'hui' : jours === 1 ? 'C\'est demain' : 'Plus que ' + jours + ' jours';
  const lignes = [['Code', '<b>' + h_(code) + '</b>'], ['Date', h_(CONFIG.DATE_AFFICHEE)], ['Lieu', h_(CONFIG.LIEU)]];
  if (CONFIG.HORAIRES) lignes.push(['Horaires', h_(CONFIG.HORAIRES)]);
  if (type === 'cineconcert') lignes.push(['Places', String(l[t.col['Places']])]);
  else lignes.push(['Masterclass', h_(String(l[t.col['Masterclass']]))]);

  const oui = lienAction_(code, 'oui'), non = lienAction_(code, 'non');
  const boutons = oui ? '<p>' + bouton_(oui, 'Oui, je viens') + ' ' + bouton_(non, 'Je ne pourrai pas venir', true) + '</p>' : '';
  const billet = '<p>' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)', true) + '</p>';
  const html = gabarit_(quand + ' · BOMLAAH',
    '<p>Bonjour ' + h_(prenom) + ', nous avons hâte de vous accueillir. Merci de nous confirmer votre présence.</p>' + tableau_(lignes) + boutons + billet +
    '<p style="color:#555;font-size:13px">Présentez votre QR code à l\'entrée.</p>');
  const texte = 'Bonjour ' + prenom + ',\n\n' + quand + ' : ' + CONFIG.DATE_AFFICHEE + ', ' + CONFIG.LIEU + '.\nCode : ' + code +
    (oui ? '\n\nJe viens : ' + oui + '\nJe ne pourrai pas venir : ' + non : '') + '\nMon billet : ' + lienBillet_(code) + '\n\nBOMLAAH';
  envoyer_(String(l[t.col['E-mail']]), quand + ' · BOMLAAH', texte, html);
}

/* ============================ Pages et API (GET) ============================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const a = p.a || '';
  if (a === 'oui' || a === 'non') return presence_(p);               // liens des e-mails de rappel (via la page /valider/ du site)
  if (a === 'billet') return reponse_(billet_(p.code), p.callback);      // page « billet » du site (JSONP)
  if (a === 'checkin') return reponse_(checkin_(p.code, p.k), p.callback); // page « accueil » du site (JSONP)
  if (a === 'stats') return reponse_(stats_(p.k), p.callback);
  if (a === 'inscrire') return reponse_(inscrire_(p), p.callback);      // formulaire du site : le site lit la réponse (complet, fermé, doublon…)
  if (a === 'accepter' || a === 'forcer' || a === 'refuser' || a === 'refuser_ok') return validationParLien_(a, p);   // boutons de l'e-mail d'alerte (jeton secret)
  if (a === 'avis') return reponse_(avis_(p), p.callback);               // page « avis » du site (QR code de fin de soirée)
  if (a === 'dispo') return reponse_(dispo_(), p.callback);               // places restantes du ciné-concert (public, aucune donnée personnelle)
  if (a === 'liste') return reponse_(liste_(p.k), p.callback);          // application organisateurs : tous les inscrits
  if (a === 'places') return reponse_(places_(p.k), p.callback);        // places réservées / restantes
  if (a === 'statut') return reponse_(changerStatut_(p.code, p.s, p.k, p.m, p.f), p.callback);
  if (a === 'reglage') return reponse_(changerReglage_(p.cible, p.ferme, p.capacite, p.k), p.callback);
  if (a === 'vider') return reponse_(viderBase_(p.k, p.confirmation), p.callback);   // organisateurs : vide les inscriptions (confirmation écrite obligatoire)
  if (a === 'retirer') return reponse_(retirerPresence_(p.code, p.k), p.callback);
  return page_('BOMLAAH', '<p>Ce lien n\'est pas valide.</p>');
}

/** Places restantes du ciné-concert : le site s'en sert pour afficher « complet » ou limiter le nombre de places. */
function dispo_() {
  const rg = reglages_(), cap = rg.cine.capacite;
  let restantes = null;
  if (cap) {
    const pris = lignes_('cineconcert').filter(l => l['Statut'] !== 'Annulé').reduce((s, l) => s + (Number(l['Places']) || 1), 0);
    restantes = Math.max(cap - pris, 0);
  }
  return { ok: true, cine: { capacite: cap, restantes: restantes, ferme: rg.cine.ferme }, master: { ferme: rg.master.ferme } };
}

/** Infos affichées sur le billet : prénom, initiale du nom, places. Rien d'autre. */
function billet_(code) {
  const c = String(code || '').trim().toUpperCase();
  const f = /^(CC|MC)-[A-Z0-9]{6}$/.test(c) ? trouverParCode_(c) : null;
  if (!f) return { ok: false, etat: 'inconnu' };
  const t = f.t, l = f.ligne;
  return {
    ok: true, type: f.type, code: c, prenom: String(l[t.col['Prénom']]), nom: String(l[t.col['Nom']]).charAt(0).toUpperCase() + '.',
    places: f.type === 'cineconcert' ? Number(l[t.col['Places']]) || 1 : 0, statut: String(l[t.col['Statut']]),
    date: CONFIG.DATE_AFFICHEE, lieu: CONFIG.LIEU, horaires: CONFIG.HORAIRES
  };
}

/** Scan à l'entrée : marque la personne comme présente. Réservé à l'équipe (clé d'accueil). */
function checkin_(code, cle) {
  if (!cleScan_(cle)) return { ok: false, etat: 'refuse' };
  const c = String(code || '').trim().toUpperCase();
  if (!/^(CC|MC)-[A-Z0-9]{6}$/.test(c)) return { ok: false, etat: 'inconnu' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = trouverParCode_(c);
    if (!f) return { ok: false, etat: 'inconnu' };
    const t = f.t, l = f.ligne, statut = String(l[t.col['Statut']]);
    const info = { prenom: String(l[t.col['Prénom']]), nom: String(l[t.col['Nom']]), places: f.type === 'cineconcert' ? Number(l[t.col['Places']]) || 1 : 0, type: f.type, code: c,
      detail: f.type === 'cineconcert' ? '' : String(l[t.col['Masterclass']] || ''),
      profil: f.type === 'cineconcert' ? String(l[t.col['Profil']] || '') + (l[t.col['Précision du profil']] ? ' : ' + String(l[t.col['Précision du profil']]) : '') : (/^étudiant/i.test(String(l[t.col['Vous êtes']] || '')) ? 'Étudiant(e)' : String(l[t.col['Profil']] || l[t.col['Vous êtes']] || '')) };
    if (statut === 'Annulé') return Object.assign({ ok: false, etat: 'annule' }, info);
    if (statut === 'Candidature' || statut === 'Refusé') return Object.assign({ ok: false, etat: 'non_retenu' }, info);
    const deja = String(l[t.col['Présent']] || '');
    if (deja) return Object.assign({ ok: true, etat: 'deja', heure: deja.replace(/^Oui\s*/, '') }, info, stats_(cle));
    f.feuille.getRange(f.numero, t.col['Présent'] + 1).setValue('Oui ' + Utilities.formatDate(new Date(), CONFIG.FUSEAU, 'dd/MM HH:mm'));
    return Object.assign({ ok: true, etat: 'ok' }, info, stats_(cle));
  } finally {
    verrou.releaseLock();
  }
}

/** Compteurs pour la page d'accueil : présents / réservations. */
function stats_(cle) {
  if (!cleScan_(cle)) return { ok: false, etat: 'refuse' };
  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES.cineconcert.onglet);
  let reservations = 0, placesTotal = 0, presents = 0, placesPresentes = 0;
  if (feuille && feuille.getLastRow() >= 2) {
    const t = table_(feuille);
    t.valeurs.slice(1).forEach(l => {
      if (!l[t.col['Code']] || l[t.col['Statut']] === 'Annulé') return;
      const n = Number(l[t.col['Places']]) || 1;
      reservations++; placesTotal += n;
      if (String(l[t.col['Présent']] || '')) { presents++; placesPresentes += n; }
    });
  }
  const m = lignes_('masterclass').filter(l => ['Retenu', 'Confirmé'].indexOf(l['Statut']) !== -1);
  return { reservations: reservations, placesTotal: placesTotal, presents: presents, placesPresentes: placesPresentes,
    masterRetenus: m.length, masterPresents: m.filter(l => String(l['Présent'] || '')).length };
}

/** Lien « Je viens / Je ne viens pas » d'un e-mail de rappel. */
function presence_(p) {
  const rep = p.a === 'non' ? 'non' : 'oui';
  if (!p.code) return sortie_('Lien incomplet', '<p>Ce lien est incomplet. Répondez directement à notre e-mail.</p>', p);
  const trouve = trouverParCode_(String(p.code).trim().toUpperCase());
  if (!trouve) return sortie_('Code introuvable', '<p>Nous ne retrouvons pas cette réservation. Répondez directement à notre e-mail.</p>', p);
  const statut = trouve.ligne[trouve.t.col['Statut']];
  if (['Inscrit', 'Confirmé', 'Retenu', 'Annulé'].indexOf(statut) === -1) {
    return sortie_('Dossier en cours', '<p>Votre dossier est en cours d\'étude. Nous vous écrirons très bientôt.</p>', p);
  }
  const nouveau = rep === 'oui' ? 'Confirmé' : 'Annulé';
  trouve.feuille.getRange(trouve.numero, trouve.t.col['Statut'] + 1).setValue(nouveau);
  const code = trouve.ligne[trouve.t.col['Code']];
  if (rep === 'non' && CONFIG.EMAIL_EQUIPE) {
    const nom = trouve.ligne[trouve.t.col['Prénom']] + ' ' + trouve.ligne[trouve.t.col['Nom']];
    envoyer_(CONFIG.EMAIL_EQUIPE, 'Annulation · ' + nom + ' (' + code + ')',
      nom + ' ne pourra pas venir (code ' + code + '). La ligne est passée au statut « Annulé ».',
      gabarit_('Annulation', '<p>' + h_(nom) + ' ne pourra pas venir (code ' + h_(code) + ').</p><p>La ligne est passée au statut « Annulé ».</p>'));
  }
  return rep === 'oui'
    ? page_('Merci, à bientôt', '<p>Votre présence est confirmée pour le ' + h_(CONFIG.DATE_AFFICHEE) + ' à ' + h_(CONFIG.LIEU) + '.</p><p>Votre billet : ' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)') + '</p>', p)
    : page_('C\'est noté', '<p>Merci de nous avoir prévenus : votre place est libérée.</p>', p);
}

function trouverParCode_(code) {
  const types = Object.keys(FORMULAIRES);
  for (let i = 0; i < types.length; i++) {
    const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES[types[i]].onglet);
    if (!feuille || feuille.getLastRow() < 2) continue;
    const t = table_(feuille);
    for (let r = 1; r < t.valeurs.length; r++) {
      if (String(t.valeurs[r][t.col['Code']]).toUpperCase() === code) return { type: types[i], feuille: feuille, t: t, ligne: t.valeurs[r], numero: r + 1 };
    }
  }
  return null;
}

/* ============================ Application organisateurs ============================ */

const STATUTS_POSSIBLES = { cineconcert: ['Inscrit', 'Confirmé', 'Annulé'], masterclass: ['Candidature', 'Retenu', 'Refusé', 'Annulé'] };

/** Espace organisateurs : clé d'administration uniquement. */
/** Réglages modifiables depuis l'espace organisateurs : réservations fermées / ouvertes, nombre de places du ciné-concert. */
function reglages_() {
  const p = PropertiesService.getScriptProperties();
  const cap = p.getProperty('CAPACITE_CINE');
  return {
    cine: { ferme: p.getProperty('FERME_CINE') === '1', capacite: cap !== null && cap !== '' ? (Number(cap) || 0) : (Number(CONFIG.PLACES_CINECONCERT) || 0) },
    master: { ferme: p.getProperty('FERME_MASTER') === '1' }
  };
}

function changerReglage_(cible, ferme, capacite, cle) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  const p = PropertiesService.getScriptProperties();
  if (cible !== 'cine' && cible !== 'master') return { ok: false, etat: 'cible_invalide' };
  if (ferme !== undefined && ferme !== '') p.setProperty(cible === 'cine' ? 'FERME_CINE' : 'FERME_MASTER', String(ferme) === '1' ? '1' : '0');
  if (cible === 'cine' && capacite !== undefined && capacite !== '') {
    const n = Number(capacite);
    if (!(n >= 0 && n <= 100000) || n % 1 !== 0) return { ok: false, etat: 'capacite_invalide' };
    p.setProperty('CAPACITE_CINE', String(n));
  }
  return { ok: true, reglages: reglages_() };
}

/** Supprime toutes les inscriptions (ciné-concert et masterclass). Exige la clé admin ET le mot « VIDER ». Les en-têtes et le tableau de bord restent. */
function viderBase_(cle, confirmation) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  if (String(confirmation || '') !== 'VIDER') return { ok: false, etat: 'confirmation_manquante' };
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
    let supprimes = 0;
    ['cineconcert', 'masterclass'].forEach(type => {
      const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES[type].onglet);
      if (feuille && feuille.getLastRow() >= 2) { const n = feuille.getLastRow() - 1; feuille.deleteRows(2, n); supprimes += n; }
    });
    return { ok: true, supprimes: supprimes };
  } catch (err) { console.error(err); return { ok: false, erreur: 'Erreur serveur' }; } finally { verrou.releaseLock(); }
}

function cleOk_(cle) { return !!CONFIG.CLE_ADMIN && String(cle || '') === CONFIG.CLE_ADMIN; }
/** Espace scan : la clé d'accueil, ou la clé d'administration. */
function cleScan_(cle) {
  const k = String(cle || '');
  return !!k && ((!!CONFIG.CLE_ACCUEIL && k === CONFIG.CLE_ACCUEIL) || (!!CONFIG.CLE_ADMIN && k === CONFIG.CLE_ADMIN));
}

/** Toutes les lignes d'un onglet, sous forme d'objets { 'Prénom': 'Awa', … }. */
function lignes_(type) {
  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES[type].onglet);
  if (!feuille || feuille.getLastRow() < 2) return [];
  const t = table_(feuille), e = t.valeurs[0];
  return t.valeurs.slice(1).filter(l => l[t.col['Code']]).map(l => {
    const o = {};
    e.forEach((h, i) => {
      let v = l[i];
      if (v instanceof Date) v = Utilities.formatDate(v, CONFIG.FUSEAU, 'dd/MM/yyyy HH:mm');
      o[h] = v;
    });
    return o;
  });
}

/** Liste complète des inscrits : réservée à l'équipe (clé d'accueil). */
function liste_(cle) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  return { ok: true, cine: lignes_('cineconcert'), master: lignes_('masterclass'), places: places_(cle) };
}

/** Places du ciné-concert et de chaque masterclass. */
function places_(cle) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  const cine = lignes_('cineconcert'), master = lignes_('masterclass');
  const actifs = cine.filter(l => l['Statut'] !== 'Annulé');
  const n = l => Number(l['Places']) || 1;
  const placesCine = actifs.reduce((s, l) => s + n(l), 0);
  const cap = reglages_().cine.capacite;
  const presentsCine = actifs.filter(l => String(l['Présent'] || ''));
  const c = {
    reservations: actifs.length, places: placesCine, annulees: cine.length - actifs.length,
    confirmees: actifs.filter(l => l['Statut'] === 'Confirmé').reduce((s, l) => s + n(l), 0),
    presents: presentsCine.length, placesPresentes: presentsCine.reduce((s, l) => s + n(l), 0),
    capacite: cap, restantes: cap ? Math.max(cap - placesCine, 0) : null
  };
  const noms = CONFIG.MASTERCLASS.slice();
  master.forEach(l => { const m = String(l['Masterclass'] || ''); if (m && noms.indexOf(m) === -1) noms.push(m); });
  const cp = Number(CONFIG.PLACES_PAR_MASTERCLASS) || 12;
  const par = noms.map(nom => {
    const l = master.filter(x => String(x['Masterclass']) === nom && x['Statut'] !== 'Annulé' && x['Statut'] !== 'Refusé');
    const retenus = l.filter(x => ['Retenu', 'Confirmé'].indexOf(x['Statut']) !== -1).length;
    return { nom: nom, candidatures: l.length, retenus: retenus, presents: l.filter(x => String(x['Présent'] || '')).length, capacite: cp, restantes: Math.max(cp - retenus, 0) };
  });
  const m = {
    candidatures: par.reduce((s, x) => s + x.candidatures, 0), retenus: par.reduce((s, x) => s + x.retenus, 0),
    presents: par.reduce((s, x) => s + x.presents, 0), capacite: cp * noms.length, par: par
  };
  return { ok: true, cine: c, master: m, reglages: reglages_() };
}

/**
 * Change le statut d'une ligne.
 * Masterclass : « Retenu » envoie son billet QR par e-mail (avec un message facultatif de l'équipe) ;
 * « Refusé » exige un motif, enregistré dans le Sheet et envoyé par e-mail. Une masterclass pleine demande une confirmation (force = 1).
 */
function changerStatut_(code, statut, cle, motif, force) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  const c = String(code || '').trim().toUpperCase();
  if (!/^(CC|MC)-[A-Z0-9]{6}$/.test(c)) return { ok: false, etat: 'inconnu' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = trouverParCode_(c);
    if (!f) return { ok: false, etat: 'inconnu' };
    if (STATUTS_POSSIBLES[f.type].indexOf(String(statut)) === -1) return { ok: false, etat: 'statut_invalide' };
    const ancien = String(f.ligne[f.t.col['Statut']]);
    const note = texte_(motif);
    if (f.type === 'masterclass') {
      if (statut === 'Refusé' && !note) return { ok: false, etat: 'motif_requis' };
      if (statut === 'Retenu' && ancien !== 'Retenu' && String(force) !== '1') {
        const nom = String(f.ligne[f.t.col['Masterclass']]);
        const retenus = lignes_('masterclass').filter(x => String(x['Masterclass']) === nom && ['Retenu', 'Confirmé'].indexOf(x['Statut']) !== -1).length;
        const cap = Number(CONFIG.PLACES_PAR_MASTERCLASS) || 12;
        if (retenus >= cap) return { ok: false, etat: 'complet', retenus: retenus, capacite: cap };
      }
      if (f.t.col['Motif'] !== undefined && (statut === 'Refusé' || statut === 'Retenu')) f.feuille.getRange(f.numero, f.t.col['Motif'] + 1).setValue(note);
    }
    f.feuille.getRange(f.numero, f.t.col['Statut'] + 1).setValue(statut);
    if (f.type === 'masterclass' && statut === 'Retenu' && ancien !== 'Retenu') envoyerRetenu_(f, note);
    if (f.type === 'masterclass' && statut === 'Refusé' && ancien !== 'Refusé') envoyerRefus_(f, note);
    return { ok: true, code: c, statut: String(statut), ancien: ancien };
  } finally {
    verrou.releaseLock();
  }
}

function envoyerRetenu_(f, message) {
  const l = f.ligne, t = f.t, prenom = l[t.col['Prénom']], code = l[t.col['Code']];
  const lignes = [['Code', '<b>' + h_(code) + '</b>'], ['Masterclass', h_(String(l[t.col['Masterclass']]))], ['Date', h_(CONFIG.DATE_AFFICHEE)], ['Lieu', h_(CONFIG.LIEU)]];
  const intro = "Bonne nouvelle : votre candidature est retenue. Votre billet est un QR code à présenter à l'entrée de la masterclass.";
  const mot = message ? '<p><b>Message de l\'équipe :</b> ' + h_(message) + '</p>' : '';
  const html = gabarit_('Vous êtes retenu(e), ' + prenom, '<p>' + h_(intro) + '</p>' + mot + tableau_(lignes) + '<p>' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)') + '</p>');
  const texte = 'Bonjour ' + prenom + ',\n\n' + intro + (message ? '\n\nMessage de l\'équipe : ' + message : '') + '\n\nMon billet : ' + lienBillet_(code) + '\nCode : ' + code + '\n\nÀ bientôt,\nBOMLAAH';
  envoyer_(texte_(l[t.col['E-mail']]), 'Votre place à la masterclass · BOMLAAH', texte, html);
}

function envoyerRefus_(f, motif) {
  const l = f.ligne, t = f.t, prenom = l[t.col['Prénom']];
  const intro = "Merci d'avoir candidaté à une masterclass BOMLAAH. Nous ne pouvons malheureusement pas vous accorder de place cette fois-ci.";
  const html = gabarit_('Votre candidature, ' + prenom, '<p>' + h_(intro) + '</p><p><b>Motif :</b> ' + h_(motif) + '</p>' +
    '<p>Le ciné-concert du soir reste ouvert à tous sur réservation : ' + bouton_(CONFIG.URL_SITE + 'cineconcert/', 'Voir le ciné-concert', true) + '</p>');
  const texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nMotif : ' + motif + '\n\nLe ciné-concert du soir reste ouvert à tous sur réservation : ' + CONFIG.URL_SITE + 'cineconcert/\n\nCordialement,\nBOMLAAH';
  envoyer_(texte_(l[t.col['E-mail']]), 'Votre candidature à la masterclass · BOMLAAH', texte, html);
}

/** Jeton des liens de validation envoyés par e-mail : seul ce script peut le calculer (il dépend de la clé d'administration). */
function jeton_(code, action) {
  const octets = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(code) + '|' + action + '|' + CONFIG.CLE_ADMIN);
  return octets.slice(0, 12).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/** Lien placé dans les e-mails : il ouvre une page du site, qui appelle ensuite le script (Gmail rejette les e-mails qui contiennent des liens directs vers un script Google). */
function lienValidation_(code, action) {
  return CONFIG.CLE_ADMIN ? CONFIG.URL_SITE + 'valider/?a=' + action + '&code=' + encodeURIComponent(code) + '&t=' + jeton_(code, action) : '';
}

/** Réponse d'une page de validation : JSONP { titre, corps } pour la page du site, ou page HTML classique. */
function sortie_(titre, corps, p) {
  return p && p.callback ? reponse_({ ok: true, titre: titre, corps: corps }, p.callback) : page_(titre, corps);
}

/** Page ouverte depuis le bouton « Accepter » ou « Refuser » de l'e-mail d'alerte. */
function validationParLien_(a, p) {
  const code = String(p.code || '').trim().toUpperCase();
  const action = a === 'refuser_ok' ? 'refuser' : a;
  if (!/^MC-[A-Z0-9]{6}$/.test(code) || String(p.t || '') !== jeton_(code, action)) return sortie_('Lien non valide', '<p>Ce lien de validation n\'est pas valide.</p>', p);
  const f = trouverParCode_(code);
  if (!f || f.type !== 'masterclass') return sortie_('Candidature introuvable', '<p>Cette candidature n\'existe plus.</p>', p);
  const l = f.ligne, t = f.t, nom = String(l[t.col['Prénom']]) + ' ' + String(l[t.col['Nom']]), mc = String(l[t.col['Masterclass']]), statut = String(l[t.col['Statut']]);
  if (statut !== 'Candidature') return sortie_('Déjà traité', '<p>La candidature de <b>' + h_(nom) + '</b> (' + h_(mc) + ') est déjà au statut « ' + h_(statut) + ' ».</p>', p);
  if (a === 'accepter' || a === 'forcer') {
    const r = changerStatut_(code, 'Retenu', CONFIG.CLE_ADMIN, '', a === 'forcer' ? '1' : '0');
    if (r.ok) return sortie_('Candidature acceptée', '<p><b>' + h_(nom) + '</b> est retenu(e) pour « ' + h_(mc) + ' ».</p><p>Son billet QR vient de lui être envoyé par e-mail.</p>', p);
    if (r.etat === 'complet') {
      const forcer = lienValidation_(code, 'forcer');
      return sortie_('Masterclass complète', '<p>« ' + h_(mc) + ' » a déjà ' + r.retenus + ' retenus sur ' + r.capacite + ' places.</p><p>' + (forcer ? bouton_(forcer, 'Accepter quand même') : '') + '</p>', p);
    }
    return sortie_('Action impossible', '<p>La candidature n\'a pas pu être acceptée. Utilisez l\'espace organisateurs.</p>', p);
  }
  if (a === 'refuser') {
    return sortie_('Refuser la candidature', '<p><b>' + h_(nom) + '</b> · ' + h_(mc) + '</p>' +
      '<form method="get" action="' + h_(CONFIG.URL_SITE + 'valider/') + '"><input type="hidden" name="a" value="refuser_ok"><input type="hidden" name="code" value="' + h_(code) + '"><input type="hidden" name="t" value="' + h_(jeton_(code, 'refuser')) + '">' +
      '<p><label>Motif du refus (obligatoire, envoyé au candidat)<br><textarea name="m" rows="4" required style="width:100%;box-sizing:border-box;padding:8px;font:inherit"></textarea></label></p>' +
      '<button type="submit" style="background:#FFB347;color:#000;border:0;padding:10px 18px;border-radius:999px;font-weight:bold;font-size:15px">Refuser et envoyer le motif</button></form>', p);
  }
  const motif = texte_(p.m);
  if (!motif) return sortie_('Motif obligatoire', '<p>Le refus demande un motif. Revenez en arrière et saisissez-le.</p>', p);
  const r = changerStatut_(code, 'Refusé', CONFIG.CLE_ADMIN, motif, '0');
  return r.ok ? sortie_('Candidature refusée', '<p>La candidature de <b>' + h_(nom) + '</b> est refusée. Le motif lui a été envoyé par e-mail.</p>', p)
              : sortie_('Action impossible', '<p>Le refus n\'a pas pu être enregistré. Utilisez l\'espace organisateurs.</p>', p);
}

/** Annule un scan fait par erreur. */
function retirerPresence_(code, cle) {
  if (!cleOk_(cle)) return { ok: false, etat: 'refuse' };
  const c = String(code || '').trim().toUpperCase();
  if (!/^(CC|MC)-[A-Z0-9]{6}$/.test(c)) return { ok: false, etat: 'inconnu' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = trouverParCode_(c);
    if (!f) return { ok: false, etat: 'inconnu' };
    f.feuille.getRange(f.numero, f.t.col['Présent'] + 1).setValue('');
    return { ok: true, code: c };
  } finally {
    verrou.releaseLock();
  }
}

/* ============================ Installation ============================ */

function preparerFeuilles() {
  Object.keys(FORMULAIRES).forEach(feuille_);
  tableauDeBord_();
  alerte_('Les onglets « Ciné-concert », « Masterclass » et « ' + ONGLET_BORD + ' » sont prêts.');
}

function installerDeclencheurs() {
  ScriptApp.getProjectTriggers().filter(d => d.getHandlerFunction() === 'envoyerRappels').forEach(d => ScriptApp.deleteTrigger(d));
  ScriptApp.newTrigger('envoyerRappels').timeBased().everyDays(1).atHour(CONFIG.HEURE_ENVOI_RAPPELS).inTimezone(CONFIG.FUSEAU).create();
  alerte_('Envoi automatique des rappels activé : chaque jour vers ' + CONFIG.HEURE_ENVOI_RAPPELS + ' h (heure d\'Abidjan).');
}

function rappelsMaintenant() {
  alerte_(envoyerRappels() + ' rappel(s) envoyé(s).');
}

function emailDeTest() {
  if (!CONFIG.EMAIL_EQUIPE) { alerte_('Renseignez d\'abord EMAIL_EQUIPE dans le script.'); return; }
  envoyer_(CONFIG.EMAIL_EQUIPE, 'Test · BOMLAAH', 'Les e-mails fonctionnent.', gabarit_('Test réussi', '<p>Les e-mails fonctionnent.</p>'));
  alerte_('E-mail de test envoyé à ' + CONFIG.EMAIL_EQUIPE);
}

function lienAccueil() {
  if (!CONFIG.CLE_ACCUEIL) { alerte_('Renseignez d\'abord CLE_ACCUEIL dans le script.'); return; }
  alerte_('Espace SCAN (équipe d\'accueil : valider les billets uniquement). Ne le partagez qu\'au personnel :\n\n' + (CONFIG.URL_SCAN || CONFIG.URL_SITE + 'scan/') + '#k=' + CONFIG.CLE_ACCUEIL);
}

function lienOrganisateurs() {
  if (!CONFIG.CLE_ADMIN) { alerte_('Renseignez d\'abord CLE_ADMIN dans le script.'); return; }
  alerte_('Espace ORGANISATEURS (liste des inscrits, places, accepter / refuser). Réservé à l\'administration :\n\n' + (CONFIG.URL_ORGANISATEURS || CONFIG.URL_SITE + 'organisateurs/') + '#k=' + CONFIG.CLE_ADMIN);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BOMLAAH')
    .addItem('1. Préparer les onglets', 'preparerFeuilles')
    .addItem('2. Envoyer un e-mail de test', 'emailDeTest')
    .addItem('3. Activer les rappels automatiques', 'installerDeclencheurs')
    .addSeparator()
    .addItem('Lien de l\'espace organisateurs', 'lienOrganisateurs')
    .addItem('Lien de l\'espace scan (accueil)', 'lienAccueil')
    .addItem('Envoyer les rappels maintenant', 'rappelsMaintenant')
    .addToUi();
}

/* ============================ Feuilles ============================ */

function feuille_(type) {
  const f = FORMULAIRES[type];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(f.onglet);
  if (!feuille) feuille = ss.insertSheet(f.onglet);
  if (feuille.getLastRow() === 0) {
    const e = entetes_(type);
    feuille.getRange(1, 1, 1, e.length).setValues([e]).setFontWeight('bold').setBackground('#101018').setFontColor('#FFB347');
    feuille.setFrozenRows(1);
    const n = Math.max(feuille.getMaxRows() - 1, 1);
    e.forEach((titre, i) => {
      const fmt = i === 0 ? 'dd/mm/yyyy hh:mm' : titre === 'Places' ? '0' : '@';   // texte brut : aucune formule ne peut s'exécuter
      feuille.getRange(2, i + 1, n, 1).setNumberFormat(fmt);
    });
    try { mettreEnForme_(feuille, e); } catch (err) { console.warn(err); }
  }
  return feuille;
}

/** Couleurs de lecture : présent = vert, annulé = gris, confirmé = orange. */
function mettreEnForme_(feuille, e) {
  const L = lettre_(e.indexOf('Statut')), P = lettre_(e.indexOf('Présent'));
  const zone = feuille.getRange(2, 1, Math.max(feuille.getMaxRows() - 1, 1), e.length);
  const regle = (formule, fond, texte) => SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formule).setBackground(fond).setFontColor(texte).setRanges([zone]).build();
  feuille.setConditionalFormatRules([
    regle('=$' + P + '2<>""', '#D9F2D9', '#0B3D0B'),
    regle('=$' + L + '2="Annulé"', '#E6E6E6', '#7B7B7B'),
    regle('=$' + L + '2="Confirmé"', '#FFF1CC', '#5A3A00')
  ]);
  for (let i = 1; i <= e.length; i++) feuille.setColumnWidth(i, 130);
}

function entetes_(type) {
  return ['Date', 'Code']
    .concat(FORMULAIRES[type].colonnes.map(c => c[0]))
    .concat(['Statut'])
    .concat(type === 'masterclass' ? ['Motif'] : [])
    .concat(CONFIG.JOURS_RAPPELS.map(n => 'Rappel J-' + n))
    .concat(['Présent']);
}

function lettre_(i) { return String.fromCharCode(65 + i); }
function lettres_(type) {
  const o = {};
  entetes_(type).forEach((titre, i) => { o[titre] = lettre_(i); });
  return o;
}

/** Page de synthèse : se met à jour toute seule (formules). */
function tableauDeBord_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let d = ss.getSheetByName(ONGLET_BORD);
  if (!d) d = ss.insertSheet(ONGLET_BORD, 0);
  const cc = lettres_('cineconcert'), mc = lettres_('masterclass');
  const A = "'" + FORMULAIRES.cineconcert.onglet + "'!", M = "'" + FORMULAIRES.masterclass.onglet + "'!";
  const col = (pre, c) => pre + c + '2:' + c;
  const lignes = [
    ['BOMLAAH · TABLEAU DE BORD', ''],
    ['', ''],
    ['CINÉ-CONCERT', ''],
    ['Réservations', '=COUNTA(' + col(A, cc['Code']) + ')'],
    ['Places réservées (hors annulations)', '=SUM(' + col(A, cc['Places']) + ')-SUMIF(' + col(A, cc['Statut']) + ',"Annulé",' + col(A, cc['Places']) + ')'],
    ['Ont confirmé « je viens »', '=COUNTIF(' + col(A, cc['Statut']) + ',"Confirmé")'],
    ['Annulations', '=COUNTIF(' + col(A, cc['Statut']) + ',"Annulé")'],
    ['Entrés (scan à l\'accueil)', '=COUNTIF(' + col(A, cc['Présent']) + ',"Oui*")'],
    ['', ''],
    ['MASTERCLASS', ''],
    ['Candidatures', '=COUNTA(' + col(M, mc['Code']) + ')'],
    ['Retenus', '=COUNTIF(' + col(M, mc['Statut']) + ',"Retenu")'],
    ['Entrés (scan à l\'accueil)', '=COUNTIF(' + col(M, mc['Présent']) + ',"Oui*")']
  ];
  d.getRange(1, 1, lignes.length, 2).clearContent();
  lignes.forEach((l, i) => {
    d.getRange(i + 1, 1).setValue(l[0]);
    if (l[1]) poserFormule_(d.getRange(i + 1, 2), l[1]);
  });
  try {
    d.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    [3, 10].forEach(r => d.getRange(r, 1, 1, 2).setFontWeight('bold').setBackground('#101018').setFontColor('#FFB347'));
    d.getRange(4, 2, lignes.length, 1).setFontWeight('bold').setHorizontalAlignment('right');
    d.setColumnWidth(1, 330); d.setColumnWidth(2, 110);
  } catch (err) { console.warn(err); }
}

/** Pose une formule ; si le Sheet est en français (séparateur « ; »), on réessaie avec des points-virgules. */
function poserFormule_(cellule, formule) {
  cellule.setFormula(formule);
  try {
    SpreadsheetApp.flush();
    const v = String(cellule.getDisplayValue());
    if (v.indexOf('#ERROR') === 0 || v.indexOf('#NAME') === 0 || v.indexOf('Err') === 0) cellule.setFormula(formule.replace(/,/g, ';'));
  } catch (e) { /* hors Sheet (tests) : rien à faire */ }
}

function table_(feuille) {
  const valeurs = feuille.getDataRange().getValues();
  const col = {};
  (valeurs[0] || []).forEach((h, i) => { col[h] = i; });
  return { valeurs: valeurs, col: col };
}

/* ============================ Outils ============================ */

function joursAvant_(date) {
  const aujourdhui = Utilities.formatDate(date, CONFIG.FUSEAU, 'yyyy-MM-dd').split('-').map(Number);
  const cible = CONFIG.DATE_EVENEMENT.split('-').map(Number);
  return Math.round((Date.UTC(cible[0], cible[1] - 1, cible[2]) - Date.UTC(aujourdhui[0], aujourdhui[1] - 1, aujourdhui[2])) / 86400000);
}

function genererCode_(prefixe, existants) {
  let code;
  do {
    let s = '';
    for (let i = 0; i < 6; i++) s += ALPHABET_CODE.charAt(Math.floor(Math.random() * ALPHABET_CODE.length));
    code = prefixe + '-' + s;
  } while (existants.indexOf(code) !== -1);
  return code;
}

function lienAction_(code, reponse) {
  return CONFIG.URL_SITE + 'valider/?a=' + reponse + '&code=' + encodeURIComponent(code);
}

function envoyer_(a, sujet, texte, html) {
  const options = { to: a, subject: sujet, body: texte, htmlBody: html, name: CONFIG.NOM_EXPEDITEUR };
  if (CONFIG.REPONDRE_A) options.replyTo = CONFIG.REPONDRE_A;
  MailApp.sendEmail(options);
}

function texte_(v) { return String(v == null ? '' : v).trim().slice(0, 2000); }
function h_(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function reponse_(o, rappel) {   // JSONP : permet au site de lire la réponse sans blocage du navigateur
  const txt = JSON.stringify(o);
  if (rappel && /^[A-Za-z_$][\w$.]{0,40}$/.test(String(rappel))) {
    return ContentService.createTextOutput(rappel + '(' + txt + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(o);
}
function alerte_(m) { try { SpreadsheetApp.getUi().alert(m); } catch (e) { console.log(m); } }

function tableau_(lignes) {
  return '<table style="border-collapse:collapse;width:100%;margin:12px 0">' + lignes.map(l =>
    '<tr><td style="padding:6px 12px 6px 0;color:#555;width:34%;vertical-align:top">' + h_(l[0]) + '</td><td style="padding:6px 0;vertical-align:top">' + l[1] + '</td></tr>').join('') + '</table>';
}

function bouton_(url, libelle, secondaire) {
  const style = secondaire ? 'background:#EDE6F5;color:#000' : 'background:#FFB347;color:#000';
  return '<a href="' + h_(url) + '" style="display:inline-block;' + style + ';padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold;margin:4px 4px 4px 0">' + h_(libelle) + '</a>';
}

function gabarit_(titre, corps) {
  return '<div style="background:#F2F2F2;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111">' +
    '<div style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#101018;color:#fff;padding:20px 24px;font-size:20px;font-weight:bold">BOMLAAH</div>' +
    '<div style="padding:24px;line-height:1.6;font-size:15px"><h2 style="margin:0 0 12px;font-size:20px">' + h_(titre) + '</h2>' + corps + '</div>' +
    '<div style="padding:14px 24px;background:#EDE6F5;font-size:12px;color:#555">MYLL Production · en coproduction avec YELAM’S Créative · Abidjan, Côte d\'Ivoire</div></div></div>';
}

function page_(titre, corps) {
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + h_(titre) + '</title></head>' +
    '<body style="margin:0">' + gabarit_(titre, corps) + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('BOMLAAH').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
