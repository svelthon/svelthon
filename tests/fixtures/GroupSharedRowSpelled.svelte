<script lang="python">
# The rows of `GroupSharedRow`, their name declared under one spelling and read
# under another Python takes for the same name: still a group per row.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
rows = [shared, shared]
pairs = [(shared, "0"), (shared, "1")]
way: str = "declared ﬁ"


@export
def read():
    return "|".join(",".join(row.selected) for row in rows)
</script>

{#if way == "declared ﬁ"}
    {#each rows as ﬁeld, at}
        <input data-k={str(at)} type="checkbox" value={str(at)} bind:group={field.selected} />
    {/each}
{:else if way == "read ﬁ"}
    {#each rows as field, at}
        <input data-k={str(at)} type="checkbox" value={str(at)} bind:group={ﬁeld.selected} />
    {/each}
{:else}
    {#each pairs as (ﬁeld, label)}
        <input data-k={label} type="checkbox" value={label} bind:group={field.selected} />
    {/each}
{/if}
