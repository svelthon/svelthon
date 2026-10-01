<script lang="python">
# Two rows handed one default list: two targets holding one value. Each row
# offers its own choice. The second loop reaches the same rows by index, the
# third by a keyed block that can be reordered.
initial = ["a"]
rows = [{"id": 1, "choice": "a", "picked": initial}, {"id": 2, "choice": "b", "picked": initial}]


@export
def read():
    return " / ".join(",".join(row["picked"]) for row in rows)


@export
def swap():
    rows.reverse()
</script>

<form data-k="named">
    {#each rows as row}
        <input data-k="named-{row["id"]}" type="checkbox" value={row["choice"]} bind:group={row["picked"]} />
    {/each}
</form>

<form data-k="indexed">
    {#each rows as _, at}
        <input data-k="indexed-{at}" type="checkbox" value={rows[at]["choice"]} bind:group={rows[at]["picked"]} />
    {/each}
</form>

<form data-k="keyed">
    {#each rows as row (row["id"])}
        <input data-k="keyed-{row["id"]}" type="checkbox" value={row["choice"]} bind:group={row["picked"]} />
    {/each}
</form>
