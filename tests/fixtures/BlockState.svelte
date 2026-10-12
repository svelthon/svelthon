<script lang="python">
# Containers a block declares, changed inside: through a binding on a member,
# by a method, and one level down. The block can be destroyed and made again.
ready = True


def toggle():
    global ready
    ready = not ready
</script>

<button data-k="toggle" onclick={toggle}>toggle</button>

{#if ready}
    {row = {"name": "before"}}
    <input data-k="name" bind:value={row["name"]} />
    <output data-k="name">{row["name"]}</output>

    {rows = [1]}
    <button data-k="append" onclick={lambda: rows.append(2)}>append</button>
    <output data-k="rows">{len(rows)}</output>

    {table = {"x": 1}}
    <button data-k="update" onclick={lambda: table.update({"x": 2})}>update</button>
    <output data-k="table">{table["x"]}</output>

    {nested = [{"x": 1}]}
    <button data-k="nested" onclick={lambda: nested[0].update({"x": 2})}>nested</button>
    <output data-k="nested">{nested[0]["x"]}</output>
{/if}
