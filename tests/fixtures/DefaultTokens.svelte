<script lang="python">
# Functions a default makes, reading a name an element after it binds: one
# row's taking of the default leaves the functions another row made be, and a
# function the default makes in passing leaves the field read again.
capture: object
source: object
tick = 0


@export
def advance():
    global tick
    tick += 1
</script>

{#each [[], []] as [saved=capture(lambda: later), later=7]}<output data-k="rows">{saved()}:{later}</output>{/each}
{#snippet row([saved=capture(lambda: later), later=7])}<output data-k="calls">{saved()}:{later}</output>{/snippet}
{@render row([])}
{@render row([])}
{#each [source] as [saved=lambda: later, later]}<output data-k="refresh">{tick + later}</output>{/each}
