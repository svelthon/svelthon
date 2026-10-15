<script lang="python">
# Bound selects whose model Svelte writes as it mounts, in a keyed block: the
# key and a read of each row count how often they run.
importjs { count } from "./counting.js"

n: int = 0
rows = [{"choice": None} for _ in range(n)]


def keyed(row):
    count("keys")
    return id(row)


def read(row):
    count("rows")
    return "" if row["choice"] is None else str(row["choice"])
</script>

{#each rows as row (keyed(row))}
    <select bind:value={row["choice"]}>
        {#each [0, 1, 2] as c}
            <option value={c}>{c}</option>
        {/each}
    </select>
    <span>{read(row)}</span>
{/each}
