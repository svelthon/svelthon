# What Svelthon asks of Brython

Svelthon compiles Python to JavaScript with Bryc, and what Bryc asks of Brython
is Bryc's contract, kept with it. At run time Svelthon reaches the engine
through Bryntime alone, and what Bryntime asks of Brython is Bryntime's
contract, kept with it.

What is left is Svelthon's own: the arrows and the markup it reads with
Brython's parser and tokenizer, and what the code it generates relies on.
Almost none of it is a public API: it is the shape of Brython's internals. This
file is the contract, so that a Brython change can be checked against it, and
so that whoever reads `src/lib/` knows which assumptions are load-bearing.

Verified against the engine Bryve ships, `$B.version_info == [3, 14, 0]`.

## Internals used

### Compiler

| | |
|---|---|
| `$B.ast.*` | AST classes, compared with `instanceof` |
| `$B.tokenizer(src, filename, 'file')` | iterable of tokens, used to highlight Python with Python's own tokenizer, and to find a name the author spelled like one the compiler writes |
| `new $B.Parser(src, filename, 'file')` | how an arrow's expression is parsed, where a call's first argument ends, and the script read before the compile for what it declares |
| `$B._PyPegen.run_parser(parser)` | returns the AST of what `parser` holds, with `lineno`, `col_offset`, `end_lineno` and `end_col_offset` counted in characters |
| `$B.ast.Name`, `$B.ast.Constant`, a node's `constructor.$name` and `constructor._fields` | how the markup reads a binding's target, parsed in `'eval'` mode: a `Name`, parentheses or none, is a bare name, and the tree, its fields without positions and a constant by its class (`$B.class_name`) and `repr` (`$B.builtins.repr`), is what makes two spellings one group |
| `$B.unindent(src)` | Brython's own, the one it already runs on every `<script type="text/python">`; it hands the source back untouched as soon as one non-blank line starts at column zero |

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
