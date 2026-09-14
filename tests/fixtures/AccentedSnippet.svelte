<script lang="python">
# A module name of the same spelling as the snippet's parameter, which is what
# turns a lost parameter list into a wrong *value* rather than an error: the
# body still resolves `x`, to this one.
x = "MODULE"
</script>

{#snippet ligne(x)}<i data-k="ascii">{x}</i>{/snippet}
{#snippet ligné(x)}<i data-k="accent">{x}</i>{/snippet}

{@render ligne("PARAM")}
{@render ligné("PARAM")}
