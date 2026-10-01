<script lang="python">
# A select over dicts holding a float, and a checkbox group over floats: a
# binding compares a container by identity, so neither may be copied on the
# way out.
first = {"id": 0.5}
second = {"id": 1.5}
selected = first
picked = [0.5]
</script>

<select data-k="select" bind:value={selected}>
    <option value={first}>First</option>
    <option value={second}>Second</option>
</select>
<input data-k="a" type="checkbox" value={0.5} bind:group={picked} />
<input data-k="b" type="checkbox" value={1.5} bind:group={picked} />
<output data-k="picked">{picked}</output>
