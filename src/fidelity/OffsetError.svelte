<!-- Un script module en tête décale la numérotation du Python. -->
<script module>
    const unused = 1;
</script>

<script lang="python">
value = 0


def boom():
    raise KeyError("décalé")
</script>

<button data-k="boom" onclick={boom}>boom</button>
