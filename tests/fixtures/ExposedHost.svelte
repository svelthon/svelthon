<script module>
    import Exposed from './Exposed.svelte';
</script>

<script lang="python">
# The parent side: `bind:this` fills a name with the child itself, and what it
# finds there is whatever the child exported.
mine = None
said = ""


def call_it():
    global said
    said = "{} / {}".format(mine.bump(2), hasattr(mine, "internal"))
</script>

<Exposed bind:this={mine} />

<p data-k="said">{said}</p>
<button data-k="go" onclick={call_it}>call</button>
