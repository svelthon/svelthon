<script lang="python">
import models
data: dict
</script>

<p data-k="value">{" | ".join(models.describe(one) for one in data["items"]) or "empty"}</p>
