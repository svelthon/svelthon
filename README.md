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

Il y a donc **un seul point à intercepter** : cet unique appel à
`$B.namespace()`. Le runtime le détourne le temps que le corps du module
s'exécute, et rend à sa place un objet dont chaque nom est un accesseur vers un
signal Svelte. Chaque affectation que le codegen émet déjà devient une écriture
réactive, sans qu'une ligne du code généré soit réécrite. Le Python reste du
Python nu, sans une seule rune.

Le détournement est nominatif — un corps de module peut en importer d'autres
pendant qu'il tourne, et chaque import crée son namespace par la même fonction.
Le motif attendu est seulement *vérifié* à la compilation : si un futur codegen
cessait de l'émettre, le build échoue bruyamment au lieu de livrer un composant
sans réactivité.

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
                let count = $state.raw(undefined);
                bind(__proto, 'count', () => count, (v) => { count = v; });
                const __py = Object.create(__proto);
                __py.$proxy = true;
                init(__py);
                const increment = (...a) => __fn_increment(...a.slice(0, 0));
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

Traverser le DOM depuis Python fonctionne aussi, à une ligne près : la classe
d'un nœud se résout via `$B.imported['browser.html']`, que seul un vrai `import`
enregistre.

```python
from browser import html, document

el = document.createElement("input")   # → INPUT
```

On ne peut pas le pré-importer au boot (`$B.$import` lit `$B.frame_obj`, nul
tant qu'aucun corps de module n'a tourné), et l'injecter d'office dans tout
composant à handler paramétré coûterait une classe par balise HTML à des
composants qui ne touchent jamais au DOM.

**jsdom se bloque sur cet import**, alors qu'un navigateur ne bronche pas. D'où
`npm run test:browser`, qui rejoue la vérification dans un Chromium headless —
la seule partie du projet que la suite jsdom ne peut pas couvrir.

## Composition

Un composant Python n'a qu'un `<script>` d'instance. Les enfants s'importent
donc dans un `<script module>`, dont les déclarations restent visibles du
gabarit :

```svelte
<script module>
    import Row from './Row.svelte';
</script>

<script lang="python">
rows = [Item("a", 1), Item("b", 2)]
</script>

{#each rows as r}<Row row={r} />{/each}
```

Un objet Python se passe en prop sans conversion. Dans le gabarit, dicts et
tuples se lisent directement — les clés d'un dict Brython sont exposées comme
propriétés JS, un tuple *est* un tableau. Les **instances de classe** font
exception : Brython garde leurs attributs hors des propriétés JS, donc
`{o.label}` rendrait du vide. `py.of()` passe par la recherche d'attributs de
Python, protocole des descripteurs compris :

```svelte
{py.of(item).label}    <!-- attribut -->
{py.of(item).double}   <!-- @property, évaluée -->
```

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

Pour muter en place sans renoncer à `{#each items}`, `publish(nom)` est injecté
dans chaque composant. Il rend au gabarit une identité neuve — une copie
superficielle pour une liste, un dict ou un set — ce qui suffit à franchir la
comparaison `===` de Svelte :

```python
def add():
    items.append(len(items))
    publish("items")
```

Un composant qui définit son propre `publish` garde le sien.

La même règle se décline à trois niveaux, et c'est la seule à retenir —
**réaffecter, pas muter** :

| niveau | ne propage pas | propage |
|---|---|---|
| nom | — | `count += 1` |
| collection | `items.append(x)` | `items.append(x)` + `publish("items")` |
| élément d'une liste à clé | `it.label = …` | `items[i] = Item(it.id, …)` |

Le troisième cas surprend : dans un `{#each items as it (py.of(it).id)}`, muter
un attribut d'un élément ne re-rend rien même après `publish()`, parce que
l'élément a gardé son identité. Le remplacer met à jour le rendu **et** réutilise
le nœud DOM, puisque la clé, elle, n'a pas bougé.

Les accesseurs vivent sur le **prototype** du namespace, jamais sur l'objet
lui-même : réaffecter un global émet `$B.delete_for_reassign(name, locals)`, et
un `delete` sur un accesseur propre le supprimerait définitivement — le signal
se débranchait silencieusement après la première écriture.

## HMR

Le code généré d'un composant vit dans un module virtuel — une entrée distincte
du graphe Vite, que rien ne relie au `.svelte` qui l'a produit. Sans
invalidation explicite, éditer le Python re-transforme le composant tout en
continuant de servir **l'ancien corps généré** : la page se met à jour vers du
code qui n'a pas changé. Le hook `hotUpdate` du plugin invalide les deux modules
virtuels du composant, et `npm run test:hmr` le vérifie.

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

Validé par `npm test` — 32 tests, plus 1 échec attendu (voir plus bas) :

- réactivité de bout en bout, et quels chemins d'écriture propagent ;
- props : défaut Python, priorité du parent, lisibilité pendant l'init,
  propagation d'une mise à jour du parent jusqu'au Python ;
- **grille de fidélité sémantique** : entiers, texte, protocoles, flot de
  contrôle et frames. Chaque valeur attendue a été produite par CPython 3.12 en
  exécutant le code du composant tel quel, jamais écrite à la main. Brython
  reproduit CPython sur **39 des 40 points** ;
- build de production : **242 Ko gzip**, runtime Brython compris.

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
- **Mutations en place.** Tenté et abandonné : faire incrémenter une révision
  par chaque appel entrant en Python invalide bien les liaisons, mais une liste
  mutée reste **le même objet**, et `$derived` comme `$state.raw` ignorent une
  écriture dont la valeur est inchangée au sens de `===`. Propager demanderait
  de livrer une copie fraîche au gabarit à chaque rendu, donc de sacrifier
  l'identité des objets. Résolu autrement, par `publish(nom)` (voir plus haut) —
  explicite, une ligne, et sans coût pour les composants qui ne l'utilisent pas.
- **`__file__`.** Brython dérive son identifiant de namespace du `filename` et
  ne neutralise que les `.`, pas les `/` : un chemin réel produit
  `locals_src/Counter_svelte`, du JS invalide. On passe donc un nom aplati, au
  prix de la lisibilité des tracebacks. Correctif en amont possible.

## Lancer

```sh
npm install
npm test             # grille de fidélité, props, réactivité (jsdom)
npm run test:browser # interop DOM, dans un vrai Chromium
npm run test:hmr     # invalidation des modules virtuels
npm run dev          # page de démonstration
npm run build
```

`vendor/brython.js` est une copie de `www/src/brython.js` (3.14 dev). Le dossier
porte un `package.json` marqué `commonjs` : Node doit le charger comme script
classique, alors que la racine est en `type: module`.
