# Undercover

Jeu **Undercover** en local : un seul téléphone qu'on se passe, de **3 à 10 joueurs**, avec civils, **Undercover** et **Mr White**. Application web installable (PWA), sans serveur, jouable hors ligne.

## Jouer

- **En ligne** : une fois GitHub Pages activé, le jeu est servi sur `https://indysignerr.github.io/undercover/`. Sur mobile, « Ajouter à l'écran d'accueil » l'installe comme une app.
- **En local** : `npm start` (ou `python3 -m http.server 8080`) puis ouvrir `http://localhost:8080`. Ouvrir directement `index.html` fonctionne aussi (sans le mode hors ligne).

## Fonctionnalités

- Jusqu'à 10 joueurs, noms et couleurs personnalisables, mémorisés d'une partie à l'autre.
- Répartition automatique des infiltrés selon le nombre de joueurs, modifiable à la main (les civils restent toujours majoritaires) :

  | Joueurs | Undercover | Mr White |
  |---|---|---|
  | 3–4 | 1 | 0 |
  | 5–6 | 1 | 1 |
  | 7–9 | 2 | 1 |
  | 10 | 3 | 1 |

- Distribution secrète des mots joueur par joueur, ordre de parole aléatoire (Mr White ne parle jamais en premier).
- Phase de description avec compteur d'infiltrés restants, vote, révélation du rôle, Mr White qui peut deviner le mot des civils.
- Menu en partie : **Timer**, **Mode amnésique** (revoir son mot en maintenant appuyé), **Modifier les joueurs**, **Réglages**, **Changer les mots**.
- Classement cumulé (civils +2, undercover +10, Mr White +6 par victoire).
- Partie sauvegardée automatiquement : fermer l'app ne perd rien.

## Bibliothèque de mots

`js/words.js` contient **1 407 paires** (2 814 mots français uniques), classées par thème. Une paire = deux mots proches (`["Pizza", "Burger"]`) ; le jeu choisit au hasard lequel va aux civils. Pour ajouter des mots, ajouter des lignes au même format puis lancer `npm test` : le test refuse les doublons.

## Structure

```
index.html        page unique
css/style.css     styles
js/words.js       bibliothèque de mots
js/game.js        logique pure (rôles, distribution, victoire, scores)
js/app.js         écrans, menus, timer, sauvegarde locale
test/game.test.js tests Node (npm test)
sw.js, manifest.json, icons/   PWA
```

## Déploiement

Le workflow `.github/workflows/pages.yml` lance les tests puis publie sur GitHub Pages à chaque push sur `master`. Si le premier run échoue, aller dans **Settings → Pages → Source : GitHub Actions** et relancer le workflow.
