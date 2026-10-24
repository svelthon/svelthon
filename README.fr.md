<img src="img/svelthon-512.png" alt="Svelthon" width="128">

# Svelthon

> Version française. La documentation de référence est le [README anglais](README.md).

**Des composants Svelte en Python.**

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
Le navigateur ne reçoit que du JavaScript : plus aucune transcompilation au
chargement de la page.

## Pourquoi

Python est le langage le plus utilisé au monde, et le faire tourner dans un
navigateur a été promis bien des fois, par Brython, Skulpt, Transcrypt, PyScript.
L'obstacle n'a jamais été le langage. C'était la chaîne de travail : pas de
composants, pas de props, pas de rechargement à chaud, un compilateur livré à
chaque visiteur, et une page qui passait sa première seconde à compiler.

Svelthon laisse la chaîne frontend moderne intacte. Composants, props, styles
scopés, listes à clé, HMR, tree-shaking, tout, avec Python comme langage de
composant et **aucune pénalité au chargement**, puisque la compilation a déjà eu
lieu.

## Démarrer

```sh
npm install svelthon
```

Deux noms, dans un projet qui a déjà Svelte 5 ou SvelteKit : un plugin Vite, et
un préprocesseur pour `svelte.config.js`. Node `^20.19.0 || >=22.12.0`, la plage
de Vite 7 : le plugin fait `require` d'un module ESM, ce que Node ne fait sans
option qu'à partir de ces versions, et Node 21 ou 22.0 à 22.11 lèveraient
`ERR_REQUIRE_ESM`.

```js
// vite.config.js
import { svelthon, python } from 'svelthon';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        svelthon(),
        sveltekit({
            preprocess: [python({ path: ['src/lib'] })],

            // un module de route peut être en Python
            moduleExtensions: ['.js', '.ts', '.py'],

            // et un module réactif se compile comme un `.svelte.ts`
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
        })
    ]
});
```

Écrire `<script lang="python">` et c'est tout. [SvelteKit](#sveltekit) donne le
reste de cette configuration et ce que chaque ligne apporte.

### Travailler sur Svelthon lui-même

```sh
npm install
npm run dev          # la démo, sous /demo/

npm test             # sémantique, props, réactivité, surface Svelte, puis le contrôle du navigateur
npm run test:quiet   # la sortie de la suite : un run vert ne doit rien dire
npm run test:browser # le contrôle du navigateur seul : interop DOM, passe du gabarit et démo, dans un vrai Chromium headless
npm run test:hmr     # invalidation des modules virtuels, composant et store
npm run test:kit     # une appli SvelteKit construite avec adapter-node : routes, fonction distante
npm run test:all     # tout ce qui précède, dans l'ordre, arrêt au premier échec
npm run bench        # Python contre JavaScript, même composant, vrai navigateur
npm run build
```

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

Le détournement est nominatif : un corps de module peut en importer d'autres
pendant qu'il tourne, et chaque import crée son namespace par la même fonction.
Le motif attendu est seulement *vérifié* à la compilation : si un futur codegen
cessait de l'émettre, le build échoue bruyamment au lieu de livrer un composant
sans réactivité.

## L'API, et ce qu'elle remplace

Vingt et un noms, et rien à importer : ils sont injectés dans le namespace du
module. Chacun se tient là où se tient une rune en JavaScript.

Deux règles les gouvernent. Les **auxiliaires** s'effacent devant un composant qui
déclare un nom de cette orthographe, exactement comme un module Python qui
définit `list` masque le builtin. Les six qui sont les mots propres de Svelthon
(`derived`, `effect`, `bindable`, `export`, `inspect`, `inspect_with`) sont
**refusés** : redéfinir `effect` tient moins du masquage de `list` que de la
redéfinition de `def`, et Svelte trace la même limite en réservant le préfixe
`$`. Le refus a lieu à la compilation et nomme le coupable.

Une troisième liste n'est pas la nôtre, c'est celle de JavaScript. Un nom de
niveau module qu'il réserve (`default`, `new`, `static`, `enum`, `interface`,
`case` et les autres) ne peut recevoir aucune liaison dans le module généré : il
est refusé à sa ligne, avec le renommage que Python réserve à cette collision,
`new_`. À l'intérieur d'un `def`, le même mot est une variable locale ordinaire
et personne n'objecte.

Une quatrième est celle du compilateur : un nom qui commence par `__` sans finir
par `__` (`__cache`, et non `__all__`) est refusé partout où il est déclaré, dans
le script comme dans le gabarit, parce que le code généré construit ses propres
noms sur ce préfixe, dans la même portée.

| Python | Svelte 5 |
|---|---|
| `count = 0` | `let count = $state(0)` |
| `name: str` | `let { name } = $props()` |
| `size: int = 3` | `let { size = 3 } = $props()` |
| `value: str <=>` | `let { value = $bindable() } = $props()` |
| `value: str = bindable()` | `let { value = $bindable() } = $props()` |
| `doubled => count * 2` | `let doubled = $derived(count * 2)` |
| `@derived` sur un `def` | `$derived.by(…)` |
| `=> js.console.log(count)` | `$effect(() => console.log(count))` |
| `@effect` | `$effect(…)` |
| `@effect.pre` | `$effect.pre(…)` |
| `@effect.root` | `$effect.root(…)` |
| `def on_mount()` / `on_destroy()` | `onMount()` / `onDestroy()` |
| `set_context(k, v)` / `get_context(k)` | `setContext(k, v)` / `getContext(k)` |
| `props_id()` | `$props.id()` |
| `host()` | `$host()` |
| `inspect(*valeurs)` | `$inspect(…)` |
| `inspect_with(fn, *valeurs)` | `$inspect(…).with(fn)` |
| `@export` sur un `def` | `export function …`, ce qu'un parent atteint par `bind:this` |
| `f = export(lambda: …)` | `export const f = () => …`, le même, en une ligne |
| `to_js(valeur)` | *aucun*, un conteneur Python rendu lisible par JavaScript |
| `to_py(valeur)` | *aucun*, l'autre sens : une valeur JavaScript lue comme du Python |
| `tojson(valeur, indent=None)` | *aucun*, `to_js` avec la sérialisation attachée, sous le mot de Jinja |
| `from_json(texte)` | *aucun*, `to_py` avec l'analyse attachée |
| `batch(xs, n, fill)` | *aucun*, une liste plate groupée en lignes de `n`, la dernière complétée par `fill`, comme le `\|batch` de Jinja |
| `date(valeur, style)` | *aucun*, une date lue dans la langue du visiteur, comme le `\|date` de Django |
| `fromnow(valeur)` | *aucun*, « il y a 3 jours » ou « dans 2 heures », et ça reste juste |
| `slugify(texte)` | *aucun*, un titre transformé en segment d'URL, comme le `\|slugify` de Django |
| `striptags(html)` | *aucun*, du HTML affiché en texte, analysé et non filtré par motif |
| `urlencode(valeur)` | *aucun*, une valeur, un dict ou une liste de paires, encodés dans une URL |
| `js` | *aucun*, les globales JavaScript : `js.Response`, `js.JSON`, `js.URL` |
| `items.append(x)` | `items.push(x)`, puisque `$state` proxifie en profondeur |

La dernière ligne est la seule qui coûte du travail plutôt qu'un renommage,
voir [Réactivité](#réactivité--un-signal-par-nom) pour la façon dont une mutation
en place est attrapée sans proxy.

Il n'y a pas d'équivalent de `$state` à écrire, parce qu'il n'y a rien à
déclarer : une affectation au niveau du module *est* la déclaration, et le
compilateur la lit dans l'AST.

**Et c'est toute la règle : une rune vit au niveau module du script, et dans le
gabarit. Ce sont les deux endroits où le compilateur lit une déclaration.** Dans
le script il lit l'AST et ne descend jamais dans un `def` ni dans une `class`,
donc une rune écrite plus bas serait fabriquée et câblée à rien ; et une rune
sous un `if`, une boucle, un `try` ou un `with` serait câblée que le bloc ait
tourné ou non. Les deux sont refusées, avec leur ligne :

```
svelthon — a rune belongs at the top level of the module,
           and `@effect` is only read there (src/App.svelte:12)
```

La règle de Svelte est différente, et elle peut l'être : `$effect` est un vrai
appel qui lit le propriétaire courant à l'exécution, donc l'endroit où c'est
écrit leur est indifférent, seul le moment compte, ce qui explique leur propre refus,
`effect_orphan`, une fois le propriétaire disparu.

### Les six runes sans équivalent, et pourquoi

Svelte documente dix-sept formes de runes. Onze sont dans le tableau ci-dessus,
avec `$inspect(…).with(fn)`, qui est une méthode sur ce que `$inspect` rend
plutôt qu'une rune à part entière. Six sont absentes à dessein, et pour des
raisons différentes.

| Svelte | pourquoi non |
|---|---|
| `$state.raw` | Rien à refuser côté Python : un nom n'est jamais un proxy, tout nom de module est donc déjà brut ici, et un portage serait une fonction vide portant un nom. Une valeur qui traverse vers JavaScript est sa vue, un proxy comme un `$state` l'est, et `to_js(value)` est là le moyen d'en sortir. |
| `$state.snapshot` | `to_js(value)`, une copie de ce que JavaScript lit sinon à travers la vue : pour une API qui clone, une bibliothèque qui pose ses propres champs sur le tableau reçu, ou un gros jeu de données relu sans cesse. |
| `$state.eager` | Au service des expressions `await`, que Svelte garde lui-même derrière `experimental.async` et qualifie d'expérimental. Rien à refléter tant que ce n'est pas stabilisé. |
| `$effect.pending` | idem |
| `$effect.tracking` | Indique à l'auteur d'une *bibliothèque* si le code s'exécute dans un contexte suivi. Différée : aucun des 88 exemples de svelte.dev n'utilise une variante de `$effect`, et quatre utilisent `$effect` tout court. |
| `$inspect.trace` | Nomme ce qui a provoqué la réexécution d'un effet. Différée avec `$effect.tracking`, et pour la même raison. |

Deux des six ne feraient rien, deux attendent une fonctionnalité que Svelte n'a
pas stabilisée, et deux sont des outils de développement. Aucune n'est un oubli,
et chacune est mesurée plutôt que supposée.

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
`$` sur toute déclaration d'un composant**, dans toutes les portées, et le
codegen Brython ouvre sur `var $B = __BRYTHON__`. Un IIFE ne suffit pas ; il
faut un fichier que Svelte ne parse pas.

## Props : l'annotation est l'interface

Comme dans un dataclass : annoté, c'est public ; affecté, c'est interne.

```python
name: str          # prop requis
punct: str = "!"   # prop avec défaut
greeting = "Bonjour"   # état interne, invisible du parent
```

Un prop est lisible dès l'exécution du corps du module, une mise à jour du
parent traverse jusqu'au Python, et un prop requis non fourni vaut `None`, pas
`undefined`. Écrire dans un prop depuis Python le remplace jusqu'à ce que le
parent passe une nouvelle valeur : c'est la règle de Svelte pour les props non
`$bindable`.

Un parent Python donne à un enfant Python la valeur elle-même, une sous-classe
de `float` avec sa classe, et à un enfant JavaScript le nombre ou la chaîne de
JavaScript. `None` est l'absence pour l'un comme pour l'autre, le `undefined`
que passe un parent Svelte, et l'enfant lit donc son défaut ; `javascript.NULL`
est une valeur, comme `null`. Le compilateur les distingue en lisant le fichier de l'enfant quand
l'import en nomme un. Tout autre enfant, venu d'un paquet, d'un alias de
chemin, d'un module qui le réexporte ou d'un namespace, sous un nom que le
script affecte, `Picked = Child if wide else Native`, un prop, un nom du
gabarit ou `<svelte:component this={…}>`, est départagé au chargement de son
module : un enfant écrit en Python le dit lui-même.

### Un prop qui remonte

Les props vont dans un sens, du parent vers l'enfant, et c'est ce qui garde un
flux de données lisible. `<=>` est la façon dont un composant dit qu'il accepte
d'écrire en retour :

```python
value: str <=>              # liable, sans repli
tag: str <=> "default"      # liable, avec repli
```

```svelte
<Field bind:value={text} />  <!-- lié : ce que l'enfant écrit atteint text -->
<Field />                    <!-- non lié : un prop ordinaire -->
```

Les deux côtés consentent : l'enfant déclare qu'il peut être lié, le parent
décide s'il lie. Sans `bind:`, une écriture dans l'enfant y reste.

C'est la quatrième liaison du dialecte, et elles forment un système autour du
même signe : `=` un nom vers une valeur, `=>` un nom vers une expression, `:=` un
nom lié depuis l'intérieur d'une expression, `<=>` un nom qui circule dans les
deux sens. La flèche sans nom, `=> expr`, n'en fait pas partie : rien à lier,
c'est un effet. `bindable()` marche toujours et veut dire exactement la même
chose.

La lecture d'un global passe par `$B.resolve_global`, qui exige une propriété
**propre** sauf si le namespace porte le drapeau `$proxy`, auquel cas il lit la
propriété normalement, donc en traversant le prototype. C'est le seul endroit de
Brython qui consulte ce drapeau, et c'est ce qui rend l'astuce du prototype
compatible avec les props.

### Un identifiant propre à l'instance

`props_id()` rend un identifiant qu'aucune autre instance du composant ne
partage, et qui est le même sur le serveur et dans le navigateur : l'hydratation
retrouve donc ce que le serveur a écrit.

```python
uid = props_id()
```

```svelte
<label for="{uid}-firstname">Prénom</label>
<input id="{uid}-firstname" type="text" />
```

Sans lui, un composant monté deux fois écrit `id="firstname"` deux fois : le
second libellé désigne le premier champ, donc le cliquer met le focus sur le
mauvais, et un lecteur d'écran annonce le mauvais nom. Même chose pour
`aria-labelledby` et `aria-describedby`.

## L'indentation, la seule chose qu'un `<script>` change

Dans un composant Svelte, le corps du script est le plus souvent indenté d'un
niveau à l'intérieur de sa balise, parce que c'est ce que le balisage autour
invite à faire. En JavaScript c'est de l'espace. En Python c'est de la syntaxe,
et un bloc indenté est une erreur.

Svelthon dédente donc le bloc, et **les deux compilent** :

```svelte
<script lang="python">
count = 0
</script>

<script lang="python">
    count = 0
</script>
```

C'est le `unindent` de Brython lui-même, celui qu'il applique déjà à chaque
`<script type="text/python">`, et non une règle à nous, pour que les deux
balises se comportent pareil. On retire de l'espace, jamais une ligne, donc les
messages d'erreur et les source maps continuent de pointer la ligne écrite.

Deux cas qu'il ne rattrape délibérément pas, parce que deviner serait pire
qu'échouer :

- **un bloc indenté à moitié.** Une seule ligne non vide déjà en colonne zéro et
  la source est laissée telle quelle, y compris le cas courant d'une chaîne
  triple dont le contenu commence à la marge.
- **un fichier `.py`.** Un fichier n'est pas un bloc encastré ; l'indenter est
  une faute, pas un confort.

Dans les deux, Python lève `IndentationError`, en sachant que Brython l'annonce
à la ligne *suivant* la dernière plutôt qu'à la ligne fautive, ce qui est un bug
de leur côté.

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
les noms du composant par les accesseurs du namespace, donc **Svelte découvre
leurs dépendances tout seul**, exactement comme pour `@derived`.

Le gabarit est donc du Python, sans aucun helper :

```svelte
{value is None}              {a and not b}           {len(rows)}
{"oui" if flag else "non"}   {rows[1:]}              {f"{n} éléments"}
{item.label}                 {mapping["key"]}        {[x.upper() for x in xs]}
```

`{item.label}` sur une instance fonctionne, et `{#if rows}` suit la vérité de
Python, donc une liste vide est fausse.

Tout site *lu* par le balisage passe par Python, pas seulement les
interpolations :

```svelte
{#each scores.items() as [k, v]}   <!-- un dict, un range, un générateur -->
  {half => (v - 7) // 2}           <!-- -4, là où JavaScript dirait -3,5 -->
{/each}
{#key point}                       <!-- un tuple par valeur, une liste ou une ligne par identité -->
{@html render(row)}
```

L'itérable d'un `{#each}` est évalué *hors* du bloc et sa clé *dedans* : chacun
est donc compilé avec les noms qu'il peut réellement voir. None ne parcourt rien
et montre le `{:else}`, comme Svelte avec `null` : une liste pas encore fournie
ne fait aucune ligne, là où le `for` de Python lèverait.

**Les directives prennent du Python aussi.** Un gestionnaire est un `lambda`,
`class:` se lit avec la vérité de Python, tout comme `bind:checked`,
`bind:indeterminate`, `bind:open`, `bind:muted` et `bind:paused` sur un
élément, None restant l'absence d'où Svelte lit l'élément ; une liaison nomme
quelque chose à quoi Python sait affecter :

```svelte
<input oninput={lambda e: on_text(e.target.value)} bind:value={row["label"]} use:action={opts} />
```

La règle : tout est du Python dans un gabarit, chaque attribut, prop de
composant compris, la valeur de chaque directive, ainsi que le raccourci `{nom}`
et l'étalement `{**attrs}`, développés pour que la lecture passe par le
namespace au lieu de le contourner, sans plus aucune exception. L'étalement
prend ce que prend le `{**attrs}` de Python, les entrées d'un mapping, et une
chose de plus : une instance, que Python refuse, donne ses attributs, comme
`vars()` les lit. None n'étale rien, comme Svelte n'étale rien de `null` :
`extra: dict = None` est une prop optionnelle qu'on fait suivre. Toute autre
valeur Python, une str ou un int entre autres, lève la `TypeError` de Python ;
un objet JavaScript s'étale par ses propriétés propres, comme en JavaScript.

`bind:group` était la dernière, et elle a pris une autre forme qu'une paire :
Svelte n'y accepte pas de lecteur et d'écrivain, parce qu'il détermine quels
`<input>` forment un groupe à partir du **texte** de l'expression. Elle compile
donc en action, et le groupe cesse d'avoir besoin d'une identité : chaque
`<input>` calcule son propre `checked` depuis la même cible. C'est aussi ce qui la
fait marcher sur un champ de dict, sur un attribut d'objet, et une fois par ligne
d'un `{#each}`, ce que la version de Svelte ne réussit ici dans aucun des trois
cas.

La liste d'un groupe de cases est **les cases cochées dans l'ordre du document**,
ce que la liaison de Svelte collecte elle-même, et non l'ordre des clics.

### Les deux choses à savoir

Un gabarit se lit comme du Python et veut dire ce que Python veut dire, à deux
exceptions délibérées près. Les deux existent pour que la ligne de tous les jours
tienne sur une ligne, et les deux méritent d'être sues avant d'écrire un
composant.

*(Le script a les siennes : `importjs`, `=>`, la flèche étant un dérivé quand
elle nomme et un effet quand elle ne nomme pas, et `<=>`. Toutes sont rassemblées
à la fin de cette section.)*

**Le point trouve une clé.** `{row.label}` lit un dict aussi bien qu'un objet,
exactement comme le point de Jinja : la forme de vos données cesse donc de dicter
celle de votre balisage, et un dict venu d'une API se rend comme un dataclass :

```svelte
{pep.title}                        <!-- un dict ou une instance, la même ligne -->
<input bind:value={row.label} />   <!-- et une liaison réécrit dans la clé -->
```

Un vrai attribut l'emporte toujours sur une clé de même nom, et un nom qui n'est
ni l'un ni l'autre lève au lieu de ne rien rendre. Dans le `<script>`, le même
texte reste du Python nu et lève : c'est une règle de gabarit, pas un changement
de langage. Elle suit le texte : une fonction du script reste du Python nu quand
le balisage l'appelle, et une lambda écrite dans le balisage garde la règle
quand elle s'exécute plus tard, en gestionnaire d'événement.

**Un nom que rien n'a lié est absent, pas une erreur, pendant que le gabarit se
rend.** Un nom du module affecté dans une branche qui n'a pas tourné, ou
supprimé, se lit `None` dans le balisage, comme le `undefined` de JavaScript
devient `None` partout où il entre en Python : `{total}` ne rend rien,
`{f"[{total}]"}` rend `[None]`, et `{total + 1}` lève la `TypeError` de Python à
sa ligne. Le code Python le lit comme Python, `NameError` : une fonction du
script, et un gestionnaire écrit dans le balisage, qui s'exécute au clic et non
pendant le rendu.

**Le morse affecte.** `onclick={() => (open = !open)}` est la ligne la plus
courante d'un gabarit Svelte, et Python n'en a pas d'équivalent court : un
`lambda` tient une expression, et `open = not open` est une instruction.
`(open := not open)`, elle, *est* une expression, la réponse de Python à ce
problème précis, et dans un gabarit elle écrit le nom du composant. Le Python
ordinaire y lierait un local qui meurt avec l'appel, PEP 572 liant dans la
fonction englobante et un `lambda` en étant une : la lecture habituelle n'y sert
à rien, et le gabarit lui donne la seule qui vaille :

```svelte
<button onclick={lambda: (open := not open)}>menu</button>
<button onclick={lambda: (count := count + 1)}>+1</button>
{#each tabs as one}
    <button onclick={lambda: (tab := one)}>{one}</button>
{/each}
```

Gestionnaires seulement : un rendu ne doit pas écrire d'état, et Svelte le dit
lui-même. Un `:=` sur un nom du composant ailleurs dans le gabarit est refusé à
sa ligne, là où Python lierait un nom à lui qui meurt avec l'expression.

C'est tout. Tout le reste est du Python tel qu'écrit : les opérateurs, les
tranches, les compréhensions, les f-strings, la vérité d'un objet qui définit
`__bool__`. Les enveloppes qui font qu'une valeur Python se comporte en valeur
Python dans le moteur de Svelte sont de la plomberie, et vivent dans
[notes/template.md](notes/template.md).

**Le langage du gabarit suit le langage du script, sans troisième mode.** Un
composant sans `lang="python"` est un composant JavaScript et le reste, même
s'il importe un store `.py` : son `{valeur}` est le `{valeur}` de Svelte, et une
liste Python s'y rend comme JavaScript la rend. Rien n'est injecté dans le dos de
l'auteur, exactement comme TypeScript ne fuit pas dans un fichier `.js`.

Ça coûte **1,3× à 1,7× sur le rendu** face à un composant JavaScript
(`npm run bench` ; l'écart entre les deux est ce qu'un portable modeste mesure
d'un jour à l'autre) : un appel Python par expression et par rendu. C'est le prix
du gabarit en Python.

### Tout le dialecte, en un tableau

Huit formes se lisent autrement que du Python nu, cinq dans le balisage et
quatre dans le script, la flèche nommée étant dans les deux, et il n'y en a pas
d'autres : tout le reste d'un composant est du Python qui veut dire ce que
Python veut dire.

| | Où | Se lit comme | Parce que |
|---|---|---|---|
| `{row.label}` | balisage | une clé autant qu'un attribut | la forme des données ne doit pas dicter celle du balisage |
| `(open := not open)` | balisage, gestionnaires seuls | une affectation dans une expression | `onclick={() => (open = !open)}` n'a pas de jumeau Python |
| `as {id, name}` | balisage, cible d'un `{#each}` | un dépaquetage par clé | Python dépaquette par position, et seul `match` le fait par clé |
| `importjs X from "…"` | script | un import JavaScript | un import est statique, et un mot-clé rend l'import calculé inécrivable |
| `doubled => count * 2` | script **et gabarit** | une valeur dérivée | à un caractère du `=` d'à côté, et ce caractère est la différence |
| `{x = 2}` | gabarit | de l'état, à portée du bloc | le signe que le script emploie déjà ; les `{let}` et `{const}` de Svelte sont des mots-clés JavaScript dans un fichier Python |
| `=> js.console.log(count)` | script | un effet | la même flèche sans rien à nommer, comme `f()` seul est `x = f()` sans rien à garder |
| `value: str <=>` | script | une prop qui remonte aussi | la quatrième liaison, et la seule qui devait s'écrire par un mot |

Un nom déclaré dans le gabarit est à la portée du bloc qui le contient, et
`bind:` l'écrit. `{brouillon = …}` déclare de l'état, et `{salut => …}` un
dérivé qui le suit, les deux signes que le script emploie déjà :

```svelte
{#if edition}
  {brouillon = user.nom}
  {salut => f"Bonjour {brouillon}"}

  <input bind:value={brouillon} />
  <p>{salut}</p>
{/if}
```

`:=` y est refusé : il écrit les noms du script, donc il en atteindrait un autre.
`bind:` est la façon d'écrire un nom déclaré par le gabarit.

Les quatre du script sont les seules lignes d'un composant que Python refuserait
de parser. Toutes quatre sont réécrites **sur la même ligne**, si bien que rien en
aval (numéros de ligne, tracebacks, source maps) ne peut faire la différence.
Un `.py` ordinaire n'a ni l'une ni l'autre : un module est du Python, et seul un
fichier qui a un gabarit porte le dialecte.

La troisième entrée du balisage est celle qui *prend* au lieu de *recouvrir*.
`{a, b}` est un ensemble dans une expression, mais une cible de `for` accepte un
nom, un tuple, une liste, jamais une accolade, si bien que `as {id, name}` ne
percute rien. Elle comble un trou au lieu de couvrir un sens, ce qui la rend
moins coûteuse que le walrus d'à côté :

```svelte
{#each cats as {id, name}, i}
    <a href="/watch?v={id}">{i + 1}: {name}</a>
{/each}
```

Chaque clé est lue par la règle du point : un dict et une instance se dépaquettent
de la même façon, et une clé que la ligne n'a pas lève l'`AttributeError` que
lève `{cat.nmae}` ; `name="anon"` lui donne plutôt un défaut, et `**rest` est le
dict des clés non nommées, comme dans un motif de mapping d'un `match` : les
autres entrées d'un mapping, comme `{**row}` les lit, les autres attributs d'une
instance, comme `vars(row)` les lit, les autres propriétés propres d'un objet
JavaScript, symboles compris, comme le reste de JavaScript les lit. Un écart à
Svelte s'ensuit : un symbole pris par une clé calculée sort du reste, là où le
dépaquetage de Svelte, qui exclut `String(clé)`, le garde. L'alternative épelle
deux fois la même chose : `{cat.id}`, `{cat.name}`.

Par position, un nom étoilé est celui de Python : `[first, *others]` fait
d'`others` une liste, où que soit l'étoile, comme `first, *others = row`, et une
ligne trop courte pour lui lève ce que lève Python. Sans étoile, les crochets
gardent la lecture de Svelte, où une valeur peut manquer ou être de trop : c'est
à cela que sert un défaut, `[first, second=0]`. `...` est l'Ellipsis de Python,
à laquelle rien ne s'affecte : `...rest` est refusé.

## Composition

Un composant Python n'a qu'un `<script>` d'instance. Les enfants s'importent
donc dans un `<script module>`, dont les déclarations restent visibles du
gabarit. Ce bloc est du JavaScript : `<script module lang="python">` est refusé,
en nommant le module `.svelte.py` qui partage l'état entre instances, parce
qu'un composant compile vers un seul module Python et que deux s'écraseraient :

```svelte
<script module>
    import Row from './Row.svelte';
</script>

<script lang="python">
rows = [Item("a", 1), Item("b", 2)]
</script>

{#each rows as r}<Row row={r} />{/each}
```

Un objet Python se passe en prop sans conversion, et se relit en Python :
attributs et descripteurs compris, puisque les expressions du gabarit sont
compilées en Python :

```svelte
{item.label}     <!-- attribut -->
{item.double}    <!-- @property, évaluée -->
```

## Valeurs dérivées et liaisons

Une valeur dérivée se calcule à partir d'autres et se recalcule quand elles
changent. Elle s'écrit avec `=>`, à un caractère de l'affectation d'à côté :

```python
count = 0            # état : une valeur
doubled => count * 2 # dérivé : un calcul
```

Ce caractère est toute la différence, et la symétrie est voulue. Rien ne déclare
que `count` est un état : une affectation nue le dit déjà, et le compilateur la
lit dans l'AST. Si nommer n'est pas nécessaire là, ça ne l'est pas non plus ici,
c'est l'argument pour un opérateur plutôt qu'un mot.

C'est aussi la flèche de JavaScript, et c'est bien ce qu'un dérivé est : une
expression réévaluée, pas une valeur calculée une fois.

`=>` est une `SyntaxError` en Python, donc aucune source valide n'en contient
hors chaîne ou commentaire. Il est réécrit en
`doubled = derived(lambda: (count * 2))` **sur la même ligne**, si bien que les
numéros de ligne, les tracebacks et les source maps sont intacts, et un `=>`
dans une chaîne ou un commentaire est laissé tel quel. Les parenthèses gardent
ce que `=` lirait : `pair => a, b` est le tuple. Un `:=` dans la flèche est
refusé, puisqu'il lierait son nom dans la lambda.

**Pour tout ce qui demande des instructions, `@derived` décore une fonction :**

```python
first = "Ada"
last = "Lovelace"

@derived
def full():
    return f"{first} {last}"
```

Les deux formes sont la coupure de Svelte, pas une invention à nous :

| Svelte | Svelthon |
|---|---|
| `let x = $derived(expr)` | `x => expr` |
| `let x = $derived.by(() => { … })` | `@derived` sur un `def` |

et Python trace déjà la même ligne entre `lambda` et `def` : il n'y a rien de
neuf à apprendre. `=>` appartient au composant, là où vit le dialecte ; un `.py`
ordinaire écrit `@derived` et continue de parser comme du Python.

La même flèche sans nom à sa gauche est un effet, voir [Effets](#effets).

`{full}` dans le gabarit, `full` en Python. Le corps s'exécute dans
`$derived.by`, et chaque global qu'il touche passe par un accesseur du
namespace : **Svelte découvre les dépendances tout seul**, rien à déclarer. Un
dérivé peut en lire un autre. Il doit être **pur** : écrire de l'état dans un
dérivé est refusé par Svelte, à juste titre.

Écrire le nom lui-même est l'écriture de Svelte dans son dérivé : après
`doubled = 99`, le nom vaut `99` jusqu'à ce que change ce que le corps a lu, puis
de nouveau son résultat. Seule la déclaration installe le corps, et une fonction
écrite là est une valeur comme une autre. Le nom d'un `@effect` écrit de nouveau
change de valeur, et l'effet garde le corps qu'il a déclaré. Ce que le module
écrit dans le nom sur les lignes de la déclaration appartient à la déclaration,
la dernière écriture étant son corps, puisque Python lie le nom en dernier : une
déclaration tient donc sur ses propres lignes.

`bind:` doit lire *et* écrire, ce qu'aucune expression ne fait seule : sa valeur
est donc compilée deux fois, en expression puis en cible d'affectation, pour
former la paire que Svelte accepte précisément pour ça
(`bind:value={() => v, (n) => v = n}`). C'est ce qui fait marcher
`bind:value={row.label}` sur un dictionnaire : le point trouve la clé à l'aller
et y écrit au retour.

`bindable()` sur une annotation déclare un prop bidirectionnel : l'enfant peut y
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
suivent le retour d'`init()` sont de vraies écritures. Le défaut est la valeur de
repli de Svelte : chaque fois que le parent laisse le prop à `undefined`, lié ou
passé, l'enfant relit son défaut ; un enfant qui écrit `None` dans un prop que
son parent lie relit donc son défaut, comme un enfant Svelte qui écrit
`undefined`. Un parent qui lie `undefined` à un prop qui a un défaut est refusé
au montage de l'enfant, par le contrôle de Svelte (`props_invalid_value`).
`bindable()` et `bindable(None)` ne déclarent aucun défaut, comme `$bindable()`
et `$bindable(undefined)`.

## Réactivité : un signal par nom

Le namespace n'est **pas** un proxy `$state`. Svelte proxifierait alors chaque
valeur Python qu'on y range, et un objet Brython proxifié échoue à ses propres
vérifications de type : `repr((1, 2))` lève « descriptor `__repr__` requires a
'tuple' object but received a 'tuple' ». À la place, chaque nom de niveau module
reçoit son propre `$state.raw`, publié vers Brython par un accesseur : les
valeurs Python restent opaques à Svelte.

Réaffecter un nom est réactif, et muter un conteneur en place l'est aussi :

```python
count += 1          # réactif : réaffecte `count`
items = items + [x] # réactif : réaffecte `items`
items.append(x)     # réactif : l'objet le signale lui-même
table["k"] = v      # réactif
```

Le second signal explique comment. Chaque nom porte une valeur **et** un compteur
de révision, et l'accesseur lit les deux, donc tout lecteur dépend aussi du
compteur. Une mutation n'incrémente que lui : rien n'est copié, et l'objet garde
son identité.

Détecter la mutation est l'autre moitié, et c'est là que Python paie. Svelte
proxifie la valeur en profondeur, ce qui est inutilisable ici : un objet Brython
proxifié échoue à ses propres vérifications de type. Un objet surveillé reçoit
donc une marque tenue hors de lui, dans une `WeakMap` : l'objet reste celui que
Brython a construit, `type(items) is list` reste vrai et `repr` est intact. Et
Brython fait passer chaque écriture par une poignée de fonctions : appel de
méthode, écriture et lecture indicées, lecture et écriture d'attribut,
affectation augmentée, `del`, et le descripteur d'un slot : **onze points de
répartition couvrent tout le langage**, et un objet non marqué ne paie qu'un
accès manqué à la `WeakMap`.

La marque suit l'objet, ce qu'aucune analyse à la compilation ne saurait
faire :

```python
def fill(target):
    target.append("x")   # le compilateur ne voit rien ici

def add():
    fill(items)          # réactif quand même
```

L'imbrication tombe de la même marque. Un conteneur lu **hors** d'un conteneur
surveillé passe sous la même garde, ce que la proxification profonde achète à
Svelte, obtenu paresseusement et sans un seul proxy : l'enfant est marqué la
première fois que Python le saisit, c'est-à-dire nécessairement juste avant de
pouvoir le muter.

```python
data = {"rows": []}
data["rows"].append(x)   # réactif : lire data["rows"] l'a mis sous garde
```

Mesuré sur `$B.$getitem`, le plus chaud d'entre eux : **+4 % sur
`xs[i]`**, et +4 % encore quand la marque voyage réellement.

Les attributs marchent pareil, par `$setattr`, `$setattr1` et `$delattr`, et
`{#each}` passe la garde à ses lignes, si bien que le bloc d'une ligne s'abonne à
la ligne elle-même. Ce qui referme le cas qui surprenait : dans un
`{#each items as it (it.id)}`, `it.label = "…"` re-rend la ligne **et** garde son
nœud DOM, puisque la clé n'a pas bougé.

Où on en est, chaque ligne tenue par un test :

| | propage |
|---|---|
| `items.append(x)`, `table[k] = v`, `del table[k]`, `tags.add(x)` | oui |
| `data["rows"].append(x)`, un conteneur imbriqué | oui |
| `box.value += 1`, `del box.extra`, un attribut d'instance | oui |
| `box.rows.append(x)`, un conteneur tenu dans un attribut, même posé dans `__init__` | oui |
| `it.label = …`, un élément d'une liste à clé | oui |
| une mutation faite dans une fonction que le compilateur ne voit pas | oui |
| à travers un `@derived` qui rend l'objet, ou un prop de composant | oui |
| un enfant atteint par `.items()`, `.values()` ou `.get()` | oui |
| `<p {**attrs}>`, un étalement | oui |
| `<p title={items}>`, un attribut portant le conteneur lui-même | non, **et JavaScript non plus** |
| `store.rows.push(x)`, le conteneur d'un store muté depuis JavaScript | non, **et `store.rows = [...]` si** |

Le premier `non` est la sémantique de l'hôte, pas une limite à nous : Svelte
compare la valeur à celle qu'il a appliquée la fois d'avant, par identité, dans
son propre écrivain DOM, où aucun signal n'atteint, et un conteneur muté est le
même objet. Un composant Svelte idiomatique avec `$state` se comporte exactement
pareil, ce que `tests/parity.test.js` démontre en faisant tourner le même
composant dans les deux langages, ligne pour ligne.

Le second est la frontière du mécanisme. Le suivi enveloppe les points d'entrée
de Brython, `call_attr`, `$setitem` et `$delitem`, donc une mutation écrite en
Python notifie où qu'elle soit écrite, et `Array.prototype.push` appelé depuis
JavaScript passe à côté des trois. Remplacer le conteneur notifie, puisque ça
passe par le setter du store ; la mutation Python suivante rattrape la vraie
valeur. `tests/store-from-javascript.test.js` tient les deux moitiés.

Toutes les autres lignes propagent, et chacune est tenue par un test.

Les accesseurs vivent sur le **prototype** du namespace, jamais sur l'objet
lui-même : réaffecter un global émet `$B.delete_for_reassign(name, locals)`, et
un `delete` sur un accesseur propre le supprimerait définitivement : le signal
se débranchait silencieusement après la première écriture.

## HMR

Le code généré d'un composant vit dans un module virtuel, une entrée distincte
du graphe Vite, que rien ne relie au `.svelte` qui l'a produit. Sans
invalidation explicite, éditer le Python re-transforme le composant tout en
continuant de servir **l'ancien corps généré** : la page se met à jour vers du
code qui n'a pas changé. Le hook `hotUpdate` du plugin invalide les deux modules
virtuels du composant, et `npm run test:hmr` le vérifie sur les deux chemins.

Un store passe par un chemin différent, `load()` plutôt que le préprocesseur,
et souffrait du même mal en pire : son propre module `.svelte.js` devait être
invalidé lui aussi, faute de quoi son `load()` ne rejouait jamais et le cache
gardait l'ancien corps.

## Deux sortes de `.py`, comme TypeScript a deux sortes de `.ts`

Svelte trace déjà cette ligne pour TypeScript, et Python la suit sans rien
changer :

| TypeScript | Python | compilé en |
|---|---|---|
| `outils.ts` | `outils.py` | un module JavaScript ordinaire |
| `panier.svelte.ts` | `panier.svelte.py` | un module réactif : ses noms deviennent des signaux |
| `+page.server.ts` | `+page.server.py` | un module ordinaire, ce qu'est un module de route |

Rien ici n'est de notre invention. Un `.ts` ne devient réactif que nommé
`.svelte.ts`, et le marqueur ne fait pas partie du nom du module :
`panier.svelte.py` s'importe depuis Python par `import panier`.

**Un module ordinaire** est du Python compilé en JavaScript, et rien d'autre.
Pas de rune, pas de signal, aucun coût pour une réactivité dont il ne fait rien.
Ses fonctions sont ses exports ; `__all__` dit autre chose quand on le souhaite :

```python
# peps.py
__all__ = ["chercher", "trouver"]

def chercher(requete=""):
    return [p for p in CATALOGUE if requete in p["titre"]]

...
```

`__all__` est la façon dont Python dit lui-même ce qu'un module exporte, et c'est
ce qu'il a de plus proche du mot-clé `export` de TypeScript. JavaScript importe
ces noms directement :

```js
import { chercher } from '$lib/peps.py';
```

Il nomme tout ce que le module lie, et pas seulement ce qu'il affecte : une
classe, une constante, une fonction, un nom amené par un import. Et un nom qu'il
invente est refusé à la compilation, puisqu'un module exporte ce qu'il définit,
ou une fois le module exécuté quand un `from m import *` aurait pu l'amener.

Un nom exporté est vivant, comme un `export let` de JavaScript : relié par le
module, il se lit à sa nouvelle valeur, une fonction devenue nombre comme ce
nombre, et supprimé comme `undefined`. Une fonction qu'un lecteur a déjà prise
reste celle qu'il a prise, comme `from m import f` la garde dans CPython, et la
même fonction réécrite reste le même objet. Une liste, un dict, un set ou une
instance est l'objet même du module, comme `m.items` en Python : modifié sur
place par le module, `items.append(2)` ou `thing.count = 1`, il l'est pour
l'importateur, et une écriture depuis JavaScript est celle du module. Ce qu'une
fonction rend à JavaScript traverse de la même façon, l'objet lui-même et non une
copie. Un set se lit comme un `Set` JavaScript, comme le `SvelteSet` de Svelte, et un dict dont
une clé est un objet JavaScript nomme cette clé par son `toString` à son entrée,
comme un objet JavaScript nomme une clé quand on l'écrit : le seul nom qu'il ne
peut pas avoir est celui qu'une clé donnait avant que la vue ne regarde. Des
bytes se lisent comme un `Uint8Array`, ce que prennent un `Blob`, un corps de `fetch` ou un
`TextDecoder`. Celui-là est une copie, puisqu'une API web ne prend aucun objet
vivant pour des octets : d'un `bytearray`, les octets qu'il contient quand il
traverse, repris quand Python le modifie ; un octet que JavaScript écrit dans la
copie n'est à Python qu'une fois la copie rendue. Une instance se lit par ses
attributs, appelle ses méthodes et s'affiche par son `__str__`, comme une classe
JavaScript s'affiche par son `toString`, depuis un import, depuis un enfant
JavaScript qui la reçoit en prop et depuis un objet JavaScript où Python l'a
écrite. Le `@derived` d'un `.py` ne s'exporte
pas : c'est un appel fait à chaque lecture, qu'un export figerait à sa première
valeur. Un `__all__` qui en nomme un est refusé, comme Svelte refuse d'exporter
un état dérivé depuis un module ; on exporte une fonction qui le rend.

**C'est la valeur sur laquelle le module s'arrête, telle que Python la
calcule.** Chaque instruction du niveau du module qui l'écrit, avec des
littéraux, `__all__`, leurs méthodes (`"a b".split()`) et les builtins qui ne
font que lire, `sorted` ou `list`, est exécutée par Python avant le module, au
build : une deuxième affectation remplace la première, `+= "bc"` ajoute `b` et
`c`, `del __all__[0]` et `.sort()` font ce qu'ils font, et `.append()` sur un
tuple est refusé avec l'erreur que Python lève. Ce que la source ne décide pas
ne peut pas se lire avant que le module tourne, et est refusé plutôt qu'ignoré
en silence : `__all__ = sorted(noms)`, une modification sous un `if`, dans une
boucle ou dans une fonction. Un attribut d'un builtin, `str.mro()`, ou écrit
avec `_`, `().__class__`, l'est aussi : il mène d'un littéral aux classes qui
sont derrière, dans le processus qui construit. La liste passée ailleurs aussi,
`noms = __all__` ou `list.clear(__all__)`, puisque ce qu'on en fait ensuite
échappe à la lecture ; `list(__all__)` en donne une copie à manipuler.

**Une fonction rendue par un appel `importjs` est la fonction elle-même**, et
c'est ce qui fait marcher les fonctions distantes de SvelteKit depuis Python :
`accepted = query(…)` dans un `.remote.py` garde, et exporte, l'objet que le
`query()` de SvelteKit a fabriqué. Ce qu'un framework reconnaît par identité le
reste en traversant.

**Un `remote.py` ou un `*.remote.py` est un seul module**, son corps exécuté au
chargement et rien d'exporté par défaut, comme un module de route que SvelteKit
charge quand il le décide. SvelteKit prend un module pour un module de
fonctions distantes d'après son nom, un `/` ou un `.` puis `remote.`
(`/[/.]remote\.[^/]+$/`), et y refuse un export par défaut ; tout autre `.py` a
une seconde moitié, que lance un `import` Python.

**Là où l'on s'écarte de CPython**, avec SvelteKit ou sans lui : un module nommé
`remote.py` ou `*.remote.py` exécute son corps à son chargement, et non à
l'instruction `import`, parce que SvelteKit en fait un module distant d'après
son nom. `import remote` sous un `if` non pris l'exécute quand même.

**Un module réactif le lit aussi.** `__all__` dans un `.svelte.py` dit ce que le
store publie, exactement comme dans un `.py` ; sans lui, le store publie tous les
noms qu'il a.

**Un module réactif** est celui de l'état partagé. Ses noms de niveau module
deviennent des signaux créés **une fois pour toute l'application**, là où l'état
d'un composant naît et meurt avec chaque instance :

```python
# counter_store.svelte.py
count = 0
history = []

def increment():
    global count
    count += 1
    history.append(count)
```

```svelte
<script module>
    import { store } from './counter_store.svelte.py';
</script>

<p>{store.count} / {store.history}</p>
<button onclick={store.increment}>+</button>
```

Lu depuis JavaScript, un scalaire est celui de JavaScript, donc un prix de
`0.25` est le nombre `0.25`, un conteneur est l'objet Python lui-même, dont
la page suit les mutations, et une fonction Python s'appelle comme celles du
store, qu'elle y soit définie ou importée.

Ses runes sont compilées par vite-plugin-svelte, dont on élargit le filtre de
modules à l'extension : un réglage, et c'est la forme que ce filtre avait déjà
pour `.svelte.ts` :

```js
svelte({
    preprocess: [python()],
    experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
})
```

Le filtre est un infixe, `.svelte.`, suivi d'une de ces extensions, donc
`panier.svelte.py` correspond et `peps.py` non : exactement la ligne que tracent
les deux sortes. Les noms sont exportés par des accesseurs : Svelte interdit
d'exporter une liaison `$state` réaffectée, et un getter est de toute façon ce
qui garde la lecture réactive au point d'appel. Un nom propre au module peut
s'écrire `store` : JavaScript le lit comme `store.store`, et une fonction de ce
nom n'est pas en plus exportée par son nom, puisque `store` est l'objet.

Le pont marche dans les deux sens : le Python d'un composant importe le module
comme un module Python ordinaire et atteint les mêmes signaux.

```python
import counter_store

def bump():
    counter_store.increment()
    return counter_store.count
```

`import counter_store` cherche `counter_store.svelte.py`, puis `counter_store.py`,
dans le répertoire du fichier importateur puis le long de
`python({ path: [...] })`, qui joue le rôle de PYTHONPATH. Le module virtuel de
l'importateur importe son code en premier, si bien qu'il est à portée de main, et
son corps s'exécute à l'instruction `import`, comme en CPython : un import sous un
`if` non pris ou dans une fonction jamais appelée n'exécute rien, et l'exception
du module est levée là où un `except` peut la prendre. Le namespace est alors
publié dans `$B.imported` sous son nom de module.

## Effets

Un effet rejoue quand un nom qu'il a *lu* change. Rien à déclarer : les globals
passent par les accesseurs du namespace, donc leurs lectures sont des lectures de
signaux et Svelte en déduit seul les dépendances.

Un effet ne doit donc pas modifier ce qu'il lit. `history.append(count)` lit
`history` pour trouver la liste, puis la modifie : l'effet rejoue sur sa propre
écriture, encore et encore, jusqu'à ce que Svelte l'arrête avec
`effect_update_depth_exceeded`. Svelte a le même piège avec
`history.push(count)` ; en Python il se voit moins, puisqu'`append` ne ressemble
pas à une lecture.

C'est la même flèche qu'un dérivé, sans rien à nommer :

```python
count = 0

doubled => count * 2         # dérivé : on garde la réponse
=> js.console.log(count)     # effet  : on ne la garde pas
```

Un dérivé et un effet sont un seul mécanisme vu deux fois : tous deux rejouent
sur le même signal, et ne diffèrent que par le fait que quelqu'un garde la
réponse ou non. Python trace déjà cette ligne sans symbole : `x = f()` garde,
`f()` seul est fait pour l'effet, donc la flèche la trace pareil, et le nom
absent se trouve en tête de ligne, à la colonne où l'œil vient chercher un nom.

Svelte 4 écrivait les deux `$:` et Svelte 5 les a séparés, parce qu'une
instruction `$:` ne montrait pas si elle calculait ou si elle agissait. Trois de
leurs quatre raisons portaient sur l'analyse statique et ne nous atteignent pas :
ici les dépendances viennent des accesseurs du namespace, à l'exécution, pas de
la lecture du source. La quatrième est cette lisibilité, et la première colonne y
répond.

**Pour tout ce qui demande des instructions, `@effect` décore une fonction**, la
flèche porte une `lambda`, donc une expression, et un effet qui affecte a besoin
du décorateur :

```python
@effect
def watch():
    global seen
    seen = f"count={count}"

    def cleanup():
        ...
    return cleanup     # nettoyage optionnel, avant chaque reprise et au démontage
```

**Tout appelable Python est un nettoyage**, pas seulement un `def` :
`return resource.close` rend une méthode liée, et une instance portant
`__call__` marche pareil. C'est la forme que prennent la plupart des nettoyages
réels.

| Svelte | Svelthon |
|---|---|
| `$effect(() => expr)` | `=> expr` |
| `$effect(() => { … })` | `@effect` sur un `def` |
| `$effect.pre(…)` | `@effect.pre` |
| `$effect.root(…)` | `@effect.root` |

**Le piège que ce modèle crée** : `runs += 1` sur un nom de niveau module *lit*
avant d'écrire, donc un compteur incrémenté dans un effet le rend dépendant de ce
qu'il écrit, et Svelte boucle jusqu'à `effect_update_depth_exceeded`. Une
affectation simple ne lit rien.

### Avant le DOM, et hors d'un composant

`@effect.pre` est le même effet, joué **avant** la mise à jour du DOM, pour ce
qui doit lire une mise en page avant que ce dont elle dépend ne change, le
défilement automatique étant le cas canonique.

`@effect.root` ouvre une portée à lui. Rien ne la nettoie, et c'est justement le
but : **le nom décoré reçoit le destructeur**, exactement comme JavaScript nomme
la valeur que l'appel rend.

```python
@effect.root
def destroy():
    js.console.log(count)

destroy()          # y met fin, le composant étant toujours vivant
```

```js
const destroy = $effect.root(() => { $effect(() => { … }); });
destroy();
```

Une portée et un moment sont deux choses différentes, donc les deux se
composent, ce que l'empilement dit en Python, et ce que l'imbrication dit en
JavaScript :

```python
@effect.root
@effect.pre
def destroy():
    ...
```

### Ce que chaque fichier peut porter

Un effet a besoin de deux choses : des signaux à lire, et un propriétaire à qui
appartenir. Les trois sortes de fichiers les ont à des degrés différents, et
chaque restriction ci-dessous est l'une des deux.

| | `.svelte` | `.svelte.py` | `.py` |
|---|---|---|---|
| a des signaux | oui | oui | non |
| appartient à un composant | oui | non | non |
| état | `count = 0` | `count = 0` | une variable ordinaire |
| dérivé, forme courte | `x => expr` | `x = derived(lambda: …)` | *aucun* |
| dérivé, forme longue | `@derived` | `@derived` | `@derived` → une fonction appelée à chaque lecture |
| effet | `=> expr`, `@effect`, `@effect.pre`, `@effect.root` | `@effect.root` seul | aucun |
| props | `name: str` | deviennent de l'état | deviennent de l'état |

Un `.svelte.py` n'a pas de composant, donc un `@effect` n'y appartiendrait à
personne : `@effect.root`, qui se possède lui-même, est la forme qu'écrit un
module. Un `.py` ordinaire n'a aucun signal, donc aucun effet n'y observerait
quoi que ce soit. Les deux sont refusés par un message, plutôt que transformés en
fonction ordinaire.

## Éléments personnalisés

Un composant qui déclare `<svelte:options customElement="…">` est compilé en
élément personnalisé : il se pose dans n'importe quelle page HTML, sans Svelte
autour, son script restant du Python.

```svelte
<svelte:options customElement="my-stepper" />

<script lang="python">
count = 0


def bump():
    global count
    count += 1
    host().dispatchEvent(js.CustomEvent.new("stepped", to_js({"detail": count})))
</script>

<button onclick={bump}>{count}</button>
```

```html
<my-stepper></my-stepper>
```

Ses props sont ses noms annotés, observés comme attributs et exposés comme
propriétés, et chaque attribut arrive dans le type que nomme son annotation :
`start: int` lit `start="5"` comme `5`, `tags: list` lit un tableau JSON. Un
`bool` suit HTML, comme en Svelte : un attribut présent est vrai, quelle que
soit sa valeur. Une propriété que la page remet à `undefined` relit son défaut,
comme celle d'un élément Svelte, `15.0` tel que Python l'a écrit.

`host()` est la sortie, et la seule : un élément personnalisé parle à la page par
des événements DOM et non par des props. Sans lui, un composant pourrait recevoir
et afficher, jamais répondre.

Il n'est lié que là où il est lu, parce que Svelte refuse `$host()` dès la
compilation dans un composant qui n'est pas un élément personnalisé.

## Débogage

`inspect(count, message)` est un `console.log` qui se rejoue tout seul : il
imprime dès que l'une des valeurs données change, les suit en profondeur, et la
compilation de production le supprime entièrement.

```python
count = 0
message = "hello"

inspect(count, message)
```

```
0 'hello'      au montage
1 'hello'      après un changement de count
```

Un argument par valeur, comme chez Svelte.

Pour remplacer le journal, `inspect_with` prend l'appelable en premier :

```python
def record(kind, *values):
    js.console.table(values)


inspect_with(record, count, message)
```

Le rappel reçoit `"init"` ou `"update"`, puis les valeurs, et il est rogné aux
paramètres qu'il déclare : `def record(kind)` est appelé avec un argument, pas
trois. Svelte l'écrit `$inspect(x).with(fn)`, ce que Python ne sait pas
orthographier : `with` est un mot-clé, et `with=` n'est pas non plus un nom
d'argument valide. Mettre l'appelable devant, c'est là que Python le met dès que
la position ne suffit plus : `map(fn, *iterables)`, `filter(fn, it)`,
`reduce(fn, it)`.

À noter qu'un rappel ne peut pas écrire dans l'état du composant : Svelte
l'interdit depuis un `$inspect` comme depuis un `$derived`, ce qui est la raison
pour laquelle un journal journalise ailleurs.

`{@debug user}` en est le pendant dans le balisage, et il est porté : chaque nom
est lu comme Python le lit, et une liste ou un dict modifiés sur place sont
journalisés de nouveau, comme Svelte journalise un état qu'il suit.

## Cycle de vie

Par convention de nom, adossé à un unique `$effect` :

```python
def on_mount():
    ...   # après que le DOM existe

def on_destroy():
    ...   # au démontage, l'état final encore lisible
```

Ce que rend `on_mount` est son nettoyage, comme avec `onMount` de Svelte : une
fonction rendue là s'exécute au démontage, avant `on_destroy`. L'un comme
l'autre peut être un `async def`, qui est démarré, ou toute valeur que le nom
tient une fois le script exécuté, quelle que soit sa liaison : `on_mount =
lambda: …`, une prop, un nom importé de JavaScript par le script ou par le
`<script module>`.

Les deux restent des fonctions ordinaires, Python peut les appeler aussi. Elles
s'exécutent **hors suivi** (`untrack`) : un hook lit les noms du composant à
travers les accesseurs du namespace, et ces lectures *sont* des lectures de
signaux. Sans ça, un `mounts += 1` dans `on_mount` ferait dépendre l'effet d'un
état qu'il écrit, et Svelte boucle jusqu'à `effect_update_depth_exceeded`. La
fonction de nettoyage est capturée pendant que le composant est vivant : lire un
signal depuis un teardown déjà détruit ne rend plus rien.

Chaque instance a son propre namespace : le corps du module Python est
ré-exécuté à chaque montage, défauts mutables compris.

## Asynchrone

Un handler `async def` s'exécute. Appeler une telle fonction depuis JavaScript
rend une coroutine que personne n'exécute : l'enveloppe la confie donc à la
boucle d'événements de Brython.

```python
from browser import aio

rows = []

async def load():
    global rows
    await aio.sleep(0)      # ou aio.get(...) pour une vraie requête
    rows = ["…"]
```

`@effect` sur un `async def` s'exécute aussi, comme Svelte exécute
`$effect(async () => …)` : ce qu'il lit **avant son premier `await`** est ce qu'il
suit, et rien de ce qu'il rend n'est pris pour un nettoyage.

## Contexte

`set_context` et `get_context` sont injectés dans chaque composant, comme
`derived` et `effect`. Les deux doivent s'exécuter pendant l'initialisation
d'une instance, soit exactement au moment où tourne le corps du module Python,
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
d'une requête à l'autre, contrairement à un store, dont l'état vit dans le
module.

## Source maps

Brython parsème son code généré de `$B.set_lineno(frame, N)` : le JavaScript
produit porte donc la ligne Python dont chaque instruction provient. De quoi
émettre une source map de niveau ligne avec chaque module virtuel : le débogueur
ouvre alors le fichier `.svelte` ou `.py`, et non mille lignes de JS généré.

Niveau ligne, pas colonne : une ligne Python correspond à la suite de lignes
générées qui l'implémentent. Un test décode la carte et vérifie qu'une
instruction connue atterrit sur sa vraie ligne, une carte qui pointe à côté
étant pire que pas de carte du tout.

## SvelteKit

Une dépendance, pas un fork. SvelteKit délègue les `.svelte` à
vite-plugin-svelte, qui applique le préprocesseur déclaré dans
`svelte.config.js`, et notre plugin Vite se met à côté de `sveltekit()`. Un seul
réglage est nécessaire, et c'est un réglage que SvelteKit prévoit pour ça :

```js
// vite.config.js : en SvelteKit 3, tout se configure d'ici
export default defineConfig({
    plugins: [
        svelthon(),
        sveltekit({
            preprocess: [python({ path: ['src/lib'] })],

            // un module de route peut être en Python
            moduleExtensions: ['.js', '.ts', '.py'],

            // et un module réactif est compilé comme un `.svelte.ts`
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
        })
    ]
});
```

Le routeur voit alors les modules de route en `.py`. Ce qui marche, mesuré sur un
build de production avec `adapter-node`, contre **SvelteKit 3** :

| | |
|---|---|
| `+page.svelte`, `+layout.svelte`, `+error.svelte` | en Python, rendus côté serveur puis hydratés |
| `+page.server.py`, `+layout.server.py` | `load()` en Python, ses données fusionnées comme d'habitude |
| `async def load()` | attendu par le framework |
| streaming | une coroutine dans les données rendues devient une promesse que SvelteKit diffuse |
| options de page | `prerender`, `ssr`, `csr`, exportées par `__all__` |
| cookies, `setHeaders` | par `event["js"]`, sans aucun pont de notre part |
| `handle`, `handleError` | en Python, derrière une amorce JavaScript de deux lignes |
| `reroute`, `handleError` client | de même, hooks universels et client |
| layouts imbriqués | un `+layout.server.py` par niveau, données fusionnées |
| `+page.py` | un `load()` universel : serveur, puis navigateur lors d'une navigation client |
| `+server.py` | un endpoint entièrement Python, qui construit sa `Response` |
| actions de formulaire | `actions = {"default": noter}`, avec `await request.formData()` |
| `error()`, `redirect()`, `fail()` | appelés depuis Python |
| routes dynamiques | `event["params"]["numero"]` |
| un `.py` importé depuis JavaScript | par ses exports nommés |

Le streaming tombe de la même règle. Une coroutine rendue au framework devient
une promesse, et ce vers quoi elle résout fait la même traversée :

```python
async def _lentes():
    await js.Promise.new(lambda ok, ko: js.setTimeout(ok, 400))
    return chercher("", "Final")[:5]

def load(event):
    return {"immediat": compter(), "lentes": _lentes()}   # diffusé
```

Python y attend une promesse JavaScript, ce qui marche parce que c'est la boucle
d'événements de Brython qui exécute la coroutine. Seul un `load()` **serveur**
diffuse ; un load universel se rejoue dans le navigateur, ce qui est la règle de
SvelteKit, pas la nôtre.

Les options de page marchent comme partout ailleurs, ce qui a une conséquence
qui mérite d'être nommée :

```python
__all__ = ["load", "csr"]

csr = False

...
```

Cette page n'envoie **aucun JavaScript**, donc pas de Brython non plus. Un
composant écrit en Python, livré en HTML nu. Avec `prerender = True` à la place,
le Python tourne au build et la page est un fichier sur disque.

### Les deux ponts

Python ne sait pas importer depuis npm. Un **composant** le déclare avec
`importjs`, dans le même script que le reste de son Python :

```python
importjs Star from "#lib/Star.svelte"
importjs {fade, fly} from "svelte/transition"
importjs * as Dialog from "#lib/ui/dialog"
importjs Player, {stopAll} from "#lib/Player.svelte"
importjs "./theme.css"
```

La clause est celle de JavaScript, puisque le mot-clé a déjà dit de quel langage
il s'agit : rien de neuf à apprendre, et aucune ambiguïté à inventer entre un
import par défaut et un import nommé. `Star` est ensuite un composant que le
balisage emploie et un nom que Python lit.

**L'appel convertit dans les deux sens.** Un appelable Python passé à une
fonction JavaScript traverse en fonction JavaScript, et ce qui revient traverse
en sens inverse : `cubicOut(0.5)` est un `float` Python qu'on arrondit et qu'on
formate, pas un nombre étranger. La conversion est délibérément conservatrice :
un objet ordinaire, un tableau et une promesse ressortent intacts, de sorte
qu'une valeur qu'on repasse ensuite à JavaScript n'est pas abîmée au passage, et
qu'une promesse attendue s'attend toujours. Une liste, un dict, un set ou une
instance qu'on lui passe est l'objet même de Python, comme un appelant
JavaScript passe son tableau : une bibliothèque qui le garde lit ce que Python
change ensuite, et ce qu'elle y écrit est à Python. Une API qui clone,
`postMessage`, IndexedDB, `history.pushState`, prend `to_js(value)`, une copie,
comme le `$state` de Svelte prend `$state.snapshot` ; de même une bibliothèque
qui pose ses propres champs sur le tableau reçu, Chart.js parmi d'autres, et
une qui relit sans cesse un gros jeu de données, qu'une vue sert lecture par
lecture.

Un mot-clé plutôt qu'une déclaration, pour une raison : un import est statique,
et un mot-clé rend l'import calculé **inécrivable** au lieu de simplement faux.
C'est aussi le seul endroit où le script d'un composant s'écarte de Python, et il
s'en écarte visiblement, le même marché que le balisage passe déjà avec `{#if}`
et le morse.

Un `.py` ordinaire n'a pas de balisage : il n'importe jamais de composant enfant,
ni de feuille de style, ni d'espace de noms : il appelle le framework, rien de
plus. Il garde donc `__js__`, et continue de parser comme du Python : une
affectation ordinaire lue dans l'AST, exactement comme le `__all__` d'à côté :

```python
__js__ = {"@sveltejs/kit": ["error", "fail"]}
__all__ = ["load", "actions"]

...
```

Une règle, en une phrase : **un fichier qui a un gabarit a le dialecte ; un
module est du Python.**

Dans les deux cas, le nom est l'import de JavaScript, et Python le lit comme
JavaScript, vivant : ce que son module écrit ensuite, Python le lit ensuite. Il
ne le lie jamais, puisque JavaScript n'affecte jamais un import : `counter = 0`
ou un `global counter` suivi d'une affectation est refusé à la compilation, avec
sa ligne, et une écriture à l'exécution, `globals()["counter"] = 0`, lève
`TypeError`. Une valeur à vous prend un autre nom.

Pour la plateforme elle-même, `js` donne les globales JavaScript et `to_js()`
convertit un conteneur Python en quelque chose qu'une API Web acceptera :

```python
def GET(event):
    corps = js.JSON.stringify(to_js(chercher(event["query"].get("q", ""))))
    return js.Response.new(corps, to_js({"headers": {"content-type": "application/json"}}))
```

### La frontière convertit, dans les deux sens

SvelteKit enveloppe `params` et `url` dans des proxies qui enregistrent chaque
clé lue, pour savoir de quoi un `load()` dépend, et Brython sonde les symboles
d'un objet en l'emballant pour Python, ce qui fait atterrir des symboles dans cet
enregistrement et fait refuser le tout par son sérialiseur. Python ne touche donc
jamais le proxy : la frontière le lit en JavaScript et rend un dict Python.

```python
def load(event):
    numero = event["params"]["numero"]
    requete = event["query"].get("q", "")

    if not (fiche := trouver(numero)):
        error(404, "rien sous ce numéro")     # SvelteKit 2 lève lui-même

    return {"pep": fiche}                     # un dict, converti au retour
```

`event` porte `params`, `query`, `url`, `method`, `route` et `js` : l'événement
brut. Ce dernier est l'échappatoire, et il se suffit à lui-même :

`query` est un dict, donc une clé écrite deux fois garde la **première** valeur,
celle que `url.searchParams.get()` répond de la même URL. Toutes les valeurs
d'une clé répétée sont derrière l'échappatoire :
`event["js"].url.searchParams.getAll("tag")`.

```python
biscuits = event["js"].cookies
theme = str(biscuits.get("theme") or "clair")
biscuits.set("theme", "sombre", to_js({"path": "/"}))
event["js"].setHeaders(to_js({"x-svelthon": "bonjour"}))
```

Le même traitement descend **dans un dict de fonctions exporté**, ce qu'est
`actions` : chacune reçoit ses arguments convertis, voit sa coroutine attendue et
son résultat reconverti. Ce qui n'est **pas** un conteneur Python, une
`Response`, une `Promise`, un `ActionFailure`, passe intact.

**Un appelable traverse comme son appel, pas comme ses champs.** Une fonction,
une méthode liée et une instance dont la classe définit `__call__` arrivent
toutes en fonctions JavaScript, où qu'elles aient été écrites : sous un nom, dans
une liste, dans un mapping, dans ce qu'une autre fonction a renvoyé. Ce qui
n'arrive pas, ce sont les attributs de l'objet : ils restent en Python, où
l'appel les atteint toujours, donc un objet stratégie garde son état et
JavaScript garde son appel.

| sur un appelable | traverse |
|---|---|
| `handler.factor`, n'importe quel attribut de l'objet | non, **et Python l'a toujours** |
| `handler.name` | comme le `name` de la fonction, puisqu'une fonction JavaScript en porte un de toute façon |
| `handler.length` | non : `length` est l'arité que l'appel déclare |

Les deux exceptions sont les deux mots qu'une fonction JavaScript possède déjà.
`name` prend celui de l'auteur quand il y en a un (`on_save` dit plus dans un
log que `Handler.__call__`), et `length` est ce qu'une bibliothèque lit pour
savoir ce qu'un callback prend. Les deux décrivent l'**appel**, aucun n'est le
champ d'à côté. `tests/callable-matrix.test.js` tient chaque ligne, sur **13 formes** et **14
positions**, et chaque forme encore appelée par une directive.

Une fonction Python ne reçoit que les arguments qu'elle déclare : `def tout_vider():`
sert d'`onclick` sans recevoir l'événement. Une méthode de type natif qui ne
prend aucun argument positionnel aussi, `rows.clear`, `rows.reverse`,
`rows.sort` ou `"hi".upper` : `onclick={rows.sort}` trie la liste. Toute autre
méthode native reçoit tout ce que JavaScript passe, et en fait ce que Python en
ferait : `onclick={rows.pop}` lève, l'événement n'étant pas un indice, et
`onclick={rows.append}` ajoute l'événement, comme un `def ajoute(item)` le
recevrait. On les enveloppe : `onclick={lambda: rows.pop()}`, ou un `def`.

Une méthode lue sur un objet JavaScript reste liée à lui, comme Python lie toute
méthode qu'il lit, où que Svelte l'appelle : un gestionnaire, un `{@attach}`,
une transition. `onclick={field.focus}` donne le focus au champ et
`onclick={history.back}` revient en arrière, là où Svelte passerait le bouton à
la méthode. Un gestionnaire qui veut l'élément lit `event.currentTarget`.

### Le seul endroit où SvelteKit code en dur

Les hooks sont trouvés par `resolve_entry`, qui filtre sur `/\.(js|ts)$/` et
ignore `moduleExtensions`, si bien qu'un `src/hooks.server.py` n'est jamais vu. Une
amorce de deux lignes fait le pont, et tout le reste reste du Python :

```js
// src/hooks.server.js
export { handle, handleError } from './hooks.server.py';
```

```python
async def handle(entree):
    reponse = await entree.resolve(entree.event)
    reponse.headers.set("x-python-handle", "1")
    return reponse
```

Les matchers de paramètres font exception : SvelteKit importe `src/params` avec
le chargeur de Node plutôt qu'à travers Vite, donc une amorce qui réexporte d'un
`.py` échoue en `ERR_UNKNOWN_FILE_EXTENSION`. Ils restent en JavaScript : un
fichier, quelques lignes.

## Rendu côté serveur

Ça fonctionne. Svelte compile une seconde version de chaque composant qui rend
une chaîne HTML au lieu de créer des nœuds DOM ; le corps Python s'exécute donc
sous Node, ce que le compilateur fait déjà au build. Il manquait deux shims au
runtime navigateur (`self`, `addEventListener`) ; Bryntime les pose désormais,
et c'était tout l'obstacle.

Couvert par `tests/ssr.test.js` : composants, props, composition avec composants
enfants et l'accès d'attribut, et les valeurs Python elles-mêmes : `-7 // 2`
rend bien
`-4` côté serveur.

**Le seul vrai piège, et il n'est pas propre à Svelthon.** L'état d'un store vit
dans le module, donc il est partagé par toutes les requêtes servies par le
processus. Svelte pose exactement le même avertissement pour un `$state` de
niveau module dans un `.svelte.js`. Sans danger au **prérendu**, une seule
passe et aucun utilisateur concurrent, et fuite de données en rendu par requête.
La réponse de Svelte est le contexte, et Python l'a : ce qui appartient à une
requête passe par `set_context` et `get_context`, pas par un store.

Le prérendu est la cible la plus simple : aucun serveur nécessaire, il tient
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

La ligne vient de la traceback Python, recalée sur la numérotation du fichier :
un `<script module>` placé avant le Python ne la fausse pas.

Le composant survit à l'exception, le handler suivant fonctionne, et un
`try/except` Python reste un `try/except` Python : l'enveloppe ne s'applique
qu'à ce qui remonte jusqu'à JavaScript.

## Ce qu'un composant peut importer

`browser` (avec `browser.html` et `browser.aio`), `javascript`, et n'importe
quel `.py` posé à côté du composant ou sur le `path` configuré. La
bibliothèque standard de Python n'est pas livrée : `import json`, `import math`
ou `from browser import timer` est refusé sur sa ligne à la compilation, avec
ce qui le remplace quand il existe. De même pour ce qui irait la chercher à
l'exécution, un alias `type` ou un `def f[T]` générique, `__reduce__()` et
`help("nom")`, et pour les builtins qu'une page ne peut pas exécuter : `eval`,
`exec` et `compile`, qui demandent un parseur que le moteur laisse de côté,
`__import__` et `open`. Un module se trouve par son seul nom de
fichier : un sous-dossier n'est pas un paquet, donc `from lib import models`
est refusé aussi, et `models.py` s'importe par `import models` une fois `lib`
sur le `path`. Tout ce dont un gabarit a besoin est déjà
un nom : `js` pour la plateforme, `js.Math` et `js.Date`, et `tojson`,
`from_json`, `batch`, `date`, `fromnow`, `slugify`, `striptags`,
`urlencode`.

`tojson` écrit ce dont JSON a une notation et **refuse le reste en le nommant**
plutôt que d'écrire `{}` ou `null` : un set, des bytes, un range, un complex,
une coroutine, une promesse, une `Map`, un `Set`, et `nan` ou `inf`, que JSON ne
sait pas écrire et que `json.dumps` écrit sous une forme qu'aucun `JSON.parse`
ne relit. Une classe JavaScript dit comment
elle se sérialise en portant `toJSON` ; celle qui ne le dit pas est refusée
aussi, puisque rien ne distingue ses champs de ceux d'une `Map`. Il parcourt
une structure de **2 500 niveaux** environ au plus, là où `json.dumps` en écrit
20 000 : au-delà, la pile du moteur déborde. `striptags`
montre le document visible, donc le texte d'un `<script>` ou d'un `<style>`
n'atteint jamais la page.

`date` lit **une date sans heure comme un jour du calendrier**, rendu tel quel
où qu'on le lise. `"2026-08-24"` est le 24 août pour tout le monde, ce que
`datetime.date` veut dire et ce que le `|date` de Django affiche ; la
spécification lit une telle chaîne comme minuit UTC, donc sans cette règle tout
lecteur à l'ouest de Greenwich voyait la veille. Une valeur qui porte une heure
est un instant, et se rend dans le fuseau du lecteur, ce qui est le propre d'un
instant.

Le runtime est celui de Bryntime, et un navigateur le reçoit sans la chaîne de
parsing, que seul le compilateur charge ; le README de Bryntime en donne le poids.

## État

Validé par `npm test`, 1 877 tests écrits (vitest en compte plus, un par
rangée d'un `test.for`), aucun échec attendu :

- réactivité de bout en bout, et quels chemins d'écriture propagent ;
- props : défaut Python, priorité du parent, lisibilité pendant l'init,
  propagation d'une mise à jour du parent jusqu'au Python ;
- **grille de fidélité sémantique** : entiers, texte, protocoles, flot de
  contrôle et frames. Chaque valeur attendue a été produite par CPython 3.12 en
  exécutant le code du composant tel quel, jamais écrite à la main. Brython
  reproduit CPython sur **chaque point** ;
- build de production : **225 Ko gzip**, runtime Brython compris.

La grille sert de banc d'acceptation aux codegens optimisés (wasthonf) : un
codegen qui supprime les cadres d'appel casse `Frames`, qui déballe les entiers
casse `Integers`, qui court-circuite `augm_assign` casse `Protocols`.

### Divergences connues

Une, et elle est de Svelte, ce n'est pas un bug : un `$derived` qui rend l'objet
qu'on lui a donné se compare égal à lui-même, donc rien n'en propage : c'est
pourquoi un lecteur s'abonne à l'objet plutôt qu'au dérivé (voir
[Réactivité](#réactivité--un-signal-par-nom)).

## Surface Svelte couverte

Mesuré, pas supposé (`tests/svelte-surface.test.js`) : tout ceci fonctionne dans
un composant Python :

| | |
|---|---|
| blocs | `{#if}` `{:else if}` `{#each}` (indexé, `{:else}`, avec clé) `{#key}` `{#await}` |
| balises | `{@html}` `{@render}` `{#snippet}` `{@attach}` `{@debug}` |
| snippets | déclarés, rendus, donnés à un enfant dans sa balise **ou par leur nom** |
| liaisons | `bind:value` `bind:checked` `bind:group` `bind:this` |
| directives | `class:` `style:` `use:` `transition:` `in:` `out:`, nommant aussi une fonction d'un **module Python** |
| composition | props, défauts, spread d'un **dict Python**, enfants par snippet, l'API d'instance par `@export` |
| éléments | `<svelte:window>` `<svelte:head>` `<svelte:boundary>` |
| styles | `<style>` scopé |

Les expressions de gabarit sont du Python de bout en bout, y compris dans les
recoins qui ne sont pas des interpolations : l'itérable d'un `{#each}`, sa clé,
`{#key}`, le membre droit d'une déclaration, `{@html}`, l'attachement d'un
`{@attach}`, le raccourci `{nom}`, l'étalement `{**attrs}`, et une interpolation
dans un attribut entre guillemets, comme `class="tag {statut.lower()}"`.

Deux graphies de Python sont acceptées là où Svelte a la sienne :
`{#each d.items() as (k, v)}` déstructure un tuple, et `{#each xs as x, i}` garde
le sens de Svelte : élément et index. Ce qu'un composant importe ou déclare dans
son `<script module>` se lit aussi depuis Python, et c'est ainsi qu'un composant
Python atteint une bibliothèque JavaScript.

## Support éditeur

Ce n'est pas un manque de Svelthon, mais autant le savoir : la grammaire
TextMate de Svelte rabat un `lang` inconnu sur **JavaScript**. `<script
lang="python">` n'est donc pas laissé sans coloration : il est colorié faux,
commentaires `#` compris.

La grammaire liste déjà `coffee` à côté de `ts` : ajouter `python` en amont dans
`svelte-language-tools` ne demande donc aucune exception. L'autre voie est une
injection de grammaire livrée comme petite extension d'éditeur.

### Hydratation

Le runner de Svelte exécute chaque échantillon dans trois modes, client, serveur,
**hydratation**, et c'est le troisième qui exige que les deux moitiés
s'accordent, puisque le corps Python tourne des deux côtés. Couvert par
`tests/hydration.test.js` :

- les nœuds du serveur sont **repris, pas reconstruits** : leur identité survit,
  ce qui prouve que l'hydratation a bien eu lieu ;
- le Python est branché sur ces nœuds repris : un clic incrémente toujours ;
- **en cas de divergence, la valeur du client l'emporte, en silence.** Aucun
  avertissement. Un composant non déterministe (l'heure, un aléa, une session) ne
  ne plantera pas : il affichera une valeur puis basculera sur l'autre.

La sortie serveur exacte, marqueurs compris, est affirmée dans `tests/ssr.test.js`
pour que les deux fichiers ne puissent pas diverger.

## Ce que ça coûte à l'exécution

Mesuré par `npm run bench` : le même composant écrit deux fois, en Python et en
JavaScript, actionné par de vrais clics dans un Chromium headless. Le dispatch
d'un clic coûtant pareil des deux côtés, l'écart entre les colonnes revient au
handler. Sept tours alternés, minimum retenu : la mesure la moins polluée, pas la
moyenne des interruptions de la machine.

| | Python | JS | écart |
|---|---:|---:|---:|
| montage à chaud | 0,3 ms | 0,2 ms | ~1,5× |
| 2000 appels de handler | 28 ms | 18 ms | **~1,5×** |
| 1500 × somme de 500 carrés | 1128 ms | 15 ms | **50 à 100×** |
| rendu d'une liste à clé de 500 lignes | 5,0 ms | 8,0 ms | **0,6×** |

Trois enseignements.

**Entrer dans Python coûte peu**, environ 1,5× un handler JS. Les frames et
`augm_assign` se paient, mais rien qu'un clic puisse percevoir.

**Le calcul Python est un à deux ordres de grandeur plus lent.** Le rapport
oscille entre 50× et 100× selon les exécutions : c'est la fourchette honnête sur
une machine modeste. Garder les boucles chaudes hors des composants, ou passer
par les extensions C que [Wasthon](https://github.com/fgallaire/wasthon) compile
en WebAssembly.

**Le rendu n'est pas plus lent, il est plus rapide.** De façon constante, à
chaque exécution. Svelte proxifie en profondeur les objets d'un tableau `$state` ;
les noms de Svelthon sont des `$state.raw`, donc les valeurs Python ne sont jamais
proxifiées. Le choix de conception de la réactivité se rembourse précisément là
où une vraie application passe son temps.

Le vrai prix est au chargement : **1,2 s jusqu'à l'interactivité** pour la démo de
production sur ce portable, contre 0,5 s pour la même page sans Brython : 225 Ko
gzip au lieu de 13. Payé une fois par session, pas par page, puisque
l'application ne recharge jamais.

## Reste à faire

**Bloque une vraie application**

- **Publication.** Le paquet est défini, ses `exports` et ses `files`, et il
  n'est pas encore sur npm : le `npm install svelthon` du démarrage rapide
  l'attend.


**Notes de conception** : [notes/template.md](notes/template.md) sur ce en quoi
une expression de gabarit est compilée et les cinq adaptateurs qui la tiennent,
[notes/directives.md](notes/directives.md) sur les quatre façons dont la valeur
d'une directive devient du Python et sur les deux points qui restent, et [notes/dicts-and-objects.md](notes/dicts-and-objects.md) sur ce que
valent un dict et une instance de classe à la frontière, mesuré côte à côte, et
tenu par `tests/shapes.test.js`, et [notes/one-interpreter.md](notes/one-interpreter.md)
sur les deux chargements de Brython dans un même processus, et ce que coûterait
de n'en faire qu'un. [notes/crossings.md](notes/crossings.md) est l'index de la
frontière elle-même : les treize convertisseurs en un tableau, quelle porte
prendre, et les trois pannes qui apparaissent quand on se trompe.

**Vous venez de Django ou de Flask ?** [DJANGO_FLASK.md](DJANGO_FLASK.md) met
en regard chaque construction de gabarit courante et son équivalent Svelthon,
toute la traduction tient sur une page, et son exemple complet est une fixture de test,
donc il ne peut pas dériver.

**En amont, chez Brython**

Les internes du compilateur de Brython dont Svelthon dépend sont réunis dans
**[BRYTHON.md](BRYTHON.md)**, le contrat entre les deux projets. À l'exécution,
Svelthon n'atteint le moteur que par Bryntime, qui tient le sien.

## Lancer

```sh
npm install
npm test             # grille de fidélité, props, réactivité (jsdom), puis le contrôle du navigateur
npm run test:quiet   # un run vert ne doit rien dire
npm run test:browser # le contrôle du navigateur seul : interop DOM, passe du gabarit et démo
npm run test:hmr     # invalidation des modules virtuels
npm run test:kit     # un build de production SvelteKit, servi
npm run test:all     # tout ce qui précède, arrêt au premier échec
npm run dev          # la démo, sous /demo/
npm run build
```

### Un réglage non évident dans `vite.config.js`

`optimizeDeps.entries: []` : le scanner de dépendances de Vite tourne **avant**
le pipeline de plugins : il lit les entrées HTML, tombe sur
`<script lang="python">` et livre le Python à un parseur JavaScript, puis
échoue sur `./store.py`, qu'aucun fichier de ce nom n'est censé servir. Son
unique rôle ici étant de découvrir les imports nus, on le court-circuite et on
nomme le seul paquet qui mérite d'être pré-bundlé.

### Brython, par Bryntime

Svelthon ne porte aucune copie de Brython. Il dépend de **Bryntime**, le
runtime Brython pour les frameworks JavaScript, qui tient la traversée entre
Python et JavaScript, que Svelthon atteint par sa seule entrée, `bryntime`. Le
moteur est **Bryve**, Brython et ses réparations, démarré là où il est
importé, sur lequel Bryntime tourne et dont Bryc, le compilateur, charge la
chaîne d'analyse, `bryve/compiler`. Tant qu'ils ne sont pas publiés, les deux
s'installent depuis des dépôts posés à côté de celui-ci, `../bryntime` et
`../bryve`. Quel moteur est livré, construit depuis quoi et avec quelles
réparations, c'est à Bryve de le dire.

**Et c'est le seul Python livré.** Aucun module de la stdlib ne voyage avec
Svelthon, `sys` compris : une stdlib existe pour qu'un auteur puisse `import`
quelque chose, ce qui est le métier de Brython et pas celui d'un framework de
composants. Un besoin identifié devient un builtin à nous, injecté dans le
namespace, sans rien à importer. Ce que le moteur porte déjà reste accessible,
`browser` et `_sys` entre autres.

## La pile plus large

Svelthon tient debout tout seul : un framework frontend Python, rien d'autre
n'est requis. Mais parce qu'il tourne sur Brython plutôt que sur un interpréteur
en bac à sable, tout ce qui est bâti pour Brython est disponible dans un
composant : notamment [Wasthon](https://github.com/fgallaire/wasthon), qui amène
les vrais modules d'extension C de CPython dans le navigateur en WebAssembly, et
[NumBry](https://github.com/fgallaire/numbry), qui construit la pile scientifique
(NumPy, pandas, SciPy, matplotlib, Pillow, SymPy) par-dessus.

Ça compte pour ce qu'on livre. Là où un runtime CPython-en-WebAssembly complet
arrive en une seule grosse charge, ce sont ici des `.wasm` par module, et
Svelthon sait déjà exactement quels modules un composant importe, `py2js()` les
expose, donc seuls ceux réellement nommés ont à voyager.

## Licence

Svelthon est sous MIT, la licence de Svelte et de l'outillage autour. Voir
`LICENSE`.

Bryntime, dont Svelthon dépend, est sous BSD-3-Clause, la même licence que
Brython.
