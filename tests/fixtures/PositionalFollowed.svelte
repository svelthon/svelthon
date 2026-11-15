<script lang="python">
model = [1.5, [1]]
held = model
rows = [[1, 2]]

@export
def mutate():
    model[0] = 2.5
    model[1].append(9)
    rows[0][0] = 3
</script>

{#await held then [n, items]}
    <output data-k="then">{n}:{len(items)}</output>
{/await}

{#each rows as [a, b]}
    <output data-k="each">{a}:{b}</output>
{/each}
