# Banc d'essai premium-3d

Mesurer si une version du skill fait mieux que la précédente, avec des chiffres plutôt qu'à l'œil.
À lancer avant chaque version (même briefs, même protocole).

## 1. Construire (agents à l'aveugle)
Pour chaque demande de `briefs.json`, un agent **qui n'a jamais vu le projet** construit le site avec
le skill seul. Prompt, à l'identique (remplacer `<…>`) :

> Tu es développeur web. Le skill premium-3d est dans `<chemin du skill>` : lis son SKILL.md et
> suis-le à la lettre, avec ses outils. Ne lis rien d'autre du dépôt (ni `examples/`, ni `docs/`,
> ni `bench/` hors de ton dossier). Personne ne répondra à tes questions : décide toi-même.
> Demande du client : « <brief> ».
> Construis la page dans `bench/runs/<version>/<id>/` (index.html à la racine du dossier, tous les
> chemins relatifs, modules de lib/ copiés dans le dossier). Un serveur sert la racine du dépôt sur
> `http://127.0.0.1:5180/`. Machine partagée et sans carte graphique : check.mjs avec `--cpu
> --points 0,0.5,1`, trois fois au plus. Ne fais pas le jury (un juge externe s'en charge).
> Pour finir, écris `meta.json` : `{ "section": "#id de la section 3D", "concept": "en une phrase",
> "minutes": durée }`. Ne fais aucun commit.

À la fin de chaque agent, ajouter à son `meta.json` les chiffres mesurés de la notification :
`"tokens"` et `"minutes_mesurees"` (durée réelle, prioritaire sur l'estimation de l'agent).

## 2. Contrôler
```bash
python3 plugins/premium-3d/skills/premium-3d/tools/serve.py 5180 &
node bench/score.mjs bench/runs/<version> --skip-check   # tableau sans recontrôle (rapide)
node bench/score.mjs bench/runs/<version>                # contrôle complet --full de chaque site
```

## 3. Juger (un agent qui n'a rien construit)
> Tu es directeur artistique et juge d'un concours de sites. Pour chaque dossier de
> `bench/runs/<version>/`, regarde **seulement** les captures (`captures/*.png`) et la demande
> correspondante dans `bench/briefs.json` ; ne lis pas le code. Note sur 10 : originalite,
> pertinence, finition, lisibilite, fluidite (d'après les captures successives : à-coups, objets
> coupés), mobile. Sois exigeant : 8 = digne d'un studio, 10 = exceptionnel. Écris
> `<dossier>/jury.json` : `{ "originalite": n, …, "notes": "deux phrases : le meilleur, le pire" }`.

Puis `node bench/score.mjs bench/runs/<version> --skip-check --compare bench/runs/<version précédente>`.

## 4. Lire
`RESULTS.md` : erreurs, alertes (3D coupée, sous le texte, budget), note du jury, minutes et poids
par site, moyenne, et « mieux / moins bien » face à la version précédente. Les erreurs qui
reviennent d'un site à l'autre sont les prochaines corrections du skill.

Les sites construits (`runs/`) ne sont pas versionnés : seuls `results.json` et `RESULTS.md` le sont.
