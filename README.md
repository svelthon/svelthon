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

## État

Validé par les tests (`npm test`) :

- réactivité de bout en bout — un `global count` en Python met le DOM à jour ;
- vraie sémantique CPython — `-7 // 2 == -4` (JS donnerait `-3`), `2 ** 70`
  exact (JS donnerait `1.1805916207174113e+21`), `sorted(set)` ;
- build de production : **233 Ko gzip**, runtime Brython compris.

## Reste à faire

- **Props.** Prévu : une annotation sans valeur, comme un dataclass —
  `name: str` devient un prop requis, `count: int = 0` un prop à défaut.
- **Interop des handlers.** Aujourd'hui les arguments JS sont tronqués à
  l'arité déclarée en Python, ce qui fait marcher `onclick` sans que Python
  reçoive l'événement. Une vraie politique (`$B.jsobj2pyobj` à la demande, ou
  sur décorateur) reste à choisir.
- **Wasthon.** `py2js()` expose déjà la liste des imports du composant
  (`root.imports`). De quoi n'expédier que les `.wasm` réellement importés et
  les faire entrer dans le graphe d'assets de Vite — préchargés et hashés — au
  lieu d'être découverts au runtime.
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
