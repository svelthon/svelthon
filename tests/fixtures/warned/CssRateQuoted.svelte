<script lang="python">
# The CSS custom property of CssRates written between quotes, `--rate="{value}"`,
# which Svelte warns about on a component and reads as the braced one.
importjs Child from "../CssRateChild.svelte"


class Rate(float):
    pass


value = Rate(0.5)
</script>

<section data-k="quoted"><Child number={value} --rate="{value}" /></section>
