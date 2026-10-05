<script lang="python">
# A row a starred target cannot unpack: too short, or no iterable. `kind`
# picks it, since each raises.
kind: str = ""

ROWS = {"short": [1], "scalar": 3}
rows = [ROWS[kind]] if kind in ROWS else []
</script>

{#each rows as [first, *others, last]}
    <p>{first}|{others}|{last}</p>
{/each}
