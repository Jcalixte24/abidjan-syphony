# Mettre BOMLAAH sur son nom de domaine

Un seul site, trois adresses :

| Adresse | Contenu | Visible ? |
|---|---|---|
| `mondomaine.com` | le site public (accueil, masterclass, ciné-concert, billet) | oui |
| `admin.mondomaine.com` | espace **organisateurs** : inscrits, places, accepter ou refuser, scan | caché : aucun lien depuis le site, jamais indexé, clé obligatoire |
| `scan.mondomaine.com` | espace **scan** pour l'équipe d'accueil : valider les billets, rien d'autre | caché : idem, avec une clé différente |

Les noms `admin` et `scan` se choisissent librement (`--organisateurs gestion --scan entree`). Plus ils sont inattendus, mieux c'est.

## 1. Acheter le domaine
Chez n'importe quel registrar (Vercel, OVH, Gandi, Namecheap, Google Domains…). Acheter directement chez Vercel est le plus simple : les réglages DNS sont faits à votre place.

## 2. Héberger le site sur Vercel
GitHub Pages ne gère qu'une adresse par site : les sous-domaines cachés demandent Vercel (gratuit pour ce site).
1. Sur <https://vercel.com>, **Add New → Project**, importer le dépôt GitHub `abidjan-syphony`. Aucun réglage de build : laisser tel quel, puis **Deploy**.
2. **Settings → Domains** : ajouter les quatre noms `mondomaine.com`, `www.mondomaine.com`, `admin.mondomaine.com` et `scan.mondomaine.com`.
3. Chez le registrar (si le domaine n'est pas acheté chez Vercel), créer les enregistrements DNS que Vercel affiche pour chaque nom (en général un `A` pour le domaine nu et un `CNAME` pour les sous-domaines). Les certificats https sont automatiques.

## 3. Basculer le code sur le domaine
Dans le dossier du site :

```bash
python outils/domaine.py mondomaine.com
```

Le script remplace l'adresse partout (balises, plan du site, e-mails), renseigne `config.js` et écrit `vercel.json`. Ensuite : envoyer sur GitHub (`git push`), Vercel redéploie tout seul.

## 4. Mettre à jour le script Google
1. Dans Apps Script, recoller `reservations/Code.gs` en gardant vos réglages `EMAIL_EQUIPE`, `CLE_ACCUEIL` et `CLE_ADMIN`.
2. **Déployer → Gérer les déploiements → ✏️ → Nouvelle version.** L'adresse `/exec` ne change pas.
3. Dans le Sheet, menu **BOMLAAH** : « Lien de l'espace organisateurs » et « Lien de l'espace scan » donnent les adresses à transmettre (avec la clé après `#`).

## Deux clés, deux niveaux d'accès
- `CLE_ADMIN` : espace organisateurs. Voir tous les inscrits, les places, accepter ou refuser (avec motif), annuler une entrée, exporter. À garder pour vous seuls.
- `CLE_ACCUEIL` : espace scan. Valider un billet, c'est tout : l'équipe d'accueil ne voit aucune donnée personnelle en dehors de l'écran du scan.

## Toutes les données au même endroit
Formulaires du site, billets QR, e-mails, rappels, espace organisateurs, espace scan et tableau de bord lisent et écrivent dans **le même Google Sheet**. Une inscription faite sur le site apparaît tout de suite dans l'espace organisateurs ; un billet scanné à l'entrée met à jour la liste, les places et le tableau de bord.

## E-mails depuis votre domaine
Les e-mails partent du compte Google qui a déployé le script (limite d'environ 100 par jour avec Gmail gratuit, 1 500 avec Google Workspace). Avec un Google Workspace sur `mondomaine.com`, ils partiraient de `contact@mondomaine.com`.
