# Réservations Abidjan Symphony → Google Sheet + e-mails

Ce dossier contient le script (`Code.gs`) qui relie le site à un Google Sheet.
Une fois installé, à chaque réservation :

1. la ligne est **enregistrée dans le Google Sheet** (un onglet « Ciné-concert », un onglet « Masterclass »)
2. la personne reçoit un **e-mail de confirmation** avec son **code de réservation** (ex. `CC-7K4M9Q`)
3. l'équipe reçoit une **alerte e-mail** avec les totaux à jour (réservations et places)
4. des **rappels automatiques** partent à **J-5** et **J-1**, avec deux boutons : « Oui, je viens » / « Je ne pourrai pas venir »
   (la réponse met à jour la colonne **Statut** du Sheet, et l'équipe est prévenue en cas d'annulation)

Durée : environ 15 minutes, une seule fois. Il faut un compte Google (Gmail ou Google Workspace).

## Installation

**1. Créer le Sheet.** Sur [sheets.google.com](https://sheets.google.com), créer une feuille vierge nommée « Abidjan Symphony · Réservations ».

**2. Ouvrir le script.** Dans le Sheet : menu **Extensions → Apps Script**.

**3. Coller le code.**
- Remplacer tout le contenu de `Code.gs` par celui du fichier `Code.gs` de ce dossier.
- À gauche, **Paramètres du projet** (roue dentée) → cocher **Afficher le fichier « appsscript.json »**, puis revenir à l'éditeur, ouvrir `appsscript.json` et remplacer son contenu par celui du fichier `appsscript.json` de ce dossier.

**4. Renseigner l'adresse de l'équipe.** En haut de `Code.gs`, dans `CONFIG` :
- `EMAIL_EQUIPE` : l'adresse qui reçoit les alertes (obligatoire)
- `REPONDRE_A` : optionnel, l'adresse qui reçoit les réponses des inscrits
- `HORAIRES` : optionnel, ex. `'Masterclass dès 9h · Ciné-concert à 19h'` (affiché dans les e-mails)

Cliquer sur l'icône de sauvegarde.

**5. Préparer les onglets.** Recharger le Sheet : un menu **Abidjan Symphony** apparaît. Cliquer **1. Préparer les onglets**, puis **2. Envoyer un e-mail de test**. Google demande une autorisation (« Avancé → Accéder à… ») : c'est normal, c'est votre propre script.

**6. Publier.** Dans Apps Script : **Déployer → Nouveau déploiement → ⚙ Application Web**
- Exécuter en tant que : **Moi**
- Qui a accès : **Tout le monde**
- Cliquer **Déployer** et **copier l'URL** qui finit par `/exec`.

**7. Brancher le site.** Dans `index.html`, coller cette URL ici :

```js
const RESERVATIONS_URL = 'https://script.google.com/macros/s/…/exec';
```

**8. Activer les rappels.** Dans le Sheet : menu **Abidjan Symphony → 3. Activer les rappels automatiques** (à faire une seule fois).

**9. Tester.** Faire une réservation sur le site avec votre propre e-mail : la ligne doit apparaître dans le Sheet, et les deux e-mails (confirmation + alerte) partir dans la minute.

## Au quotidien

| Colonne | Rôle |
|---|---|
| **Code** | Présenté à l'entrée par la personne |
| **Statut** | `Inscrit` → `Confirmé` (après rappel) ou `Annulé`. Modifiable à la main |
| **Rappel J-5 / J-1** | Date d'envoi, pour ne jamais envoyer deux fois |
| **Présent** | À remplir à l'entrée (par exemple `oui`) |

**Masterclass.** Les candidatures arrivent au statut `Candidature` et **ne reçoivent pas de rappel**. Quand vous retenez quelqu'un, changez son statut en **`Retenu`** : il recevra alors les rappels.

**Changer la date ou les rappels.** Modifier `DATE_EVENEMENT`, `DATE_AFFICHEE` et `JOURS_RAPPELS` en haut du script.

**Après toute modification du code.** Il faut republier : **Déployer → Gérer les déploiements → ✏ → Version : Nouvelle version → Déployer**. L'URL ne change pas.

## Limites à connaître

- **Quota d'e-mails de Google** : environ **100 e-mails par jour** avec un Gmail gratuit, 1 500 avec Google Workspace. Au-delà, les rappels s'arrêtent et reprennent le lendemain. Une réservation = 2 e-mails (confirmation + alerte), un rappel = 1 e-mail.
- **Le site ne peut pas lire la réponse de Google.** Si le script plante, la personne voit quand même « Réservation enregistrée ». Vérifiez régulièrement que le Sheet se remplit, surtout les premiers jours.
- **Pas de limite de places** : le script n'arrête pas les réservations quand la salle est pleine. Surveillez le total dans l'alerte e-mail.
- **Pas de SMS ni de WhatsApp automatique** : uniquement des e-mails. Le QR code d'entrée n'est pas inclus : le code de réservation (`CC-…`) sert de justificatif.
- **Données personnelles** : le Sheet contient noms, e-mails et téléphones. Ne le partagez qu'avec l'équipe, et seulement en lecture si possible.
