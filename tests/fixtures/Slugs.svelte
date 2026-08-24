<script lang="python">
# One rule and no option: decompose, drop the combining marks, keep every letter
# and digit. Django needs `allow_unicode` for the second half of this table.
titles = [
    "Making the GIL Optional",
    "Été à Paris",
    "Straße",
    "Łódź",
    "Привет мир",
    "日本語",
    "C++ & Rust!",
    "  espaces   multiples  ",
    "!!!",
    "déjà-vu",
]
</script>

{#each titles as title, i}
    <p data-k="slug-{i}">{slugify(title)}</p>
{/each}

<p data-k="number">{slugify(703)}</p>
<h2 id={slugify("Making the GIL Optional")} data-k="anchor">anchor</h2>
