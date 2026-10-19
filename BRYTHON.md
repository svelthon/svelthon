# What Svelthon asks of Brython

Svelthon compiles Python to JavaScript with Brython's compiler, which it loads
onto the engine through `bryntime/compiler`, and wires the result to Svelte's
signals. Almost none of what the compiler touches is a public API: it is the
shape of Brython's internals. This file is the contract, so that a Brython change
can be checked against it, and so that whoever reads `src/lib/` knows which
assumptions are load-bearing.

At run time Svelthon reaches the engine through Bryntime alone, and what
Bryntime asks of Brython is Bryntime's contract, kept with it.

Verified against the engine Bryntime ships, `$B.version_info == [3, 14, 0]`.

## The single point everything rests on

```js
locals_Counter = $B.namespace('Counter')
locals_Counter.count = 0
```

Brython keeps a module's state in a **namespace object**, never in lexical
bindings, since Python semantics require it, for `globals()`, `exec`, and dynamic name
resolution. At run time Bryntime replaces that object, for the duration of the
module body, with one whose every property is an accessor onto a Svelte signal,
and every assignment the code generator already emits becomes a reactive write.

**If this shape changed, Svelthon would stop working entirely.** It is the only
assumption checked at compile time: the build fails loudly when the expected call
is absent, rather than shipping a component with no reactivity.

## Internals used

### Compiler

| | |
|---|---|
| `$B.py2js(src, module, locals_id, parent)` | returns `{ _ast, imports, to_js() }`. A name nothing in the module binds and `$B.builtins` holds compiles to the builtin itself, `_b_.max`; a name the module binds, even in a branch that never runs, is read at run time, the module's namespace first. That is how a JavaScript import spelled like a builtin is read as the import: `compile()` compiles again with `if False:` binding those names |
| `$B.js_from_root({ ast, symtable, filename, src })` | the code generator `py2js` ends with, given a tree: `declaredExports` hands it a module of one statement of `__all__` at a time, from a parse of its own, and runs what comes back, so the export list is what Python computes. The namespace is the one `$B.namespace(filename)` hands back, swapped for one of its own while those statements run |
| `new $B.ast.Module(body, type_ignores)` | that one-statement module |
| `$B.is_list(value)`, `$B.is_tuple(value)` | whether what `__all__` holds once those statements have run is an export list |
| `$B.ast.*` | AST classes, compared with `instanceof` |
| `$B.tokenizer(src, filename, 'file')` | iterable of tokens, used to highlight Python with Python's own tokenizer |
| `$B.Parser` | its presence is how `compile.cjs` knows the parsing chain has loaded on top of the runtime, and a page that never compiles never defines it. `new $B.Parser(src, filename, 'file')` is also how `templateDots` parses one template function |
| `$B._PyPegen.run_parser(parser)` | returns the AST of what `parser` holds, with `lineno`, `col_offset`, `end_lineno` and `end_col_offset` counted in characters; `templateDots` rewrites the dots of the markup at those places |
| `$B.ast.Name`, `$B.ast.Constant`, a node's `constructor.$name` and `constructor._fields` | how the markup reads a binding's target, parsed in `'eval'` mode: a `Name`, parentheses or none, is a bare name, and the tree, its fields without positions, a number that is a key (the slice of a `Subscript`, a `Tuple` held there, a signed operand) by its value as Python compares keys (`$B.builtins.int.$factory`, `float.is_integer` through `$B.$getattr` and `$B.$call`, the class by `$B.class_name`) and any other constant by its class and `repr`, is what makes two spellings one group; `$B.ast.Subscript`, `$B.ast.Tuple`, `$B.ast.UnaryOp`, `$B.ast.USub` and `$B.ast.UAdd` say where a key is |
| `$B.unindent(src)` | Brython's own, the one it already runs on every `<script type="text/python">`; it hands the source back untouched as soon as one non-blank line starts at column zero |
| `$B.file_cache[filename]` | where `compiler_error` looks for the source to quote. Filling it is what turns a bare message into a message with the offending line under it |
| `$B.get_class(error)`, `$B.$getattr`, `$B.builtins.str.$factory` | how a Python error raised while compiling is described: its class's `__name__`, its message and its `lineno` |
| `$B._PySymtable_Build(ast, filename, $B.future_features(ast, filename))` | Python's symbol table for a module, the analysis CPython's `symtable` gives: the module's block, each with `symbols` and `children`. `globalReads` asks it which names some block **reads as a global**, so a parameter or a local called `host` does not bind `$host()` |
| `$B.SYMBOL_FLAGS` | the flags of a symbol: `USE`, `DEF_BOUND`, and the scope held at `SCOPE_OFFSET` under `SCOPE_MASK`, `GLOBAL_IMPLICIT` and `GLOBAL_EXPLICIT` among them. `moduleBinds` reads the module's bound names off it, and the check of `__all__` where each write of it resolves |
| `$B.str_dict_get(symbols, name, 0)` | a symbol's flags, `0` when the block does not know the name; a block's symbols are walked with `$B.builtins.dict.$iter_items` |
| `node[$B.ID]` | the id Brython writes on an AST node as it builds the symbol table, which is the `id` of the block that node opens: how a `def`, a `class`, a lambda or a comprehension finds its block |
| `$B.id_counter(n)` | sets the counter the code generator numbers functions with and returns its previous value; carried as a commit proposed upstream, since the counter is private there. `compile()` draws it from the file's path so one source compiles to one text, and gives it back after |
| `$B.lambda_magic` | the tag in every generated lambda's name, drawn at random per process; set and given back beside the counter |
| `$B.url2name[filename]` | the module name Brython's importer gives a file, which the code generator writes as the module's `__name__` and the `__module__` of what it defines; set for a `.py` or `.svelte.py` to its import name while it compiles, and given back after |
| `$B.stdlib` | Brython's catalogue of the modules it can import: `from browser import timer` imports the submodule `browser.timer` when the catalogue names one, and `help("name")` documents a name it holds no module of |
| `$B.set_lineno(frame, N)` | emitted throughout the generated code, which therefore carries the Python line it came from: enough for a line-level source map |

`py2js` derives the namespace identifier from **`filename`**, or from the name
`$B.url2name` gives it: `module` and `locals_id` are ignored by `js_from_root`.

Token type codes read off the tokenizer: `NAME 1`, `NUMBER 2`, `STRING 3`,
`NEWLINE 4`, `OP 55`, f-string parts `59/60/61`, `COMMENT 65`, `NL 66`,
`ENCODING 68`, `ENDMARKER 0`.

### What the generated code relies on

| | |
|---|---|
| `ns.$proxy = true` | the namespace object the compiler emits for a module is flagged so, which makes `resolve_in_namespace` read the property normally instead of demanding an *own* property, and lets the accessors live on the prototype |
| `$B.resolve_global(name, ns)` | not called, and the reason `$proxy` exists: it is the function that would demand an own property. It is here because it is the member whose disappearance would stop the whole namespace trick, and the one nobody would think to grep for |
| `$B.$setitem(obj, key, value)` | where a write must land to be seen: `bind:group` keeps its write on Python's path, where Svelte's own version writes with a plain JavaScript assignment that never reaches it |
| `$B.KW` | the symbol a call's keyword arguments travel under, as a trailing `{[$B.KW]: [named, ...unpacked]}`; carried as a commit proposed upstream. Bryntime reads it, and the helpers take their keywords from Bryntime as a Python function reads them |
