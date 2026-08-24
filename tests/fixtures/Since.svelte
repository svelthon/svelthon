<script lang="python">
# `timesince` reads a shared clock, so the block re-renders on its own when the
# displayed value would change. `when` is a prop, so a test can place the date.
when: str
locale: str = "fr-FR"
</script>

<p data-k="said">{timesince(when, locale)}</p>
