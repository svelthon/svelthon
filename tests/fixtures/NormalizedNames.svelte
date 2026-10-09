<script lang="python">
# Identifiers as Python reads them, normalized to NFKC: a ligature and an accent
# written in two code points name what their plain spelling names, in the markup
# as in the script, a name the markup declares included, read or written.
class Box:
    def __init__(self):
        self.field = "field"
        self.café = "composed"


box = Box()
count = 0
</script>

<p data-k="ligature">{box.ﬁeld}</p>
<p data-k="decomposed">{box.café}</p>
<p data-k="lambda">{(lambda one: one.ﬁeld)(box)}</p>
{#each ["OK"] as ﬁeld}<p data-k="each">{field}</p>{/each}
{#each ["OK"] as field}<p data-k="each back">{ﬁeld}</p>{/each}
{#snippet shown(ﬁeld)}<p data-k="snippet">{field}</p>{/snippet}
{@render shown("OK")}
{ﬂag = "OK"}<p data-k="declared">{flag}</p>
{ｔｅｘｔ = "a"}<input data-k="bind" bind:value={text} /><p data-k="bound">{text}</p>
<button onclick={lambda: (ｃｏｕｎｔ := count + 1)}>add</button>
<output>{count}</output>
