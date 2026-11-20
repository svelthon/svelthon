<script lang="python">
# Each card imported under a query the test plugin answers with the other
# card's text (`tests/variants.js`), and under one that keeps its language.
importjs ToPython from "./LanguageCardNative.svelte?language=python"
importjs ToNative from "./LanguageCardPython.svelte?language=javascript"
importjs Kept from "./LanguageCardPython.svelte?language=kept"


class Price(float):
    currency = "EUR"


amount = Price(1.25)
</script>

<p data-k="to-python"><ToPython {amount} /></p>
<p data-k="to-native"><ToNative {amount} /></p>
<p data-k="kept"><Kept {amount} /></p>
