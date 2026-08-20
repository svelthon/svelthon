<!-- A leading script module shifts the Python line numbering. -->
<script module>
    const unused = 1;
</script>

<script lang="python">
value = 0


def boom():
    raise KeyError("shifted")
</script>

<button data-k="boom" onclick={boom}>boom</button>
