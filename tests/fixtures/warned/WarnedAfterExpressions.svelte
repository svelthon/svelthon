<script lang="python">
x = 1
shown = True
</script>

<!-- Expressions written over several lines, in a text, an attribute, a block
     and a handler, then an image Svelte warns about: the warning names the line
     the image is written on. -->
<p title={(x +
    1)}>{(x +
    2)}</p>
{#if (shown and
      x == 1)}
    <button onclick={lambda: (shown :=
        not shown)}>toggle</button>
{/if}
<img src="a.png">
