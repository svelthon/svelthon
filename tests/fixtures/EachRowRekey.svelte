<script lang="python">
# A keyed block whose key is a field of its row, changed in place.
rows = [{"id": n, "label": str(n)} for n in range(3)]


def rename():
    rows[1]["id"] = 9
</script>

{#each rows as row (row["id"])}
    <span>{row["label"]}</span>
{/each}
<button onclick={rename}>rename</button>
