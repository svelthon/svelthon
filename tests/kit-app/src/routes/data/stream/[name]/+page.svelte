<script lang="python">
import models
data: dict
</script>

{#await data["later"] then value}<p data-k="value">{models.describe(value)}</p>{/await}
