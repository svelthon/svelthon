<script lang="python">
ticket: str = ""
archive = {"ticket": {"state": "new"}}


def globals():
    return archive


def save():
    globals()["ticket"]["state"] = "saved"


def handed(globals):
    return globals().get("ticket")


save()
</script>

<p data-k="ticket">{ticket}</p>
<p data-k="state">{archive["ticket"]["state"]}|{handed(lambda: archive)["state"]}</p>
