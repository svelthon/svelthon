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
]
</script>

{#each samples as html, i}
    <p data-k="out-{i}">{striptags(html)}</p>
{/each}

<p data-k="number">{striptags(703)}</p>
