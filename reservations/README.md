# Réservations BOMLAAH — mise en route (15 min, gratuit)

Un seul compte Google suffit. Tout se passe dans un Google Sheet :
- chaque réservation arrive dans le Sheet (la « base de données » + la liste des invités) ;
- un e-mail de confirmation avec le billet QR part au client, et l'équipe reçoit une alerte ;
- un rappel automatique part à J-5 (« confirmez votre venue ») et à J-1 ;
- le jour J, l'**application organisateurs** (`organisateurs/`) lit les QR codes avec la caméra du téléphone (vert / orange / rouge), affiche la liste de tous les inscrits avec leurs données, et suit les places du ciné-concert et de chaque masterclass.

## 1. Créer le Sheet et coller le code
1. Ouvrir <https://sheets.new> avec le compte Google de l'événement. Le nommer « BOMLAAH — Réservations ».
2. Menu **Extensions → Apps Script**.
3. Remplacer le contenu de `Code.gs` par celui de [`Code.gs`](Code.gs).
4. Roue dentée **Paramètres du projet** → cocher « Afficher le fichier manifeste appsscript.json », puis remplacer son contenu par [`appsscript.json`](appsscript.json).
5. En haut de `Code.gs`, dans `CONFIG`, renseigner :
   - `EMAIL_EQUIPE` : les adresses qui reçoivent les alertes (séparées par des virgules) ;
   - `CLE_ACCUEIL` : un mot de passe long choisi par vous (donné uniquement à l'équipe d'accueil).
   Ne publiez pas ces deux valeurs dans le dépôt GitHub.
6. Enregistrer (Ctrl+S).

## 2. Préparer le Sheet
Recharger le Sheet : un menu **BOMLAAH** apparaît. Lancer dans l'ordre :
1. **1 · Préparer les onglets** (accepter les autorisations Google la première fois) ;
2. **2 · E-mail de test** pour vérifier la réception ;
3. **3 · Activer les rappels** (déclenchement quotidien à 9 h, heure d'Abidjan).

## 3. Publier l'API
1. Dans Apps Script : **Déployer → Nouveau déploiement → Application Web**.
2. *Exécuter en tant que* : **Moi** ; *Qui a accès* : **Tout le monde**.
3. Copier l'URL se terminant par `/exec`.
4. La coller dans [`../config.js`](../config.js) : `window.ASYM_API = 'https://script.google.com/macros/s/…/exec';`
5. Publier le site (GitHub Pages). Tant que `ASYM_API` est vide, le site garde l'envoi WhatsApp.

Après toute modification de `Code.gs` : **Déployer → Gérer les déploiements → ✏️ → Nouvelle version**. L'URL ne change pas.

## 4. Deux espaces cachés : organisateurs et scan
Menu **BOMLAAH** du Sheet : « Lien de l'espace organisateurs » et « Lien de l'espace scan ». Chaque lien contient une clé après `#` (qui disparaît de la barre d'adresse une fois la page ouverte). Sans le lien, la page demande la clé. Les deux espaces ne sont liés depuis aucune page du site et ne sont pas indexés ; avec un nom de domaine, ils s'ouvrent sur des sous-domaines cachés (voir `DOMAINE.md`).

**Espace scan** (`scan/`, clé `CLE_ACCUEIL`, pour l'équipe d'accueil) : la caméra lit le QR du billet. Écran **vert** = entrée validée (nom, type, places, masterclass), **orange** = déjà scanné (l'heure s'affiche), **rouge** = annulé, non retenu ou inconnu. Le code peut aussi être saisi à la main. La page doit être en https (c'est le cas sur GitHub Pages et Vercel). Cette clé ne donne accès à aucune donnée personnelle.

**Espace organisateurs** (`organisateurs/`, clé `CLE_ADMIN`) : trois onglets.
- **Scanner** : comme l'espace scan.
- **Inscrits** : ciné-concert ou masterclass, avec recherche (nom, e-mail, téléphone, code) et filtres. Un appui sur une personne affiche toutes ses données et permet de valider ou annuler son entrée, de l'appeler ou de lui écrire. Un bouton exporte la liste en CSV.
- **Places** : places réservées du ciné-concert (et restantes si `PLACES_CINECONCERT` est renseigné) ; pour chaque masterclass, candidatures, retenus sur 12 places, places libres et entrés. La page se rafraîchit toute seule.

## Masterclass : candidature, décision, billet
1. La personne **postule** depuis le site (étudiante ou professionnelle) : statut **Candidature**, elle reçoit un e-mail d'accusé de réception avec son code.
2. Dans l'espace organisateurs, onglet **Inscrits → Masterclass**, l'administrateur ouvre la candidature et choisit :
   - **Accepter** : statut **Retenu**. Le candidat reçoit par e-mail son **billet QR** (même principe que le ciné-concert), avec un message facultatif de l'équipe. Si la masterclass est déjà pleine (12 retenus), une confirmation est demandée.
   - **Refuser** : le **motif est obligatoire**. Il est enregistré dans la colonne *Motif* du Sheet et envoyé par e-mail au candidat.
3. Le jour J, seuls les candidats **Retenus** passent au scan. Les autres s'affichent en rouge « non retenu ».

## Bon à savoir
- **Limite d'envoi** : un compte Gmail gratuit envoie environ 100 e-mails par jour (1 500 avec Google Workspace). Pour ~700 inscrits, les rappels doivent être étalés sur plusieurs jours, ou envoyés depuis un compte Workspace.
- Un client peut annuler depuis le lien de son e-mail ; sa place est libérée.
- Le billet n'affiche publiquement que le prénom, l'initiale du nom et le nombre de places.
- Les codes sont générés dans le navigateur (`CC-XXXXXX` / `MC-XXXXXX`), donc le QR s'affiche instantanément, même avec un réseau lent.
