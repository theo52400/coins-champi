# Coins à champi

Le jeu des chasseurs de champignons, partout en France métropolitaine et en Corse, à jouer entre amis sur le téléphone :

- **Carte des coins** : potentiel d'habitat de 10 champignons comestibles, calculé en direct à partir des peuplements forestiers de l'IGN (BD Forêt V2), du sol estimé d'après la roche du sous-sol (carte géologique de la France du BRGM) et des lisières, plus un indice de pousse d'après la météo des 14 derniers jours.
- **Vue de loin « Ça pousse »** : en dézoomant jusqu'à la France entière, chaque case d'environ 5 km montre la part de bons coins (BD Forêt de tous les départements, sol, lisières) multipliée par la météo de pousse du jour, avec les meilleurs secteurs de la vue. Plus près, les coins s'affichent en cases d'environ 250 m.
- **Apprendre** : encyclopédie de 45 champignons (24 comestibles, 21 dangereux) avec photos libres, goût sur 5, cuisine, conservation, critères, saison et sosies face à face ; quiz photo, cartes mémoire, défi photo de la semaine et badges.
- **Mon champignon sur la carte** : dès l'ouverture, l'avatar suit vos pas, avec la direction de marche ; le bouton de localisation fait suivre la carte.
- **Itinéraire dans l'appli** : vers un point, une trouvaille, un ami, une alerte ou la voiture. Le chemin à pied de l'IGN est tracé sur la carte avec la ligne droite, la distance restante et le temps de marche.
- **Mode poche** : écran noir verrouillé qui reste allumé, pour garder le GPS et le partage de position pendant que le téléphone est dans la poche.
- **Profil et avatar 3D** : chacun crée son champignon animé (espèce, couleur, yeux, bouche, accessoire, chapeau, écharpe).
- **Sorties en direct** : pendant une sortie, les membres du groupe voient la position de chacun sur la carte. La trace est enregistrée, la voiture aussi (boussole « Retour à la voiture »).
- **Trouvailles en photo** : photo du coin, espèce, quantité, note, et visibilité au choix : coin **secret**, **groupe**, ou groupe avec **position floutée** (environ 300 m).
- **Jeu** : points, 10 niveaux, 22 badges, Mycodex de 16 espèces à débloquer, deux défis d'équipe par semaine, « bravos » sur les trouvailles des amis.
- **Cèpes d'or** : un joueur cache un trésor dans la forêt, les autres voient une zone de 250 m et un indicateur chaud/froid ; le premier à moins de 25 m le ramasse (+100 points).
- **Discussion de groupe** et **fiche de chaque joueur** : niveau, badges, statistiques, d'où viennent ses points et ses derniers gains (une trouvaille secrète reste anonyme).
- **Alertes** : « Venez voir ! », « Regroupement ici », SOS, avec la position jointe.
- **Hors réseau** : l'appli s'ouvre sans réseau ; on peut télécharger une zone (fond IGN, peuplements et sous-sol) avant de partir. Les trouvailles faites sans réseau se synchronisent au retour.
- **Recherche** de n'importe quelle commune de France, et 20 grands massifs forestiers en accès direct.
- **Brouillard d'exploration** : en option, seules les zones déjà parcourues sont dévoilées.

> ⚠️ Ne mangez jamais un champignon sans identification certaine. En cas de doute : pharmacien ou société mycologique. En cas de malaise après un repas de champignons : 15 ou centre antipoison.

## Jouer

1. Ouvrez l'adresse de l'appli dans Chrome (Android) ou Safari (iPhone), puis « Ajouter à l'écran d'accueil ».
2. Créez votre champignon, puis votre **compte** (e-mail et mot de passe) pour le retrouver sur un autre téléphone, dans l'appli Android ou sur le site (« J'ai déjà un compte »). Créez ensuite un groupe : un **code de 8 caractères** s'affiche. Vos amis ouvrent l'appli, créent leur champignon et entrent ce code (bouton « Inviter » pour l'envoyer).
3. En forêt : bouton **Sortie** (dans le volet du bas), puis **Poche** avant de ranger le téléphone. Un navigateur coupe le GPS quand l'écran s'éteint ou qu'on change d'appli : le mode poche garde l'écran allumé (noir, verrouillé, appui long pour sortir). Sur Android, l'appli (Profil → Appli Android, ou [le lien direct](https://github.com/theo52400/coins-champi/releases/latest/download/coins-a-champi.apk)) garde la position écran éteint ; sur iPhone, il faudrait un compte développeur Apple payant.
4. Bouton photo au centre : **Trouvaille**.

## Mise en place (une seule fois)

### 1. Firebase (gratuit, formule Spark)

1. <https://console.firebase.google.com> → projet `coins-champi`.
2. **Authentication** → Méthode de connexion → **Anonyme** : activer, puis **Ajouter un fournisseur** → **Adresse e-mail/Mot de passe** : activer (le premier interrupteur seulement) → Enregistrer. Le premier sert à jouer tout de suite, le second aux comptes qui suivent le joueur d'un appareil à l'autre.
3. **Firestore Database** → créer la base (mode production, région `europe-west9`).
4. Firestore → onglet **Règles** → remplacer tout par le contenu de [`firestore.rules`](firestore.rules) → **Publier**.
5. Paramètres du projet → Vos applications → **Web** (`</>`) → copier le bloc `firebaseConfig` dans [`config.js`](config.js) :

```js
export const FIREBASE_CONFIG = {
  apiKey: '…', authDomain: 'coins-champi.firebaseapp.com', projectId: 'coins-champi',
  storageBucket: '…', messagingSenderId: '…', appId: '…'
};
```

Ces clés ne sont pas secrètes : la sécurité vient des règles Firestore. Sans configuration (`null`), l'appli fonctionne en **mode solo** : tout reste sur le téléphone.

6. Authentication → Paramètres → **Domaines autorisés** → ajouter `VOTRE-PSEUDO.github.io`.

### 2. GitHub Pages

Dépôt public `coins-champi`, fichiers à la racine. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
L'appli est alors en ligne sur `https://VOTRE-PSEUDO.github.io/coins-champi/` (le https est indispensable pour le GPS et l'appareil photo).

## Limites de la formule gratuite

Firestore Spark : 50 000 lectures, 20 000 écritures par jour et 1 Go de données. Les photos sont stockées dans Firestore (environ 650 Ko chacune, sans leurs métadonnées), soit de l'ordre de 1 500 photos. Une sortie à quatre pendant trois heures consomme environ 3 000 écritures et 12 000 lectures.

## Vie privée

- Chaque joueur commence avec un compte anonyme lié à son navigateur. S'il ajoute un e-mail et un mot de passe, c'est le même compte (rien n'est perdu) et il le retrouve en se connectant ailleurs ; l'e-mail ne sert qu'à se connecter et à retrouver le mot de passe, il n'est montré à personne.
- La position n'est partagée qu'avec le groupe, seulement pendant une sortie et si le joueur l'a choisi.
- Les coins secrets restent dans l'espace privé du joueur ; ils n'apparaissent ni sur la carte des autres, ni dans les carnets partagés.
- Les photos sont recompressées et ne gardent pas leurs métadonnées (GPS, appareil).
- Sans compte, changer de téléphone ou effacer les données du navigateur crée un nouveau profil ; avec un compte, il suffit de se reconnecter.

## Développement

| Fichier | Rôle |
|---|---|
| `index.html`, `css/app.css` | Interface (mobile d'abord, clair et sombre) |
| `js/app.js` | Orchestration : écrans, GPS, sorties, jeu |
| `js/core.js` | Modèle d'habitat (peuplements, sol, lisières, météo) |
| `js/map.js` | Carte Leaflet, BD Forêt en direct (WFS Géoplateforme), sous-sol, communes, grille, brouillard, hors-ligne |
| `js/far.js` | Vue de loin : carte de France « Ça pousse » et cases de 250 m (`data/foret`, `data/meteo`) |
| `js/encyclo.js`, `js/learn.js` | Encyclopédie (fiches) et onglet Apprendre (quiz, cartes mémoire, défi photo) |
| `js/game.js` | Règles : points, niveaux, badges, défis, traces |
| `js/avatar3d.js` | Avatars champignons en 3D (three.js) |
| `js/sync.js` | Synchronisation Firestore (et base locale du mode solo, `js/localstore.js`) |
| `js/photos.js` | Photo, compression, vignette, GPS EXIF |
| `sw.js` | Service worker : appli et tuiles disponibles hors réseau |
| `firestore.rules` | Règles de sécurité |
| `data/geol/` | Sous-sol : tuiles de 1° (cases de 0,005°) et légende, construites par `tools/geol/build.py` |
| `data/foret/` | Forêts de France : carreaux de 1° (cases de 1/400°, peuplement dominant et lisière) et carte de France au 1/20°, construits par `tools/foret/build.py` (`foret-france.yml`) |
| `data/meteo/pousse.json` | Météo de pousse, un point tous les 0,5°, recalculée chaque matin par `meteo-france.yml` |
| `data/encyclo/` | Photos de l'encyclopédie (Wikimedia Commons) choisies dans `tools/photos/choix.json`, construites par `photos-encyclo.yml` |
| `.github/workflows/geol-france.yml` | Reconstruit `data/geol` sur les machines de GitHub (lecture de la carte géologique) |
| `.github/workflows/verif-live.yml` | Après chaque mise en ligne, ouvre le site publié dans un navigateur et vérifie les services ; rapport sur la branche `sondes` |

- Mode solo à plusieurs dans le même navigateur, pour tester : `index.html?as=alice` et `index.html?as=bob` dans deux onglets.
- Après toute modification, avant la mise en ligne : `node tools/stamp-sw.mjs` (nouvelle version du service worker ; les téléphones proposent alors « Mettre à jour »).

## Sources et licences

BD Forêt® V2, Plan IGN, photographies aériennes, altimétrie et itinéraires piétons © IGN — Géoplateforme (licence ouverte Etalab). Sous-sol : carte géologique de la France au 1/1 000 000 © BRGM (CC BY 4.0), lue via Macrostrat (cartes voisines aux frontières : Allemagne, Suisse, Espagne) ; cartes géologiques au 1/50 000 © BRGM. Communes : API Découpage administratif, geo.api.gouv.fr (licence ouverte). Météo : Open-Meteo.com (CC BY 4.0). Photos de l'encyclopédie : Wikimedia Commons, auteur et licence (CC BY, CC BY-SA, CC0 ou domaine public) indiqués sous chaque photo et dans `data/encyclo/photos.json`. Fond de carte © contributeurs OpenStreetMap (ODbL). Bibliothèques : Leaflet (BSD-2), three.js (MIT), Firebase JS SDK (Apache 2.0). Polices : Alegreya et Atkinson Hyperlegible (SIL OFL).
