<script lang="python">
# A walrus inside a destructuring default, binding a name of the pattern: in a
# comprehension, a generator and a lambda's default it binds the default's own
# scope, and in a lambda's body the lambda's. What each row shows is what the
# same expression gives in CPython, in a function whose parameter the name is.
class Box:
    def __init__(self):
        self.value = 2

rows = [1]
</script>

{#each [[]] as [first=[later for row in [0] if (later := 3)], later=7]}<i data-k="comprehension">{first}:{later}</i>{/each}
{#each [[]] as [first=list(later for row in [0] if (later := 3)), later=7]}<i data-k="generator">{first}:{later}</i>{/each}
{#each [[]] as [first=(lambda value=(later := 3): later)(), later=7]}<i data-k="lambda-default">{first}:{later}</i>{/each}
{#each [[5]] as [seed, first=[seed, (seed := 3), seed]]}<i data-k="before-after">{first}:{seed}</i>{/each}
{#each [[5]] as [seed, first=[(seed := (seed := 3) + 1), seed]]}<i data-k="nested">{first}:{seed}</i>{/each}
{#each [[Box()]] as [held, first=[(held := held.value), held]]}<i data-k="attribute">{first}:{held.value}</i>{/each}
{#each [[rows]] as [kept, first=((kept := kept) is kept)]}<i data-k="identity">{first}</i>{/each}
{#each [[5]] as [seed, first=(lambda: (seed := 3) + seed)()]}<i data-k="lambda-body">{first}:{seed}</i>{/each}

{#snippet show(first=[later for row in [0] if (later := 3)], later=7)}<i data-k="snippet">{first}:{later}</i>{/snippet}
{@render show()}
