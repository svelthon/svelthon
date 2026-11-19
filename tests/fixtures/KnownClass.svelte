<script lang="python">
# Classes written as strings and as choices between strings, read by Svelte for
# the selectors they may take.
on = True


def flip():
    global on
    on = not on
</script>

<button data-k="flip" onclick={flip}>flip</button>
<p data-k="literal" class={"active"}>x</p>
<p data-k="choice" class={"active" if on else "other"}>x</p>
<p data-k="nested" class={"active" if on else ("other" if not on else "")}>x</p>
<p data-k="quoted" class="x {"active" if on else "other"}">x</p>
