# SVELTHON

> Version française. La documentation de référence est le [README anglais](README.md).

![La page de démonstration : le source Python à côté du composant vivant](docs/demo.png)

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

## L'API, et ce qu'elle remplace

Cinq noms, et rien à importer : ils sont injectés dans le namespace du module, et
un composant qui définit le sien le garde. Chacun se tient là où se tient une
rune en JavaScript.

| Python | Svelte 5 |
|---|---|
| `count = 0` | `let count = $state(0)` |
| `name: str` | `let { name } = $props()` |
| `size: int = 3` | `let { size = 3 } = $props()` |
| `value: str = bindable()` | `let { value = $bindable() } = $props()` |
| `@derived` | `$derived.by(…)` |
| `@effect` | `$effect(…)` |
| `def on_mount()` / `on_destroy()` | `onMount()` / `onDestroy()` |
| `set_context(k, v)` / `get_context(k)` | `setContext(k, v)` / `getContext(k)` |
| `items.append(x)` | `items.push(x)` — `$state` proxifie en profondeur |

La dernière ligne est la seule qui coûte du travail plutôt qu'un renommage —
voir [Réactivité](#réactivité--un-signal-par-nom) pour la façon dont une mutation
en place est attrapée sans proxy.

Il n'y a pas d'équivalent de `$state` à écrire, parce qu'il n'y a rien à
déclarer : une affectation au niveau du module *est* la déclaration, et le
compilateur la lit dans l'AST.

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

## Le gabarit est du Python

Toute expression que le gabarit *lit* est compilée en Python. Chaque site devient
une fonction cachée ajoutée au module, que le balisage appelle :

```svelte
{#if rows}                    <!-- {#if __expr_0()}     def __expr_0(): … -->
  {#each rows as r}
    <li data-id={r.id}>{r.label}</li>
  {/each}
{/if}
```

Les variables de bloc sont passées en argument, si bien que ces fonctions lisent
les noms du composant par les accesseurs du namespace — donc **Svelte découvre
leurs dépendances tout seul**, exactement comme pour `@derived`.

Le gabarit est donc du Python, sans aucun helper :

```svelte
{value is None}              {a and not b}           {len(rows)}
{"oui" if flag else "non"}   {rows[1:]}              {f"{n} éléments"}
{item.label}                 {mapping["key"]}        {[x.upper() for x in xs]}
```

`{item.label}` sur une instance fonctionne — c'était la verrue que `py.of()`
masquait. `{#if rows}` suit la vérité de Python, donc une liste vide est fausse.
Et un `dict` n'a pas d'attributs : `{d["k"]}` et non `{d.k}` — la sémantique est
celle de Python, y compris là où elle diffère de JavaScript.

Tout site *lu* par le balisage passe par Python, pas seulement les
interpolations :

```svelte
{#each scores.items() as [k, v]}   <!-- un dict, un range, un générateur -->
  {@const half = (v - 7) // 2}     <!-- -4, là où JavaScript dirait -3,5 -->
{/each}
{#key point}                       <!-- comparé par repr(), l'égalité de Python -->
{@html render(row)}
```

L'itérable d'un `{#each}` est évalué *hors* du bloc et sa clé *dedans* : chacun
est donc compilé avec les noms qu'il peut réellement voir. Une clé et un `{#key}`
se comparent par `repr()` — Svelte comparerait des identités, et aucune valeur
Python n'en conserve : un `(1, 2)` reconstruit est un autre objet.

**Les directives gardent la langue de l'hôte**, parce qu'elles portent un rappel
ou une valeur JavaScript, pas un rendu :

```svelte
<input oninput={(e) => on_text(e.target.value)} bind:value={name} use:action />
```

La règle : `on*`, `bind:`, `use:`, `class:`, `style:` et la famille des
transitions restent en JavaScript ; tout autre attribut, prop de composant
compris, est du Python. Un composant sans Python à lui — un consommateur de store
— conserve le gabarit JavaScript et les helpers `py.str()` / `py.truthy()`.

Ça coûte **1,3× à 1,7× sur le rendu** face à un composant JavaScript
(`npm run bench` — l'écart entre les deux est ce qu'un portable modeste mesure
d'un jour à l'autre), contre 0,6× auparavant : un appel Python par expression et
par rendu. C'est le prix du gabarit en Python.

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

Un objet Python se passe en prop sans conversion, et se relit en Python —
attributs et descripteurs compris, puisque les expressions du gabarit sont
compilées en Python :

```svelte
{item.label}     <!-- attribut -->
{item.double}    <!-- @property, évaluée -->
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
saisie.

`bindable()` sur une annotation déclare un prop bidirectionnel — l'enfant peut y
écrire et la variable du parent suit :

```python
value: str = bindable()          # sans défaut
tag: str = bindable("default")   # avec
```

```svelte
<Child bind:value={text} />
```

La subtilité est dans le défaut : le corps du module l'applique en écrivant dans
le nom, et cette écriture-là ne doit pas remonter au parent. Seules celles qui
suivent le retour d'`init()` sont de vraies écritures.

## Réactivité : un signal par nom

Le namespace n'est **pas** un proxy `$state`. Svelte proxifierait alors chaque
valeur Python qu'on y range, et un objet Brython proxifié échoue à ses propres
vérifications de type — `repr((1, 2))` lève « descriptor `__repr__` requires a
'tuple' object but received a 'tuple' ». À la place, chaque nom de niveau module
reçoit son propre `$state.raw`, publié vers Brython par un accesseur : les
valeurs Python restent opaques à Svelte.

Réaffecter un nom est réactif, et muter un conteneur en place l'est aussi :

```python
count += 1          # réactif — réaffecte `count`
items = items + [x] # réactif — réaffecte `items`
items.append(x)     # réactif — l'objet le signale lui-même
table["k"] = v      # réactif
```

Le second signal explique comment. Chaque nom porte une valeur **et** un compteur
de révision, et l'accesseur lit les deux — donc tout lecteur dépend aussi du
compteur. Une mutation n'incrémente que lui : rien n'est copié, et l'objet garde
son identité.

Détecter la mutation est l'autre moitié, et c'est là que Python paie. Svelte
proxifie la valeur en profondeur, ce qui est inutilisable ici — un objet Brython
proxifié échoue à ses propres vérifications de type. Mais une liste Python *est*
un tableau JavaScript : l'objet peut donc porter lui-même une marque non
énumérable. `$B.get_class` ne lit que `ob_type`, donc `type(items) is list` reste
vrai et `repr` est intact. Et Brython compile tout appel de méthode en
`$B.call_attr` et toute écriture indicée en `$B.$setitem` : **deux interceptions
couvrent tout le langage**, et un objet non marqué ne paie qu'un accès manqué.

La marque voyage avec l'objet, ce qu'aucune analyse à la compilation ne saurait
faire :

```python
def fill(target):
    target.append("x")   # le compilateur ne voit rien ici

def add():
    fill(items)          # réactif quand même
```

Deux limites subsistent, toutes deux tenues par des tests :

| | propage |
|---|---|
| `items.append(x)`, `table[k] = v`, `del table[k]`, `tags.add(x)` | oui |
| un conteneur imbriqué — `data["rows"].append(x)` | non — seul l'objet extérieur est marqué |
| un attribut d'instance — `box.value += 1` | non — les écritures d'attribut ne sont pas interceptées |
| un élément d'une liste à clé — `it.label = …` | non — remplacer l'élément : `items[i] = Item(…)` |

Le dernier cas surprend : dans un `{#each items as it (it.id)}`, muter un
attribut d'un élément ne re-rend rien, parce que l'élément a gardé son identité.
Le remplacer met à jour le rendu **et** réutilise le nœud DOM, puisque la clé,
elle, n'a pas bougé.

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

## Effets

`@effect` rejoue une fonction quand un nom qu'elle a *lu* change. Rien à
déclarer : les globals passent par les accesseurs du namespace, donc leurs
lectures sont des lectures de signaux et Svelte en déduit seul les dépendances.

```python
count = 0

@effect
def watch():
    global seen
    seen = f"count={count}"

    def cleanup():
        ...
    return cleanup     # nettoyage optionnel, avant chaque reprise et au démontage
```

**Le piège que ce modèle crée** : `runs += 1` sur un nom de niveau module *lit*
avant d'écrire, donc un compteur incrémenté dans un effet le rend dépendant de ce
qu'il écrit, et Svelte boucle jusqu'à `effect_update_depth_exceeded`. Une
affectation simple ne lit rien.

`$effect` appartient à un composant : un store, qui n'en a pas, traite une
fonction `@effect` comme une fonction ordinaire.

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

## Contexte

`set_context` et `get_context` sont injectés dans chaque composant, comme
`derived` et `effect`. Les deux doivent s'exécuter pendant l'initialisation
d'une instance — soit exactement au moment où tourne le corps du module Python,
si bien que rien d'autre n'a été nécessaire.

```python
# chez un ancêtre
set_context("theme", "dark")

# chez n'importe quel descendant, si profond soit-il
theme = get_context("theme")
```

Le contexte est **par sous-arbre**, là où un store est par application : deux
instances du même composant peuvent en porter des valeurs différentes, et les
composants intermédiaires n'en savent rien. Une clé jamais posée vaut `None`, pas
`undefined`.

C'est aussi, de ce fait, le seul endroit où placer de l'état en rendu serveur par
requête : l'arbre de composants est reconstruit à chaque rendu, donc rien ne fuit
d'une requête à l'autre — contrairement à un store, dont l'état vit dans le
module.

## Source maps

Brython parsème son code généré de `$B.set_lineno(frame, N)` : le JavaScript
produit porte donc la ligne Python dont chaque instruction provient. De quoi
émettre une source map de niveau ligne avec chaque module virtuel — le débogueur
ouvre alors le fichier `.svelte` ou `.py`, et non mille lignes de JS généré.

Niveau ligne, pas colonne : une ligne Python correspond à la suite de lignes
générées qui l'implémentent. Un test décode la carte et vérifie qu'une
instruction connue atterrit sur sa vraie ligne — une carte qui pointe à côté
étant pire que pas de carte du tout.

## Rendu côté serveur

Ça fonctionne. Svelte compile une seconde version de chaque composant qui rend
une chaîne HTML au lieu de créer des nœuds DOM ; le corps Python s'exécute donc
sous Node — ce que le compilateur fait déjà au build. Il manquait deux shims au
runtime navigateur (`self`, `addEventListener`) ; `src/lib/globals.js` les pose
désormais, et c'était tout l'obstacle.

Couvert par `tests/ssr.test.js` : composants, props, composition avec composants
enfants et l'accès d'attribut, et les valeurs Python elles-mêmes — `-7 // 2`
rend bien
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

Validé par `npm test` — 101 tests, plus 2 échecs attendus (voir plus bas) :

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

Mesuré, pas supposé (`tests/svelte-surface.test.js`) — tout ceci fonctionne dans
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

Rappel : **les expressions de gabarit sont du JavaScript.** `{node is not None}`
ne compile pas ; c'est `{py.truthy(node)}`.

## Tests

Aucun parallélisme : chaque worker recharge et retransforme le runtime Brython
pour son compte au lieu de partager le travail. Mesuré sur ce projet à plus de
30 minutes en parallèle contre moins d'une en séquentiel.

## Support éditeur

Ce n'est pas un manque de SVELTHON, mais autant le savoir : la grammaire
TextMate de Svelte rabat un `lang` inconnu sur **JavaScript**. `<script
lang="python">` n'est donc pas laissé sans coloration — il est colorié faux,
commentaires `#` compris.

La grammaire liste déjà `coffee` à côté de `ts` : ajouter `python` en amont dans
`svelte-language-tools` ne demande donc aucune exception. L'autre voie est une
injection de grammaire livrée comme petite extension d'éditeur.

### Hydratation

Le runner de Svelte exécute chaque échantillon dans trois modes — client, serveur,
**hydratation** — et c'est le troisième qui exige que les deux moitiés
s'accordent, puisque le corps Python tourne des deux côtés. Couvert par
`tests/hydration.test.js` :

- les nœuds du serveur sont **repris, pas reconstruits** — leur identité survit,
  ce qui prouve que l'hydratation a bien eu lieu ;
- le Python est branché sur ces nœuds repris : un clic incrémente toujours ;
- **en cas de divergence, la valeur du client l'emporte, en silence.** Aucun
  avertissement. Un composant non déterministe — l'heure, un aléa, une session —
  ne plantera pas : il affichera une valeur puis basculera sur l'autre.

La sortie serveur exacte, marqueurs compris, est affirmée dans `tests/ssr.test.js`
pour que les deux fichiers ne puissent pas diverger.

## Ce que ça coûte à l'exécution

Mesuré par `npm run bench` : le même composant écrit deux fois, en Python et en
JavaScript, actionné par de vrais clics dans un Chromium headless. Le dispatch
d'un clic coûtant pareil des deux côtés, l'écart entre les colonnes revient au
handler. Sept tours alternés, minimum retenu — la mesure la moins polluée, pas la
moyenne des interruptions de la machine.

| | Python | JS | écart |
|---|---:|---:|---:|
| montage à chaud | 0,3 ms | 0,2 ms | ~1,5× |
| 2000 appels de handler | 28 ms | 18 ms | **~1,5×** |
| 1500 × somme de 500 carrés | 1128 ms | 15 ms | **50 à 100×** |
| rendu d'une liste à clé de 500 lignes | 5,0 ms | 8,0 ms | **0,6×** |

Trois enseignements.

**Entrer dans Python coûte peu** — environ 1,5× un handler JS. Les frames et
`augm_assign` se paient, mais rien qu'un clic puisse percevoir.

**Le calcul Python est un à deux ordres de grandeur plus lent.** Le rapport
oscille entre 50× et 100× selon les exécutions : c'est la fourchette honnête sur
une machine modeste. Garder les boucles chaudes hors des composants, ou passer
par les extensions C que [Wasthon](https://github.com/fgallaire/wasthon) compile
en WebAssembly.

**Le rendu n'est pas plus lent — il est plus rapide.** De façon constante, à
chaque exécution. Svelte proxifie en profondeur les objets d'un tableau `$state` ;
les noms de SVELTHON sont des `$state.raw`, donc les valeurs Python ne sont jamais
proxifiées. Le choix de conception de la réactivité se rembourse précisément là
où une vraie application passe son temps.

Le vrai prix est au chargement : **1,2 s jusqu'à l'interactivité** pour la démo de
production sur ce portable, contre 0,5 s pour la même page sans Brython — 244 Ko
gzip au lieu de 13. Payé une fois par session, pas par page, puisque
l'application ne recharge jamais.

## Reste à faire

**Bloque une vraie application**

- **Empaquetage.** `src/lib/` est le framework, mêlé à la démo. L'utiliser
  ailleurs demande d'en faire un paquet npm installable. Rien ne s'y oppose
  techniquement : c'est le seul point de cette liste qui soit du pur travail.


**En amont, chez Brython**

Les deux bugs, les internes dont SVELTHON dépend et les messages d'erreur qui ont
coûté le plus de débogage sont réunis dans **[BRYTHON.md](BRYTHON.md)** — le
contrat entre les deux projets, avec une reproduction minimale pour chacun.

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
