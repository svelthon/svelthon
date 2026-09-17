<script lang="python">
value = 3
</script>

<!-- A dict inside a field, whose value is a string holding a brace. The colon
     belongs to the dict, not to a format specification. -->
<p data-k="dict-string">{f"{ {'x': '}'} }"}</p>

<!-- The same with a number, which already worked. -->
<p data-k="dict-number">{f"{ {'x': 1} }"}</p>

<!-- A real format specification, whose width is computed. -->
<p data-k="computed">{f"{value:{len('}')}}"}</p>

<!-- A slice, whose colon is also not a specification. -->
<p data-k="slice">{f"{[1, 2, 3][0:2]}"}</p>
