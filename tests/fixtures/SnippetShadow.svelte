<script lang="python">
# A Python name a snippet also carries. In its own file because the collision is
# refused at compile time, and a refusal takes the whole module with it.
label = "the python one"
</script>

{#snippet label(what)}<b>the snippet {what}</b>{/snippet}

<p>{label}</p>
