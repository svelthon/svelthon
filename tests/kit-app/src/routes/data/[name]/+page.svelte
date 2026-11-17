<script lang="python">
import models
data: dict
form: dict = None
</script>

<p data-k="value">{models.describe(data["value"])}</p>
<p data-k="top">{models.describe(data["top"])} in {type(data).__name__}</p>
<form method="POST"><button data-k="go">go</button></form>
<p data-k="form">{models.describe(form["value"]) if form else "no form"}</p>
