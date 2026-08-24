<script lang="python">
# One rule and no option: compose, lowercase, keep every letter, digit and mark.
# Django folds accents to ASCII and drops what will not fold.
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
    "Tiếng Việt",
    "Đường Đồng Khởi",
    "हिन्दी भाषा",
    "a_b c",
]

# The same word, composed and decomposed: identical on screen, and they have to
# give one URL rather than two.
same = slugify("Été") == slugify("Été".replace("é", "é"))
composed = slugify("Été")
decomposed = slugify("Été")
</script>

{#each titles as title, i}
    <p data-k="slug-{i}">{slugify(title)}</p>
{/each}

<p data-k="number">{slugify(703)}</p>
<p data-k="composed">{composed}</p>
<p data-k="decomposed">{decomposed}</p>
<h2 id={slugify("Making the GIL Optional")} data-k="anchor">anchor</h2>
