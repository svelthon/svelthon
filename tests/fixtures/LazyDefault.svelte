<script lang="python">
# A default that reads an earlier name of its own pattern gets that name through
# a function, and has to get the value itself: every kind a row may hold, read
# once directly and once through the default.
rows = [
    [[1, 2]],
    [{"k": 1}],
    [None],
    [2 ** 60],
    ["text"],
]
</script>

{#each rows as [a, b=a], i}
    <i data-k="row-{i}">{type(a).__name__}:{type(b).__name__}:{b is a}:{b == a}</i>
{/each}

<!-- And the branch Python does not take reads nothing: `second` is still in its
     temporal dead zone when the default of `first` runs. -->
{#each [[]] as [first=1 if True else second, second=2]}
    <i data-k="untaken">{first}:{second}</i>
{/each}

{#each [[]] as [first=1 or second, second=2]}
    <i data-k="short-circuit">{first}:{second}</i>
{/each}

<!-- Python's scopes: a comprehension's first iterable and a lambda's defaults
     are read outside it, every parameter binds for the body, and each target
     of a comprehension for what follows it. -->
{#each [[[1, 2]]] as [x, r=[x for x in x]]}<i data-k="iterable">{r}</i>{/each}
{#each [[7]] as [x, r=(lambda x=x: x + 1)()]}<i data-k="lambda-default">{r}</i>{/each}
{#each [[7]] as [x, r=(lambda *, x: x)(x=3)]}<i data-k="keyword-only">{r}</i>{/each}
{#each [[7]] as [x, r=(lambda *x: x)(1, 2)]}<i data-k="variadic">{r}</i>{/each}
{#each [[[1, 2]]] as [x, r=[(x, y) for x in x for y in [x]]]}<i data-k="generators">{r}</i>{/each}
{#each [[7]] as [x, r=(lambda y: y + 1)(x)]}<i data-k="no-collision">{r}</i>{/each}
