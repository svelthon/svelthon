# SVELTHON

> Version française. La documentation de référence est le [README anglais](README.md).

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

L'interpolation de **texte** est enveloppée dans `py.str()`, sinon une liste
s'afficherait `a,b,c` et un dict `[object Object]` — et comme une liste Brython
*est* un tableau JS, aucun prototype ne pouvait être corrigé à la place.

```svelte
{#if items}   <!-- réécrit en py.truthy(items) -->
  {items}     <!-- réécrit en py.str(items) → ['a', 'b', 'c'] -->
{/if}
```

Les **valeurs d'attribut et les props** sont laissées intactes : elles
transportent la valeur, pas son rendu. `data-v={items}` reçoit bien la liste.
Les réécritures ne touchent que le balisage, jamais un `<script>` ou un
`<style>` — le Python est plein d'accolades.

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

## Valeurs dérivées et liaisons

`@derived` transforme une fonction en valeur — Python lit le nom et obtient le
résultat, comme une `@property` :

```python
first = "Ada"
last = "Lovelace"

@derived
def full():
    return f"{first} {last}"
```

`{full}` dans le gabarit, `full` en Python. Le corps s'exécute dans
`$derived.by`, et chaque global qu'il touche passe par un accesseur du
namespace : **Svelte découvre les dépendances tout seul**, rien à déclarer. Un
`@derived` peut en lire un autre. Il doit être **pur** — écrire de l'état dans un
dérivé est refusé par Svelte, à juste titre.

`bind:` ne demande rien : un nom d'état est un `let` réactif ordinaire, donc
`bind:value={name}` fonctionne dans les deux sens et Python relit la valeur
saisie. (Un *prop* est un `$derived`, donc en lecture seule — la règle de Svelte
pour les props non `$bindable`.)

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
virtuels du composant, et `npm run test:hmr` le vérifie sur les deux chemins.

Un store passe par un chemin différent — `load()` plutôt que le préprocesseur —
et souffrait du même mal en pire : son propre module `.svelte.js` devait être
invalidé lui aussi, faute de quoi son `load()` ne rejouait jamais et le cache
gardait l'ancien corps.

## État partagé : un simple fichier `.py`

L'équivalent Python d'un `.svelte.ts`. Le fichier est du Python ordinaire ; ses
noms de niveau module deviennent des signaux créés **une fois pour toute
l'application**, là où l'état d'un composant naît et meurt avec chaque instance.

```python
# counter_store.py
count = 0
history = []

def increment():
    global count
    count += 1
    history.append(count)
    publish("history")
```

```svelte
<script module>
    import { store } from './counter_store.py';
</script>

<p>{store.count} — {store.history}</p>
<button onclick={store.increment}>+</button>
```

Le store est servi sous une identité `.svelte.js`, ce qui est précisément ce qui
décide vite-plugin-svelte à en compiler les runes. Les noms sont exportés par
des accesseurs : Svelte interdit d'exporter directement une liaison `$state`
réaffectée, et un getter est de toute façon ce qui garde la lecture réactive
chez l'appelant.

Un composant qui *consomme* un store sans avoir de Python à lui reçoit quand
même les réécritures de gabarit et `py` en portée — sinon `{store.history}`
retomberait sur le rendu JavaScript.

Le pont va dans les deux sens : le Python d'un composant importe le store comme
un module Python ordinaire et atteint les mêmes signaux.

```python
import counter_store

def bump():
    counter_store.increment()
    return counter_store.count
```

Le namespace du store est publié dans `$B.imported` sous son nom de module, et
le module virtuel du composant importe le store en tête — pour qu'il soit
enregistré avant que le corps du composant ne tourne.

Le plugin est en `enforce: 'pre'` : sans ça, le résolveur de Vite réclame
`./store.py` comme un fichier ordinaire et livre son Python au parseur JS.

## Cycle de vie

Par convention de nom, adossé à un unique `$effect` :

```python
def on_mount():
    ...   # après que le DOM existe

def on_destroy():
    ...   # au démontage, l'état final encore lisible
```

Les deux restent des fonctions ordinaires — Python peut les appeler aussi. Elles
s'exécutent **hors suivi** (`untrack`) : un hook lit les noms du composant à
travers les accesseurs du namespace, et ces lectures *sont* des lectures de
signaux. Sans ça, un `mounts += 1` dans `on_mount` ferait dépendre l'effet d'un
état qu'il écrit, et Svelte boucle jusqu'à `effect_update_depth_exceeded`. La
fonction de nettoyage est capturée pendant que le composant est vivant : lire un
signal depuis un teardown déjà détruit ne rend plus rien.

Chaque instance a son propre namespace — le corps du module Python est
ré-exécuté à chaque montage, défauts mutables compris.

## Asynchrone

Un handler `async def` s'exécute. Il a fallu deux choses pour ça : `async def`
est un nœud d'AST distinct, et l'ignorer laissait les handlers asynchrones
**indéfinis** — un clic ne faisait rien, en silence. Et appeler une telle
fonction depuis JavaScript rend une coroutine que personne n'exécute : l'enveloppe
la confie donc à la boucle d'événements de Brython.

```python
from browser import aio

rows = []

async def load():
    global rows
    await aio.sleep(0)      # ou aio.get(...) pour une vraie requête
    rows = ["…"]
```

Une exception levée *dans* une coroutine remonte par la boucle de Brython, pas
par l'enveloppe : elle ne porte donc pas le fichier et la ligne que le chemin
synchrone ajoute.

## Rendu côté serveur

Ça fonctionne. Svelte compile une seconde version de chaque composant qui rend
une chaîne HTML au lieu de créer des nœuds DOM ; le corps Python s'exécute donc
sous Node — ce que le compilateur fait déjà au build. Il manquait deux shims au
runtime navigateur (`self`, `addEventListener`) ; `src/lib/globals.js` les pose
désormais, et c'était tout l'obstacle.

Couvert par `src/ssr.test.js` : composants, props, composition avec composants
enfants et `py.of()`, et les valeurs Python elles-mêmes — `-7 // 2` rend bien
`-4` côté serveur.

**Le seul vrai piège, et il n'est pas propre à SVELTHON.** L'état d'un store vit
dans le module, donc il est partagé par toutes les requêtes servies par le
processus. Svelte pose exactement le même avertissement pour un `$state` de
niveau module dans un `.svelte.js`. Sans danger au **prérendu** — une seule
passe, aucun utilisateur concurrent — et fuite de données en rendu par requête.
La réponse de Svelte est le contexte, que SVELTHON n'expose pas encore au
Python : les deux manques se composent.

Le prérendu est donc la cible atteignable : aucun serveur nécessaire, il tient
dans la chaîne de build qui exécute déjà Brython sous Node, et c'est ce dont un
site de documentation ou une démo a réellement besoin.

## Erreurs

Une exception Brython arrive en JavaScript **sans `message` ni `stack`** : les
devtools et l'overlay de Vite n'affichent rien, alors que le texte existe dans
l'objet Python. Chaque handler et le corps du module sont donc enveloppés pour
les renseigner, en nommant la fonction et le fichier :

```
ValueError: cassé au fond (boom() — src/Counter.svelte:6)
```

La ligne vient de la traceback Python, recalée sur la numérotation du fichier —
un `<script module>` placé avant le Python ne la fausse pas.

Le composant survit à l'exception — le handler suivant fonctionne — et un
`try/except` Python reste un `try/except` Python : l'enveloppe ne s'applique
qu'à ce qui remonte jusqu'à JavaScript.

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

Validé par `npm test` — 76 tests, plus 1 échec attendu (voir plus bas) :

- réactivité de bout en bout, et quels chemins d'écriture propagent ;
- props : défaut Python, priorité du parent, lisibilité pendant l'init,
  propagation d'une mise à jour du parent jusqu'au Python ;
- **grille de fidélité sémantique** : entiers, texte, protocoles, flot de
  contrôle et frames. Chaque valeur attendue a été produite par CPython 3.12 en
  exécutant le code du composant tel quel, jamais écrite à la main. Brython
  reproduit CPython sur **39 des 40 points** ;
- build de production : **244 Ko gzip**, runtime Brython compris.

La grille sert de banc d'acceptation aux codegens optimisés (wasthonf) : un
codegen qui supprime les cadres d'appel casse `Frames`, qui déballe les entiers
casse `Integers`, qui court-circuite `augm_assign` casse `Protocols`.

### Divergence connue

Une seule, signalée par un `test.fails` qui alertera le jour où elle sera
corrigée : la variable d'une compréhension **fuit dans la portée module**
(`[q for q in range(3)]` laisse `q` défini), alors que Python 3 lui donne une
portée propre.

## Surface Svelte couverte

Mesuré, pas supposé (`src/svelte-surface.test.js`) — tout ceci fonctionne dans
un composant Python :

| | |
|---|---|
| blocs | `{#if}` `{:else if}` `{#each}` (indexé, `{:else}`, avec clé) `{#key}` `{#await}` |
| balises | `{@html}` `{@const}` `{@render}` `{#snippet}` |
| liaisons | `bind:value` `bind:checked` `bind:group` `bind:this` |
| directives | `class:` `style:` `use:` `transition:` |
| composition | props, défauts, spread d'un **dict Python**, enfants par snippet |
| éléments | `<svelte:window>` `<svelte:head>` `<svelte:boundary>` |
| styles | `<style>` scopé |

Non couvert : `setContext`/`getContext` n'ont pas d'API côté Python — ils
doivent s'appeler pendant l'initialisation d'une instance, ce qu'un
`<script module>` ne permet pas. Ni `$bindable()` (un prop est un `$derived`,
donc en lecture seule).

Rappel : **les expressions de gabarit sont du JavaScript.** `{node is not None}`
ne compile pas ; c'est `{py.truthy(node)}`.

## Tests

Aucun parallélisme : chaque worker recharge et retransforme le runtime Brython
pour son compte au lieu de partager le travail. Mesuré sur ce projet à plus de
30 minutes en parallèle contre moins d'une en séquentiel.

## Reste à faire

**Bloque une vraie application**

- **Empaquetage.** `src/lib/` est le framework, mêlé à la démo. L'utiliser
  ailleurs demande d'en faire un paquet npm installable. Rien ne s'y oppose
  techniquement : c'est le seul point de cette liste qui soit du pur travail.

**Manquant, avec contournement**

- **`setContext` / `getContext`.** Aucune API côté Python. Ils doivent être
  appelés pendant l'initialisation d'une *instance*, ce qu'un `<script module>`
  — exécuté une seule fois — ne peut pas faire. Le corps du module Python
  tournant bien à l'initialisation, l'exposer devrait suffire. C'est aussi le
  préalable au rendu serveur par requête, le contexte étant la réponse de Svelte
  à l'état par requête. Contournement pour de l'état global : un store `.py`.
- **`$bindable()`.** Un prop est un `$derived`, donc en lecture seule ; pas de
  liaison bidirectionnelle parent↔enfant. Contournement : passer une fonction de
  rappel en prop.
- **Les effets au-delà de `on_mount` / `on_destroy`.** Pas moyen de dire
  « exécute ce Python quand X change ». `@derived` couvre les valeurs calculées ;
  les effets de bord — journaliser, écrire dans `localStorage`, synchroniser —
  n'ont aucun crochet.

**Aspérités**

- **Source maps.** Les erreurs portent un numéro de ligne juste, mais le
  débogueur du navigateur montre le JS généré, pas le Python.
- **Les erreurs levées dans une coroutine** remontent par la boucle de Brython :
  elles n'ont pas le fichier ni la ligne que le chemin synchrone ajoute.
- **Éditeur.** Aucune coloration ni complétion dans `<script lang="python">`.
- **Cache de compilation.** Un store est recompilé à chaque `load()`.
- **Coût à l'exécution** jamais mesuré face à du Svelte ordinaire.

**En amont, chez Brython**

- **`__file__` aplati.** Brython dérive son identifiant de namespace du
  `filename` et n'y neutralise que les `.`, pas les `/` : un chemin réel produit
  `locals_src/Counter_svelte`, du JS invalide. On passe donc un nom aplati, au
  prix de la lisibilité des tracebacks.
- **Fuite de compréhension**, la divergence connue ci-dessus.

## Lancer

```sh
npm install
npm test             # grille de fidélité, props, réactivité (jsdom)
npm run test:browser # interop DOM, dans un vrai Chromium
npm run test:hmr     # invalidation des modules virtuels (composant + store)
npm run dev          # page de démonstration
npm run build
```

### Deux réglages non évidents dans `vite.config.js`

`optimizeDeps.entries: []` — le scanner de dépendances de Vite tourne **avant**
le pipeline de plugins : il lit les entrées HTML, tombe sur
`<script lang="python">` et livre le Python à un parseur JavaScript, puis
échoue sur `./store.py`, qu'aucun fichier de ce nom n'est censé servir. Son
unique rôle ici étant de découvrir les imports nus, on le court-circuite et on
nomme le seul paquet qui mérite d'être pré-bundlé.

`vendorQuirks()` — Brython charge des modules JS nommés depuis Python par un
`import()` dont l'argument est une variable. Vite ne sait pas l'analyser et le
dit à chaque démarrage ; le plugin marque ces appels d'un `@vite-ignore` à la
volée, ce qui laisse le fichier vendu identique à l'amont.

`vendor/brython.js` est une copie de `www/src/brython.js` (3.14 dev). Le dossier
porte un `package.json` marqué `commonjs` : Node doit le charger comme script
classique, alors que la racine est en `type: module`.
