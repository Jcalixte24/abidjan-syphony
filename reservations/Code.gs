/**
 * ABIDJAN SYMPHONY — Réservations (Google Sheet + e-mails + billet QR + accueil)
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
  CLE_ACCUEIL: '',                        // mot de passe de la page de scan à l'entrée (inventez-en un, 12 caractères ou plus)
  URL_SITE: 'https://jcalixte24.github.io/abidjan-syphony/',   // adresse du site (avec « / » à la fin)
  NOM_EXPEDITEUR: 'BOMLAAH',
  REPONDRE_A: '',                         // optionnel : adresse qui reçoit les réponses des inscrits
  DATE_EVENEMENT: '2026-11-13',           // AAAA-MM-JJ
  DATE_AFFICHEE: 'vendredi 13 novembre 2026',
  LIEU: 'YELAM’S, Abidjan',
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
    colonnes: [['Prénom', 'prenom'], ['Nom', 'nom'], ['E-mail', 'email'], ['Téléphone', 'telephone'], ['Places', 'places'], ['Profil', 'profil']],
    requis: ['prenom', 'nom', 'email', 'telephone', 'places', 'profil']
  },
  masterclass: {
    onglet: 'Masterclass',
    prefixe: 'MC',
    colonnes: [['Prénom', 'prenom'], ['Nom', 'nom'], ['E-mail', 'email'], ['Téléphone', 'telephone'], ['Établissement', 'etablissement'], ['Filière et niveau', 'niveau'], ['Thématique', 'thematique'], ['Motivation', 'motivation']],
    requis: ['prenom', 'nom', 'email', 'telephone', 'etablissement', 'niveau', 'thematique']
  }
};
const ONGLET_BORD = 'Tableau de bord';

// Statut de départ. Pour les masterclass, l'équipe passe la ligne à « Retenu » après sélection :
// seuls les statuts de STATUTS_RAPPEL reçoivent des rappels et peuvent entrer.
const STATUT_INITIAL = { cineconcert: 'Inscrit', masterclass: 'Candidature' };
const STATUTS_RAPPEL = ['Inscrit', 'Confirmé', 'Retenu'];
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* ============================ Réception du formulaire ============================ */

function doPost(e) {
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
    const p = (e && e.parameter) || {};
    if (p._gotcha) return json_({ ok: true });                       // robot : on ignore en silence
    const type = p.formulaire === 'masterclass' ? 'masterclass' : 'cineconcert';
    const erreur = valider_(type, p);
    if (erreur) return json_({ ok: false, erreur: erreur });

    const f = FORMULAIRES[type];
    const feuille = feuille_(type);
    const t = table_(feuille);

    // Même personne qui valide deux fois : on renvoie le code existant, sans doublon ni nouvel e-mail.
    const email = texte_(p.email).toLowerCase();
    const cleDoublon = f.colonnes.map(c => texte_(p[c[1]]).toLowerCase()).join('|');
    const existante = t.valeurs.slice(1).find(l => String(l[t.col['E-mail']]).toLowerCase() === email &&
      f.colonnes.map(c => String(l[t.col[c[0]]]).toLowerCase()).join('|') === cleDoublon);
    if (existante) return json_({ ok: true, code: existante[t.col['Code']], doublon: true });

    // Le site fabrique le code (pour afficher le QR tout de suite) ; on le garde s'il est valide et libre.
    const codes = t.valeurs.slice(1).map(l => String(l[t.col['Code']]));
    let code = texte_(p.code).toUpperCase();
    const formeOk = new RegExp('^' + f.prefixe + '-[' + ALPHABET_CODE + ']{6}$').test(code);
    if (!formeOk || codes.indexOf(code) !== -1) code = genererCode_(f.prefixe, codes);

    const ligne = [new Date(), code]
      .concat(f.colonnes.map(c => c[1] === 'places' ? Number(p.places) : texte_(p[c[1]])))
      .concat([STATUT_INITIAL[type]])
      .concat(CONFIG.JOURS_RAPPELS.map(() => ''))
      .concat(['']);
    feuille.appendRow(ligne);

    envoyerConfirmation_(type, p, code);
    notifierEquipe_(type, p, code, feuille);
    return json_({ ok: true, code: code });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erreur: 'Erreur serveur' });
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
  if (texte_(p.telephone).replace(/\D/g, '').length < 8) return 'Téléphone invalide';
  if (type === 'cineconcert') {
    const n = Number(p.places);
    if (!(n >= 1 && n <= 4) || n % 1 !== 0) return 'Nombre de places invalide';
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
    sujet = 'Votre billet · BOMLAAH';
    intro = 'Votre réservation pour le ciné-concert est enregistrée (' + n + ' place' + (n > 1 ? 's' : '') + '). Votre billet est un QR code : présentez-le à l\'entrée, sur votre téléphone ou imprimé.';
    bouton = '<p>' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)') + '</p>';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nMon billet : ' + lienBillet_(code) + '\nCode : ' + code + '\nDate : ' + CONFIG.DATE_AFFICHEE + '\nLieu : ' + CONFIG.LIEU + '\n\nÀ bientôt,\nBOMLAAH';
  } else {
    lignes.push(['Thématique', h_(texte_(p.thematique))]);
    sujet = 'Votre candidature · BOMLAAH';
    intro = 'Nous avons bien reçu votre candidature aux masterclass. Les groupes sont limités à douze étudiants : vous recevrez une réponse par e-mail.';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nCode : ' + code + '\nThématique : ' + texte_(p.thematique) + '\n\nÀ bientôt,\nBOMLAAH';
  }
  const html = gabarit_('Merci ' + prenom, '<p>' + h_(intro) + '</p>' + tableau_(lignes) + bouton +
    '<p style="color:#555;font-size:13px">Pensez à vérifier vos courriers indésirables si vous ne retrouvez pas nos messages.</p>');
  envoyer_(texte_(p.email), sujet, texte, html);
}

function notifierEquipe_(type, p, code, feuille) {
  if (!CONFIG.EMAIL_EQUIPE) return;
  const tot = totaux_(type, feuille);
  const nom = texte_(p.prenom) + ' ' + texte_(p.nom);
  let sujet, lignes;
  if (type === 'cineconcert') {
    sujet = 'Nouvelle réservation ciné-concert · ' + nom + ', ' + Number(p.places) + ' place(s) · total ' + tot.places;
    lignes = [['Nom', h_(nom)], ['E-mail', h_(texte_(p.email))], ['Téléphone', h_(texte_(p.telephone))], ['Places', String(Number(p.places))], ['Profil', h_(texte_(p.profil))], ['Code', h_(code)]];
  } else {
    sujet = 'Nouvelle candidature masterclass · ' + nom + ' · ' + tot.inscriptions + ' candidature(s)';
    lignes = [['Nom', h_(nom)], ['E-mail', h_(texte_(p.email))], ['Téléphone', h_(texte_(p.telephone))], ['Établissement', h_(texte_(p.etablissement))], ['Filière', h_(texte_(p.niveau))], ['Thématique', h_(texte_(p.thematique))], ['Motivation', h_(texte_(p.motivation))], ['Code', h_(code)]];
  }
  const total = type === 'cineconcert'
    ? tot.inscriptions + ' réservation(s), ' + tot.places + ' place(s) au total'
    : tot.inscriptions + ' candidature(s) au total';
  const lien = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const html = gabarit_('Nouvelle inscription', tableau_(lignes) +
    '<p><b>Total à jour :</b> ' + h_(total) + '</p>' + bouton_(lien, 'Ouvrir la liste (Google Sheet)'));
  const texte = sujet + '\n\n' + lignes.map(l => l[0] + ' : ' + l[1].replace(/<[^>]+>/g, '')).join('\n') + '\n\nTotal : ' + total + '\n' + lien;
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
  else lignes.push(['Thématique', h_(String(l[t.col['Thématique']]))]);

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
  if (a === 'oui' || a === 'non') return presence_(p);               // liens des e-mails (page HTML)
  if (a === 'billet') return reponse_(billet_(p.c), p.callback);      // page « billet » du site (JSONP)
  if (a === 'checkin') return reponse_(checkin_(p.c, p.k), p.callback); // page « accueil » du site (JSONP)
  if (a === 'stats') return reponse_(stats_(p.k), p.callback);
  return page_('BOMLAAH', '<p>Ce lien n\'est pas valide.</p>');
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
  if (!CONFIG.CLE_ACCUEIL || String(cle || '') !== CONFIG.CLE_ACCUEIL) return { ok: false, etat: 'refuse' };
  const c = String(code || '').trim().toUpperCase();
  if (!/^(CC|MC)-[A-Z0-9]{6}$/.test(c)) return { ok: false, etat: 'inconnu' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = trouverParCode_(c);
    if (!f) return { ok: false, etat: 'inconnu' };
    const t = f.t, l = f.ligne, statut = String(l[t.col['Statut']]);
    const info = { prenom: String(l[t.col['Prénom']]), nom: String(l[t.col['Nom']]), places: f.type === 'cineconcert' ? Number(l[t.col['Places']]) || 1 : 0, type: f.type, code: c };
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
  if (!CONFIG.CLE_ACCUEIL || String(cle || '') !== CONFIG.CLE_ACCUEIL) return { ok: false, etat: 'refuse' };
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
  return { reservations: reservations, placesTotal: placesTotal, presents: presents, placesPresentes: placesPresentes };
}

/** Lien « Je viens / Je ne viens pas » d'un e-mail de rappel. */
function presence_(p) {
  const rep = p.a === 'non' ? 'non' : 'oui';
  if (!p.c) return page_('Lien incomplet', '<p>Ce lien est incomplet. Répondez directement à notre e-mail.</p>');
  const trouve = trouverParCode_(String(p.c).trim().toUpperCase());
  if (!trouve) return page_('Code introuvable', '<p>Nous ne retrouvons pas cette réservation. Répondez directement à notre e-mail.</p>');
  const statut = trouve.ligne[trouve.t.col['Statut']];
  if (['Inscrit', 'Confirmé', 'Retenu', 'Annulé'].indexOf(statut) === -1) {
    return page_('Dossier en cours', '<p>Votre dossier est en cours d\'étude. Nous vous écrirons très bientôt.</p>');
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
    ? page_('Merci, à bientôt', '<p>Votre présence est confirmée pour le ' + h_(CONFIG.DATE_AFFICHEE) + ' à ' + h_(CONFIG.LIEU) + '.</p><p>Votre billet : ' + bouton_(lienBillet_(code), 'Voir mon billet (QR code)') + '</p>')
    : page_('C\'est noté', '<p>Merci de nous avoir prévenus : votre place est libérée.</p>');
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
  alerte_('Page d\'accueil à ouvrir sur le téléphone de l\'équipe (ne la partagez qu\'au personnel) :\n\n' + CONFIG.URL_SITE + 'scan/#k=' + CONFIG.CLE_ACCUEIL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BOMLAAH')
    .addItem('1. Préparer les onglets', 'preparerFeuilles')
    .addItem('2. Envoyer un e-mail de test', 'emailDeTest')
    .addItem('3. Activer les rappels automatiques', 'installerDeclencheurs')
    .addSeparator()
    .addItem('Lien de la page d\'accueil (scan)', 'lienAccueil')
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
    ['ABIDJAN SYMPHONY · TABLEAU DE BORD', ''],
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
    if (l[1]) d.getRange(i + 1, 2).setFormula(l[1]);
  });
  try {
    d.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    [3, 10].forEach(r => d.getRange(r, 1, 1, 2).setFontWeight('bold').setBackground('#101018').setFontColor('#FFB347'));
    d.getRange(4, 2, lignes.length, 1).setFontWeight('bold').setHorizontalAlignment('right');
    d.setColumnWidth(1, 330); d.setColumnWidth(2, 110);
  } catch (err) { console.warn(err); }
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
  const url = ScriptApp.getService().getUrl();
  return url ? url + '?a=' + reponse + '&c=' + encodeURIComponent(code) : '';
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
    '<div style="padding:14px 24px;background:#EDE6F5;font-size:12px;color:#555">MYLL Productions · en coproduction avec le YELAM’S · Abidjan, Côte d\'Ivoire</div></div></div>';
}

function page_(titre, corps) {
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + h_(titre) + '</title></head>' +
    '<body style="margin:0">' + gabarit_(titre, corps) + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('BOMLAAH').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
