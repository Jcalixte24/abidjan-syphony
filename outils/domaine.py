#!/usr/bin/env python3
"""Bascule le site BOMLAAH sur un nom de domaine et cache les espaces « organisateurs » et « scan » sur des sous-domaines.

Usage :
    python outils/domaine.py mondomaine.com
    python outils/domaine.py mondomaine.com --organisateurs gestion --scan entree
    python outils/domaine.py mondomaine.com --simuler          (affiche ce qui changerait, sans rien écrire)

Ce que fait le script :
  1. remplace l'ancienne adresse du site par https://mondomaine.com/ (balises, plan du site, données structurées, Code.gs) ;
  2. renseigne config.js (domaine et noms des sous-domaines) : les pages organisateurs et scan se redirigent alors vers leur sous-domaine ;
  3. écrit vercel.json : organisateurs.mondomaine.com et scan.mondomaine.com affichent chacun leur espace, jamais indexé ;
  4. renseigne URL_SITE, URL_ORGANISATEURS et URL_SCAN dans reservations/Code.gs (liens des e-mails et du menu du Sheet).
Ensuite : republier le script Apps Script (Code.gs), déployer le site, ajouter les 4 domaines (voir DOMAINE.md).
"""
import argparse, io, json, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMOIRE = os.path.join(RACINE, 'outils', 'site-url.txt')       # dernière adresse publique utilisée
EXTENSIONS = ('.html', '.xml', '.txt', '.json', '.gs', '.js', '.webmanifest')
IGNORER = {'.git', 'node_modules', 'lib', 'outils'}


def lire(chemin):
    return io.open(chemin, encoding='utf-8').read()


def ecrire(chemin, texte, simuler):
    if not simuler:
        io.open(chemin, 'w', encoding='utf-8', newline='').write(texte)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('domaine', help='ex. mondomaine.com (sans https:// ni /)')
    p.add_argument('--organisateurs', default='admin', help="nom du sous-domaine de l'espace organisateurs (défaut : admin)")
    p.add_argument('--scan', default='scan', help="nom du sous-domaine de l'espace scan (défaut : scan)")
    p.add_argument('--simuler', action='store_true')
    a = p.parse_args()

    d = a.domaine.strip().lower().replace('https://', '').replace('http://', '').strip('/')
    if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.[a-z]{2,}', d):
        sys.exit('Domaine invalide : ' + a.domaine)
    for n in (a.organisateurs, a.scan):
        if not re.fullmatch(r'[a-z0-9-]{2,30}', n):
            sys.exit('Nom de sous-domaine invalide : ' + n)
    if a.organisateurs == a.scan:
        sys.exit('Les deux sous-domaines doivent être différents.')

    ancien = lire(MEMOIRE).strip() if os.path.exists(MEMOIRE) else 'https://jcalixte24.github.io/abidjan-syphony/'
    nouveau = 'https://' + d + '/'
    modifies = []

    # 1. adresse du site
    for dossier, sous, fichiers in os.walk(RACINE):
        sous[:] = [x for x in sous if x not in IGNORER]
        for nom in fichiers:
            if not nom.endswith(EXTENSIONS) or nom == 'vercel.json':
                continue
            chemin = os.path.join(dossier, nom)
            try:
                t = lire(chemin)
            except UnicodeDecodeError:
                continue
            if ancien in t:
                ecrire(chemin, t.replace(ancien, nouveau), a.simuler)
                modifies.append(os.path.relpath(chemin, RACINE))

    # 2. config.js : domaine et sous-domaines
    cfg = os.path.join(RACINE, 'config.js')
    t = lire(cfg)
    t = re.sub(r"window\.ASYM_DOMAINE\s*=\s*'[^']*';\n?", '', t)
    t = re.sub(r"window\.ASYM_SOUS_DOMAINES\s*=\s*\{[^}]*\};\n?", '', t)
    t = t.rstrip('\n') + "\n// Espaces cachés : une fois le domaine renseigné, organisateurs/ et scan/ ne s'ouvrent que depuis leur sous-domaine.\n" + \
        "window.ASYM_DOMAINE = '%s';\nwindow.ASYM_SOUS_DOMAINES = { admin: '%s', scan: '%s' };\n" % (d, a.organisateurs, a.scan)
    ecrire(cfg, t, a.simuler); modifies.append('config.js')

    # 3. vercel.json : un seul site, trois noms de domaine
    h_org, h_scan = '%s.%s' % (a.organisateurs, d), '%s.%s' % (a.scan, d)
    prive = [{'key': 'X-Robots-Tag', 'value': 'noindex, nofollow, noarchive'}, {'key': 'Cache-Control', 'value': 'no-store'}]
    prive_h = {x['key']: x['value'] for x in prive}
    # « routes » passe avant les fichiers : sans cela, « / » afficherait toujours l'accueil, même sur admin.* et scan.*
    vercel = {
        'routes': [
            {'src': '/', 'has': [{'type': 'host', 'value': h_org}], 'dest': '/organisateurs/index.html', 'headers': prive_h},
            {'src': '/', 'has': [{'type': 'host', 'value': h_scan}], 'dest': '/scan/index.html', 'headers': prive_h},
            {'src': '/organisateurs/(.*)', 'headers': prive_h, 'continue': True},
            {'src': '/scan/(.*)', 'headers': prive_h, 'continue': True},
            {'handle': 'filesystem'},
        ],
    }
    ecrire(os.path.join(RACINE, 'vercel.json'), json.dumps(vercel, indent=2, ensure_ascii=False) + '\n', a.simuler); modifies.append('vercel.json')

    # 4. Code.gs : liens des e-mails et du menu
    gs = os.path.join(RACINE, 'reservations', 'Code.gs')
    t = lire(gs)
    t = re.sub(r"(URL_SITE: ')[^']*(')", r"\g<1>%s\g<2>" % nouveau, t)
    t = re.sub(r"(URL_ORGANISATEURS: ')[^']*(')", r"\g<1>https://%s/\g<2>" % h_org, t)
    t = re.sub(r"(URL_SCAN: ')[^']*(')", r"\g<1>https://%s/\g<2>" % h_scan, t)
    ecrire(gs, t, a.simuler)
    if 'reservations/Code.gs' not in [m.replace('\\', '/') for m in modifies]:
        modifies.append('reservations/Code.gs')

    if not a.simuler:
        os.makedirs(os.path.dirname(MEMOIRE), exist_ok=True)
        ecrire(MEMOIRE, nouveau + '\n', False)

    print(('SIMULATION : ' if a.simuler else '') + 'site        ' + nouveau)
    print('organisateurs  https://%s/   (caché, jamais indexé)' % h_org)
    print('scan           https://%s/   (caché, jamais indexé)' % h_scan)
    print('fichiers modifiés :', ', '.join(sorted(set(m.replace('\\', '/') for m in modifies))))
    print('\nÀ faire ensuite : recoller reservations/Code.gs dans Apps Script (Déployer > Gérer les déploiements > Nouvelle version), '
          'puis déployer le site et ajouter les domaines : voir DOMAINE.md.')


if __name__ == '__main__':
    main()
