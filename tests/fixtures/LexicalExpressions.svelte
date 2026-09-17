<script lang="python">
tag = "x"
</script>

<!-- A brace inside a Python comment: the expression continues on the next line. -->
<p data-k="commented">{(1 # } not the end
 + 2)}</p>

<!-- A brace inside a triple-quoted string that also holds a lone quote. -->
<p data-k="tripled">{"""a " } b"""}</p>

<!-- An f-string whose field reuses the delimiter of the string holding it,
     which Python has allowed since 3.12. -->
<p data-k="reused">{f"{ "}" }"}</p>

<!-- The same shape with alternating delimiters, which already worked. -->
<p data-k="alternating">{f"{'}'}"}</p>

<!-- A dict closing against the field that holds it: `}}` is two closings here,
     not an escaped brace. -->
<p data-k="dict">{f"{ {'x': 1}}"}</p>

<!-- A nested format field closing against its own. -->
<p data-k="width">{f"{3:{2}}"}</p>

<!-- The same two with a space between the closings, which already worked. -->
<p data-k="spaced">{f"{ {'x': 1} }"}</p>

<!-- And braces that really are escaped text. -->
<p data-k="escaped">{f"{{x}}"}</p>

<!-- A format option: `#` is not a comment here. -->
<p data-k="hex">{f"{255:#x}"}</p>

<!-- A fill character that looks like a delimiter. -->
<p data-k="fill">{f"{3:'>5}"}</p>

<!-- The same without the option, which already worked. -->
<p data-k="plain-hex">{f"{255:x}"}</p>

<!-- A colon that belongs to a slice, not to a specification. -->
<p data-k="slice">{f"{[1, 2, 3][0:2]}"}</p>

<!-- The witness: an ordinary string, which the scanner already protected. -->
<p data-k="quoted">{"a } b"}</p>
