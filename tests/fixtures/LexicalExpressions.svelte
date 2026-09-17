<script lang="python">
tag = "x"
</script>

<!-- A brace inside a Python comment: the expression continues on the next line. -->
<p data-k="commented">{(1 # } not the end
 + 2)}</p>

<!-- A brace inside a triple-quoted string that also holds a lone quote. -->
<p data-k="tripled">{"""a " } b"""}</p>

<!-- The witness: an ordinary string, which the scanner already protected. -->
<p data-k="quoted">{"a } b"}</p>
