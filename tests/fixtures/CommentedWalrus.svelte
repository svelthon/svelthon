<script lang="python">
# Handlers whose walrus a comment or a line continuation runs through, as
# Python allows between any two tokens.
count = 0
</script>

<button data-k="leading" onclick={lambda: (
    # the value chosen
    count := 1
)}>leading</button>
<button data-k="between" onclick={lambda: (
    count  # the name
    := 2
)}>between</button>
<button data-k="joined" onclick={lambda: (count \
    := 3)}>joined</button>
<button data-k="trailing" onclick={lambda: (
    count := 4  # the value chosen
)}>trailing</button>
<button data-k="nested" onclick={lambda: ((
    count := 5  # the value chosen
))}>nested</button>
<button data-k="string" onclick={lambda: (count := len("#abcdef"))}>string</button>
<output>{count}</output>
