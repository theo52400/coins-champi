# Appli Android de Coins à champi

Le même jeu que le site (mêmes groupes, mêmes trouvailles, en direct avec les joueurs du site), dans une appli
Android qui sait ce qu'un site ne peut pas faire :

- **position et trace écran éteint** pendant les sorties, les itinéraires et les chasses au cèpe d'or
  (service de localisation de premier plan, avec une notification « Coins à champi : sortie en cours ») ;
- **alertes du groupe en notification** (SOS, « Venez voir ! », regroupement) quand le téléphone est dans la poche ;
- partage d'invitation par les applis du téléphone (SMS, WhatsApp…) ;
- bandeau quand une nouvelle version de l'appli est publiée.

## Installer

Sur le téléphone : <https://github.com/theo52400/coins-champi/releases/latest/download/coins-a-champi.apk>,
ouvrir le fichier téléchargé, autoriser l'installation depuis le navigateur. Les mises à jour s'installent de la
même façon, par-dessus, sans perdre le profil.

## Comment elle est faite

- [Capacitor](https://capacitorjs.com) 8 : l'appli embarque une copie du site (`scripts/prepare-www.mjs`) et
  `js/native.js` n'est chargé que dans l'appli.
- Suivi écran éteint : `@capacitor-community/background-geolocation`. En arrière-plan, Android ralentit le réseau de
  la page : la position et les alertes passent alors par le réseau du téléphone (Firestore en REST, même compte
  anonyme, mêmes règles de sécurité).
- Construction, publication et test dans un émulateur : `.github/workflows/android.yml`, à chaque modification du
  site ou de ce dossier. Le test (`test/emulateur.mjs`) éteint l'écran pendant 6 minutes en faisant marcher le GPS
  et vérifie que la trace, la position vue par le groupe et les alertes suivent. Rapport : branche `sondes`,
  dossier `android/`.
- Icônes : `tests/make_android_icons.js` (moteur d'avatars du jeu).

## Clé de signature

Android n'accepte une mise à jour que si elle est signée avec la même clé que la version installée. La clé
(`android/app/signature/coins-a-champi.p12`) est donc fixe, et rangée dans le dépôt pour que GitHub puisse
construire l'appli. Le dépôt étant public, quelqu'un pourrait fabriquer une fausse mise à jour signée avec : il
suffit de n'installer l'appli que depuis le lien ci-dessus. Pour une clé privée, il faudrait la mettre dans un
« secret » GitHub (et réinstaller l'appli une fois).
