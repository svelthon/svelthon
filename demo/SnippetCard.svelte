<script lang="python">
# A child that renders whatever snippet it was given, under whichever name.
# An annotation is what declares a prop, exactly as it declares a dataclass
# field; the type itself is not checked.
row: object = None
header: object = None
children: object = None
</script>

<div class="card">
    {#if children is not None}{@render children()}{/if}
    {#if row is not None}{@render row("from the child")}{/if}
    {#if header is not None}{@render header("from the child")}{/if}
</div>
