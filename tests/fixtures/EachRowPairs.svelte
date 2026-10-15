<script lang="python">
# Rows walked through enumerate(), which makes its pairs anew at each walk, in
# a keyed block whose key counts how often it runs.
importjs { count } from "./counting.js"

rows = [{"n": 0} for _ in range(5)]


def keyed(row):
    count("keys")
    return id(row)


def bump():
    rows[2]["n"] += 1


def grow():
    rows.append({"n": 9})
</script>

{#each enumerate(rows) as (i, row) (keyed(row))}
    <span>{i}:{row["n"]}</span>
{/each}
<button class="bump" onclick={bump}>bump</button>
<button class="grow" onclick={grow}>grow</button>
