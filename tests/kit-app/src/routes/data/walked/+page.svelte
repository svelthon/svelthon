<script lang="python">
form: dict = None


def walked(value):
    return type(value).__name__ + ":" + repr(list(value))
</script>

<form method="POST"><button data-k="go">go</button></form>
<p data-k="form">{walked(form["value"]) if form else "no form"}</p>
