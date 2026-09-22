<script lang="python">
# Two rows of one form, each with its own selection list. The two share the
# component instance and the text of the binding — `row["selected"]` — and share
# nothing else, which is exactly the pair a group registry keyed on those two
# alone cannot tell apart.
rows = [{"name": "first", "selected": []}, {"name": "second", "selected": []}]


@export
def read():
    return " / ".join(",".join(row["selected"]) for row in rows)
</script>

{#each rows as row, at}
    <fieldset data-k="row-{at}">
        <input data-k="{at}-a" type="checkbox" value="a" bind:group={row["selected"]} />
        <input data-k="{at}-b" type="checkbox" value="b" bind:group={row["selected"]} />
    </fieldset>
{/each}

<p data-k="both">{read()}</p>
