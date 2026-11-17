<script lang="python">
# The cases, each a link the browser check follows by client navigation, and
# the JavaScript containers around Python values.
import models
</script>

{#each models.CASES as name}<a href="/data/{name}" data-k={name}>{name}</a> {/each}
<a href="/data/ledger" data-n="ledger">ledger</a>
