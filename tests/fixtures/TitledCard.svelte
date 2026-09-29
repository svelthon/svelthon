<script lang="python">
# A child that renders its `children` and a named snippet with an argument.
title: str
children: object = None
footer: object = None
</script>

<section>
    <h2>{title}</h2>
    {#if children}{@render children()}{/if}
    {#if footer}{@render footer("end")}{/if}
</section>
