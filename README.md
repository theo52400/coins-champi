# Coins à champi — Moselle

Le jeu des chasseurs de champignons en Moselle, à jouer entre amis sur le téléphone :

- **Carte des coins** : potentiel d'habitat de 10 champignons comestibles, calculé en direct à partir des peuplements forestiers de l'IGN (BD Forêt V2), du sol estimé et des lisières, plus un indice de pousse d'après la météo des 14 derniers jours.
- **Profil et avatar 3D** : chacun crée son champignon animé (espèce, couleur, yeux, bouche, accessoire, chapeau, écharpe).
- **Sorties en direct** : pendant une sortie, les membres du groupe voient la position de chacun sur la carte. La trace est enregistrée, la voiture aussi (boussole « Retour à la voiture »).
- **Trouvailles en photo** : photo du coin, espèce, quantité, note, et visibilité au choix : coin **secret**, **groupe**, ou groupe avec **position floutée** (environ 300 m).
- **Jeu** : points, 10 niveaux, 18 badges, Mycodex de 16 espèces à débloquer, deux défis d'équipe par semaine, « bravos » sur les trouvailles des amis.
- **Cèpes d'or** : un joueur cache un trésor dans la forêt, les autres voient une zone de 250 m et un indicateur chaud/froid ; le premier à moins de 25 m le ramasse (+100 points).
- **Alertes** : « Venez voir ! », « Regroupement ici », SOS, avec la position jointe.
- **Hors réseau** : l'appli s'ouvre sans réseau ; on peut télécharger une zone (fond IGN et peuplements) avant de partir. Les trouvailles faites sans réseau se synchronisent au retour.
- **Brouillard d'exploration** : en option, seules les zones déjà parcourues sont dévoilées.

> ⚠️ Ne mangez jamais un champignon sans identification certaine. En cas de doute : pharmacien ou société mycologique. En cas de malaise après un repas de champignons : 15 ou centre antipoison.

## Jouer

1. Ouvrez l'adresse de l'appli dans Chrome (Android) ou Safari (iPhone), puis « Ajouter à l'écran d'accueil ».
2. Créez votre champignon, puis créez un groupe : un **code de 8 caractères** s'affiche. Vos amis ouvrent l'appli, créent leur champignon et entrent ce code (bouton « Inviter » pour l'envoyer).
3. En forêt : bouton **Sortie** (dans le volet du bas). Gardez l'écran allumé : un navigateur ne peut pas partager la position en arrière-plan.
4. Bouton photo au centre : **Trouvaille**.

## Mise en place (une seule fois)

### 1. Firebase (gratuit, formule Spark)

1. <https://console.firebase.google.com> → projet `coins-champi`.
2. **Authentication** → Méthode de connexion → **Anonyme** : activer.
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

- Chaque joueur a un compte anonyme lié à son navigateur ; aucun e-mail n'est demandé.
- La position n'est partagée qu'avec le groupe, seulement pendant une sortie et si le joueur l'a choisi.
- Les coins secrets restent dans l'espace privé du joueur ; ils n'apparaissent ni sur la carte des autres, ni dans les carnets partagés.
- Les photos sont recompressées et ne gardent pas leurs métadonnées (GPS, appareil).
- Changer de téléphone ou effacer les données du navigateur crée un nouveau profil.

## Développement

| Fichier | Rôle |
|---|---|
| `index.html`, `css/app.css` | Interface (mobile d'abord, clair et sombre) |
| `js/app.js` | Orchestration : écrans, GPS, sorties, jeu |
| `js/core.js` | Modèle d'habitat (peuplements, sol, lisières, météo) |
| `js/map.js` | Carte Leaflet, BD Forêt en direct (WFS Géoplateforme), grille, brouillard, hors-ligne |
| `js/game.js` | Règles : points, niveaux, badges, défis, traces |
| `js/avatar3d.js` | Avatars champignons en 3D (three.js) |
| `js/sync.js` | Synchronisation Firestore (et base locale du mode solo, `js/localstore.js`) |
| `js/photos.js` | Photo, compression, vignette, GPS EXIF |
| `sw.js` | Service worker : appli et tuiles disponibles hors réseau |
| `firestore.rules` | Règles de sécurité |

- Mode solo à plusieurs dans le même navigateur, pour tester : `index.html?as=alice` et `index.html?as=bob` dans deux onglets.
- Après toute modification, avant la mise en ligne : `node tools/stamp-sw.mjs` (nouvelle version du service worker ; les téléphones proposent alors « Mettre à jour »).

## Sources et licences

BD Forêt® V2, Plan IGN, photographies aériennes et altimétrie © IGN — Géoplateforme (licence ouverte Etalab). Carte géologique © BRGM. Météo : Open-Meteo.com (CC BY 4.0). Fond de carte © contributeurs OpenStreetMap (ODbL). Contours communaux : france-geojson (licence ouverte). Bibliothèques : Leaflet (BSD-2), three.js (MIT), Firebase JS SDK (Apache 2.0). Polices : Alegreya et Atkinson Hyperlegible (SIL OFL).
