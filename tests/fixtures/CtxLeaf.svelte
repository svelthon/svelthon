<script lang="python">
theme = get_context("theme")
missing = get_context("nope")
</script>

<span data-k="leaf">{theme}/{missing}</span>

<!-- A missing key renders as nothing, so what it *is* is asked in Python. -->
<span data-k="is-none">{missing is None}</span>
