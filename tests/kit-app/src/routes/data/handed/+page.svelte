<script lang="python">
import models
data: dict
</script>

<p data-k="value">{models.describe(data["parent"]["value"])}</p>
<p data-k="top">{models.describe(data["parent"]["top"])} in {type(data["parent"]).__name__}</p>
