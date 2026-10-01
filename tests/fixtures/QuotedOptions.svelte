<script module>
    const example = '<svelte:options customElement="quoted-example" />';
</script>
<script lang="python">
# An option written in a string of a script is the author's text, not the
# component's option: nothing reads it, nothing rewrites it.
level: int = 1
</script>

<p data-k="example">{example}</p>
