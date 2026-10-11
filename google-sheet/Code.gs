/**
 * ABIDJAN SYMPHONY — Réservations
 * Reçoit les formulaires du site, les enregistre dans ce Google Sheet et envoie les e-mails :
 *   - confirmation à la personne inscrite (avec son code de réservation)
 *   - alerte à l'équipe à chaque nouvelle inscription (avec les totaux à jour)
 *   - rappels automatiques avant l'événement, avec un lien « Je viens / Je ne viens pas »
 *
 * Mode d'emploi complet : voir README.md.
 */

// ========================= À MODIFIER =========================
const CONFIG = {
  EMAIL_EQUIPE: '',                       // reçoit une alerte à chaque nouvelle inscription (obligatoire)
  NOM_EXPEDITEUR: 'Abidjan Symphony',
  REPONDRE_A: '',                         // optionnel : adresse qui reçoit les réponses des inscrits
  DATE_EVENEMENT: '2026-11-13',           // AAAA-MM-JJ
  DATE_AFFICHEE: 'vendredi 13 novembre 2026',
  LIEU: 'YELAMS, Abidjan',
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

// Statut de départ. Pour les masterclass, l'équipe passe la ligne à « Retenu » après sélection :
// seuls les statuts de STATUTS_RAPPEL reçoivent des rappels.
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

    const codes = t.valeurs.slice(1).map(l => l[t.col['Code']]);
    const code = genererCode_(f.prefixe, codes);
    const ligne = [new Date(), code]
      .concat(f.colonnes.map(c => texte_(p[c[1]])))
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

function envoyerConfirmation_(type, p, code) {
  const prenom = texte_(p.prenom);
  const lignes = [['Code', '<b>' + h_(code) + '</b>'], ['Date', h_(CONFIG.DATE_AFFICHEE)], ['Lieu', h_(CONFIG.LIEU)]];
  if (CONFIG.HORAIRES) lignes.push(['Horaires', h_(CONFIG.HORAIRES)]);
  let sujet, intro, texte;
  if (type === 'cineconcert') {
    const n = Number(p.places);
    lignes.push(['Places', String(n)]);
    sujet = 'Votre réservation · Abidjan Symphony';
    intro = 'Votre réservation pour le ciné-concert est enregistrée (' + n + ' place' + (n > 1 ? 's' : '') + '). Conservez ce code : il vous sera demandé à l\'entrée.';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nCode : ' + code + '\nDate : ' + CONFIG.DATE_AFFICHEE + '\nLieu : ' + CONFIG.LIEU + '\n\nÀ bientôt,\nAbidjan Symphony';
  } else {
    lignes.push(['Thématique', h_(texte_(p.thematique))]);
    sujet = 'Votre candidature · Abidjan Symphony';
    intro = 'Nous avons bien reçu votre candidature aux masterclass. Les groupes sont limités à douze étudiants : vous recevrez une réponse par e-mail.';
    texte = 'Bonjour ' + prenom + ',\n\n' + intro + '\n\nCode : ' + code + '\nThématique : ' + texte_(p.thematique) + '\n\nÀ bientôt,\nAbidjan Symphony';
  }
  const html = gabarit_('Merci ' + prenom, '<p>' + h_(intro) + '</p>' + tableau_(lignes) +
    '<p style="color:#6A5446;font-size:13px">Pensez à vérifier vos courriers indésirables si vous ne retrouvez pas nos messages.</p>');
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
    '<p><b>Total à jour :</b> ' + h_(total) + '</p>' + bouton_(lien, 'Ouvrir le Google Sheet'));
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
      if (MailApp.getRemainingDailyQuota() < 1) { console.warn('Quota e-mail du jour atteint'); return; }

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
  const html = gabarit_(quand + ' · Abidjan Symphony',
    '<p>Bonjour ' + h_(prenom) + ', nous avons hâte de vous accueillir. Merci de nous confirmer votre présence.</p>' + tableau_(lignes) + boutons +
    '<p style="color:#6A5446;font-size:13px">Présentez votre code à l\'entrée.</p>');
  const texte = 'Bonjour ' + prenom + ',\n\n' + quand + ' : ' + CONFIG.DATE_AFFICHEE + ', ' + CONFIG.LIEU + '.\nCode : ' + code +
    (oui ? '\n\nJe viens : ' + oui + '\nJe ne pourrai pas venir : ' + non : '') + '\n\nAbidjan Symphony';
  envoyer_(String(l[t.col['E-mail']]), quand + ' · Abidjan Symphony', texte, html);
}

/* ============================ Confirmation de présence (liens des rappels) ============================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const rep = p.a === 'oui' || p.a === 'non' ? p.a : '';
  if (!rep || !p.c) return page_('Lien incomplet', '<p>Ce lien est incomplet. Répondez directement à notre e-mail.</p>');
  const trouve = trouverParCode_(String(p.c).trim().toUpperCase());
  if (!trouve) return page_('Code introuvable', '<p>Nous ne retrouvons pas cette réservation. Répondez directement à notre e-mail.</p>');
  const statut = trouve.ligne[trouve.t.col['Statut']];
  if (['Inscrit', 'Confirmé', 'Retenu', 'Annulé'].indexOf(statut) === -1) {
    return page_('Dossier en cours', '<p>Votre dossier est en cours d\'étude. Nous vous écrirons très bientôt.</p>');
  }
  const nouveau = rep === 'oui' ? 'Confirmé' : 'Annulé';
  trouve.feuille.getRange(trouve.numero, trouve.t.col['Statut'] + 1).setValue(nouveau);
  if (rep === 'non' && CONFIG.EMAIL_EQUIPE) {
    const nom = trouve.ligne[trouve.t.col['Prénom']] + ' ' + trouve.ligne[trouve.t.col['Nom']];
    envoyer_(CONFIG.EMAIL_EQUIPE, 'Annulation · ' + nom + ' (' + trouve.ligne[trouve.t.col['Code']] + ')',
      nom + ' ne pourra pas venir (code ' + trouve.ligne[trouve.t.col['Code']] + '). La ligne est passée au statut « Annulé ».',
      gabarit_('Annulation', '<p>' + h_(nom) + ' ne pourra pas venir (code ' + h_(trouve.ligne[trouve.t.col['Code']]) + ').</p><p>La ligne est passée au statut « Annulé ».</p>'));
  }
  return rep === 'oui'
    ? page_('Merci, à bientôt', '<p>Votre présence est confirmée pour le ' + h_(CONFIG.DATE_AFFICHEE) + ' à ' + h_(CONFIG.LIEU) + '. Présentez votre code <b>' + h_(trouve.ligne[trouve.t.col['Code']]) + '</b> à l\'entrée.</p>')
    : page_('C\'est noté', '<p>Merci de nous avoir prévenus : votre place est libérée.</p>');
}

function trouverParCode_(code) {
  const types = Object.keys(FORMULAIRES);
  for (let i = 0; i < types.length; i++) {
    const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMULAIRES[types[i]].onglet);
    if (!feuille || feuille.getLastRow() < 2) continue;
    const t = table_(feuille);
    for (let r = 1; r < t.valeurs.length; r++) {
      if (String(t.valeurs[r][t.col['Code']]).toUpperCase() === code) return { feuille: feuille, t: t, ligne: t.valeurs[r], numero: r + 1 };
    }
  }
  return null;
}

/* ============================ Installation ============================ */

function preparerFeuilles() {
  Object.keys(FORMULAIRES).forEach(feuille_);
  alerte_('Les onglets « Ciné-concert » et « Masterclass » sont prêts.');
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
  envoyer_(CONFIG.EMAIL_EQUIPE, 'Test · Abidjan Symphony', 'Les e-mails fonctionnent.', gabarit_('Test réussi', '<p>Les e-mails fonctionnent.</p>'));
  alerte_('E-mail de test envoyé à ' + CONFIG.EMAIL_EQUIPE);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Abidjan Symphony')
    .addItem('1. Préparer les onglets', 'preparerFeuilles')
    .addItem('2. Envoyer un e-mail de test', 'emailDeTest')
    .addItem('3. Activer les rappels automatiques', 'installerDeclencheurs')
    .addSeparator()
    .addItem('Envoyer les rappels maintenant', 'rappelsMaintenant')
    .addToUi();
}

/* ============================ Outils ============================ */

function feuille_(type) {
  const f = FORMULAIRES[type];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(f.onglet);
  if (!feuille) feuille = ss.insertSheet(f.onglet);
  if (feuille.getLastRow() === 0) {
    const e = entetes_(type);
    feuille.getRange(1, 1, 1, e.length).setValues([e]).setFontWeight('bold').setBackground('#2B1A11').setFontColor('#F2CFA0');
    feuille.setFrozenRows(1);
    const n = Math.max(feuille.getMaxRows() - 1, 1);
    feuille.getRange(2, 1, n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    feuille.getRange(2, 2, n, e.length - 1).setNumberFormat('@');   // texte brut : aucune formule ne peut s'exécuter
  }
  return feuille;
}

function entetes_(type) {
  return ['Date', 'Code']
    .concat(FORMULAIRES[type].colonnes.map(c => c[0]))
    .concat(['Statut'])
    .concat(CONFIG.JOURS_RAPPELS.map(n => 'Rappel J-' + n))
    .concat(['Présent']);
}

function table_(feuille) {
  const valeurs = feuille.getDataRange().getValues();
  const col = {};
  (valeurs[0] || []).forEach((h, i) => { col[h] = i; });
  return { valeurs: valeurs, col: col };
}

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
function alerte_(m) { try { SpreadsheetApp.getUi().alert(m); } catch (e) { console.log(m); } }

function tableau_(lignes) {
  return '<table style="border-collapse:collapse;width:100%;margin:12px 0">' + lignes.map(l =>
    '<tr><td style="padding:6px 12px 6px 0;color:#6A5446;width:34%;vertical-align:top">' + h_(l[0]) + '</td><td style="padding:6px 0;vertical-align:top">' + l[1] + '</td></tr>').join('') + '</table>';
}

function bouton_(url, libelle, secondaire) {
  const style = secondaire ? 'background:#F0E4D2;color:#24160E' : 'background:#E0A15A;color:#1E120C';
  return '<a href="' + h_(url) + '" style="display:inline-block;' + style + ';padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold;margin:4px 4px 4px 0">' + h_(libelle) + '</a>';
}

function gabarit_(titre, corps) {
  return '<div style="background:#F7EFE4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#24160E">' +
    '<div style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#1E120C;color:#F2CFA0;padding:20px 24px;font-size:20px;font-weight:bold">Abidjan <i style="color:#E0A15A">Symphony</i></div>' +
    '<div style="padding:24px;line-height:1.6;font-size:15px"><h2 style="margin:0 0 12px;font-size:20px">' + h_(titre) + '</h2>' + corps + '</div>' +
    '<div style="padding:14px 24px;background:#F0E4D2;font-size:12px;color:#6A5446">Myll Production · Abidjan, Côte d\'Ivoire</div></div></div>';
}

function page_(titre, corps) {
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + h_(titre) + '</title></head>' +
    '<body style="margin:0">' + gabarit_(titre, corps) + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Abidjan Symphony').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
