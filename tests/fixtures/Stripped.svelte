<script lang="python">
# The browser's parser, not a regex. Every line here is one the regex gets wrong.
samples = [
    "<p>Bonjour <b>le monde</b></p>",
    "<p>caf&eacute; &amp; th&eacute;</p>",
    '<img alt="a>b" src="x"> suite',
    '<script>alert("x")</scr' + 'ipt> après',
    "<p>a &lt; b et 3 < 4</p>",
    "<!-- caché --> visible",
    "<p>Bonjour</p>  <p>le  monde</p>",
    "<p>a</p><p>b</p>",
    "texte sans balise",
    # The same script in the two other places it can stand. Opening the
    # fragment, it lands in `<head>` and was never read; between two words it
    # lands in `<body>`, and its source was printed into the page.
    '<p>Bonjour <scr' + 'ipt>alert("x")</scr' + 'ipt> monde</p>',
    "<p>Bonjour <style>.hidden { color: red }</style> monde</p>",
]
</script>

{#each samples as html, i}
    <p data-k="out-{i}">{strip_tags(html)}</p>
{/each}

<p data-k="number">{strip_tags(703)}</p>
