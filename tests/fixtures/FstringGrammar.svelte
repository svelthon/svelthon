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

<!-- A backslash before the field. It cannot escape a brace — the escape is `{{`
     — so the field opens all the same and the backslash stays in the text.
     Measured against CPython 3.14, which answers `\3` here, with the expression
     reusing the delimiter of the string that holds it. -->
<p data-k="raw-escaped">{rf"\{ "}" }"}</p>

<!-- The witness is the same line without the backslash. -->
<p data-k="raw-plain">{rf"{ "}" }"}</p>

<!-- And the ordinary escape still hides what follows it: two backslashes are one
     character of text, and the brace after them still opens a field. -->
<p data-k="escaped-pair">{f"\\{value}"}</p>
