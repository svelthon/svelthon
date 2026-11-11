<script lang="python">
# The classes a lazy iterable yields, as the list `list()` makes of it gives.
names = ["on", "", "wide"]
flags = {"on": 1, "wide": 2}
</script>

<p data-k="list" class={[n for n in names if n]}>list</p>
<p data-k="generator" class={(n for n in names if n)}>generator</p>
<p data-k="keys" class={flags.keys()}>keys</p>
