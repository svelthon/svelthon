<script lang="python">
# Unquoted values spelled as attribute names: a box of a group whose title is
# `checked`, and a plain button whose title is `is`.
held: list = None

picked = ["a"]
value = [] if held is None else held
</script>

<input type="checkbox" title=checked value="a" bind:group={picked}>
<button title=is disabled={value} hidden={value}>button</button>
