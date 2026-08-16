# SVELTHON

Des composants Svelte écrits en Python, compilés par Brython **au build**.

```svelte
<script lang="python">
count = 0

def increment():
    global count
    count += 1
</script>

<button onclick={increment}>compté {count} fois</button>
```

Pas de rune côté Python, pas d'API de réactivité à apprendre : du Python nu.
Le navigateur ne reçoit que du JavaScript — plus aucune transcompilation au
chargement de la page.

## L'idée

Brython range l'état d'un module Python dans un **objet namespace**, jamais dans
des bindings lexicaux :

```js
locals_Counter = $B.namespace('Counter')
locals_Counter.count = 0
```

Or `$state` de Svelte 5 rend un objet profondément réactif via un Proxy. Il y a
donc un seul point à intercepter : on donne à Brython un proxy `$state` à la
place de son namespace, et **chaque affectation que son codegen émet déjà
devient une écriture réactive**. C'est toute l'astuce, et elle tient en une
substitution (`src/lib/compile.cjs`).

## Chaîne de compilation

```
 Counter.svelte
   └── <script lang="python">
         │
         │  préprocesseur Svelte (src/lib/svelthon.js)
         ↓
       $B.py2js()  ← Brython, sous Node          [build]
         │
         ├──→ module virtuel  virtual:svelthon/<nom>
         │      export function init(__py) { …code généré… }
         │
         └──→ script du composant
                let __py = $state({});
                init(__py);
                let count = $derived(__py.count);
                const increment = (...a) => __py.increment(...a.slice(0, 0));
```

Le code généré vit dans un module séparé parce que **Svelte interdit le préfixe
`$` sur toute déclaration d'un composant**, dans toutes les portées — et le
codegen Brython ouvre sur `var $B = __BRYTHON__`. Un IIFE ne suffit pas ; il
faut un fichier que Svelte ne parse pas.

## Props : l'annotation est l'interface

Comme dans un dataclass — annoté, c'est public ; affecté, c'est interne.

```python
name: str          # prop requis
punct: str = "!"   # prop avec défaut
greeting = "Bonjour"   # état interne, invisible du parent
```

Un prop est lisible dès l'exécution du corps du module, une mise à jour du
parent traverse jusqu'au Python, et un prop requis non fourni vaut `None` — pas
`undefined`. Écrire dans un prop depuis Python n'a d'effet que si le parent n'en
fournit pas : c'est la règle de Svelte pour les props non `$bindable`.

La lecture d'un global passe par `$B.resolve_global`, qui exige une propriété
**propre** sauf si le namespace porte le drapeau `$proxy` — auquel cas il lit la
propriété normalement, donc en traversant le prototype. C'est le seul endroit de
Brython qui consulte ce drapeau, et c'est ce qui rend l'astuce du prototype
compatible avec les props.

## Le gabarit est du JavaScript

Règle à retenir : dans le balisage on est en JS, pas en Python. Deux
conséquences, dont une corrigée automatiquement.

`{#if}` est **réécrit** vers le `bool()` de Python par le préprocesseur — sinon
une liste vide, un dict vide ou `None` seraient vrais, puisque JS tient tout
objet pour vrai. `{#each}` fonctionne nativement : une liste Brython *est* un
tableau JS.

L'interpolation reste JS : `{items}` affiche `a,b,c` là où Python dirait
`['a', 'b', 'c']`. D'où `py.str()`, injecté dans tout composant Python :

```svelte
{#if items}          <!-- réécrit en py.truthy(items) -->
  {py.str(items)}    <!-- ['a', 'b', 'c'] -->
{/if}
```

Pour les événements, le motif recommandé est d'extraire dans le gabarit et de
calculer en Python :

```svelte
<input oninput={(e) => on_text(e.target.value)} />
```

Un handler qui déclare un paramètre reçoit bien l'événement emballé
(`DOMEvent`), mais **traverser le DOM depuis Python** (`event.target.value`)
exige `$B.imported['browser.html']`, que seul un vrai `import` enregistre : le
composant doit alors faire `from browser import html`. On ne peut pas le
pré-importer au boot — `$B.$import` lit `$B.frame_obj`, nul tant qu'aucun corps
de module n'a tourné.

## Réactivité : un signal par nom

Le namespace n'est **pas** un proxy `$state`. Svelte proxifierait alors chaque
valeur Python qu'on y range, et un objet Brython proxifié échoue à ses propres
vérifications de type — `repr((1, 2))` lève « descriptor `__repr__` requires a
'tuple' object but received a 'tuple' ». À la place, chaque nom de niveau module
reçoit son propre `$state.raw`, publié vers Brython par un accesseur : les
valeurs Python restent opaques à Svelte.

Conséquence à connaître : **c'est la réaffectation d'un nom qui est réactive**,
pas la mutation en place d'une valeur.

```python
count += 1          # réactif — réaffecte `count`
items = items + [x] # réactif — réaffecte `items`
items.append(x)     # PAS réactif — mute sans réaffecter
box.value += 1      # PAS réactif — mute un attribut
```

Les accesseurs vivent sur le **prototype** du namespace, jamais sur l'objet
lui-même : réaffecter un global émet `$B.delete_for_reassign(name, locals)`, et
un `delete` sur un accesseur propre le supprimerait définitivement — le signal
se débranchait silencieusement après la première écriture.

## Stdlib : seulement ce qui est importé

`py2js()` expose les imports du composant, et le VFS de Brython porte déjà le
graphe de dépendances (`[ext, source, deps, is_package]`). La fermeture
transitive est donc exacte, et seule elle entre dans le bundle :

| | |
|---|---|
| `import sys` → modules embarqués | `sys`, `browser` |
| poids embarqué | **7,2 Ko** |
| stdlib complète | 4,6 Mo |
| | **652× plus petit** |

`vendor/brython_stdlib.js` sert de source au build et n'est jamais expédié.
C'est le même mécanisme qui accueillera les `.wasm` de Wasthon.

## État

Validé par `npm test` — 17 tests, plus 1 échec attendu (voir plus bas) :

- réactivité de bout en bout, et quels chemins d'écriture propagent ;
- props : défaut Python, priorité du parent, lisibilité pendant l'init,
  propagation d'une mise à jour du parent jusqu'au Python ;
- **grille de fidélité sémantique** : entiers, texte, protocoles, flot de
  contrôle et frames. Chaque valeur attendue a été produite par CPython 3.12 en
  exécutant le code du composant tel quel, jamais écrite à la main. Brython
  reproduit CPython sur **39 des 40 points** ;
- build de production : **233 Ko gzip**, runtime Brython compris.

La grille sert de banc d'acceptation aux codegens optimisés (wasthonf) : un
codegen qui supprime les cadres d'appel casse `Frames`, qui déballe les entiers
casse `Integers`, qui court-circuite `augm_assign` casse `Protocols`.

### Divergence connue

Une seule, signalée par un `test.fails` qui alertera le jour où elle sera
corrigée : la variable d'une compréhension **fuit dans la portée module**
(`[q for q in range(3)]` laisse `q` défini), alors que Python 3 lui donne une
portée propre.

## Reste à faire

- **Affichage des valeurs Python.** Svelte interpole avec `String()`, donc une
  liste s'affiche `0,1` au lieu de `[0, 1]` et un dict `[object Object]`. Seul
  `None` est traité. Corriger demanderait de distinguer, dans le gabarit, une
  interpolation textuelle d'un passage de prop à un composant enfant.
- **Interop des handlers.** Aujourd'hui les arguments JS sont tronqués à
  l'arité déclarée en Python, ce qui fait marcher `onclick` sans que Python
  reçoive l'événement. Une vraie politique (`$B.jsobj2pyobj` à la demande, ou
  sur décorateur) reste à choisir.
- **Wasthon.** Le tree-shaking de la stdlib est en place ; reste à y brancher
  les `.wasm`, pour qu'ils entrent dans le graphe d'assets de Vite — préchargés
  et hashés — au lieu d'être découverts au runtime par un `await import(url)`
  invisible au bundler.
- **Mutations en place.** Les rendre réactives demanderait d'observer les
  valeurs, ce que le proxy `$state` interdit ici. Piste : un décorateur Python
  qui republie explicitement, ou un type liste réactif fourni par SVELTHON.
- **`__file__`.** Brython dérive son identifiant de namespace du `filename` et
  ne neutralise que les `.`, pas les `/` : un chemin réel produit
  `locals_src/Counter_svelte`, du JS invalide. On passe donc un nom aplati, au
  prix de la lisibilité des tracebacks. Correctif en amont possible.

## Lancer

```sh
npm install
npm test        # les deux suites de validation
npm run dev     # page de démonstration
npm run build
```

`vendor/brython.js` est une copie de `www/src/brython.js` (3.14 dev). Le dossier
porte un `package.json` marqué `commonjs` : Node doit le charger comme script
classique, alors que la racine est en `type: module`.
