<script lang="python">
import models
data: dict
</script>

<p data-k="items">{" | ".join(models.describe(one) for one in data["items"])}</p>
<p data-k="deep">{models.describe(data["deep"]["value"])}</p>
