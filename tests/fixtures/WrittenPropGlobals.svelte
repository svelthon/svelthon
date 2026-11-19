<script lang="python">
# The same child writing its prop through the module's namespace.
ticket: str
whole: object
rev: int

upper => ticket + "!"


def mine():
    globals()["ticket"] = "mine"
</script>

<p data-k="child">{rev}|{ticket}|{upper}|{whole.ticket}</p>
<button data-k="mine" onclick={mine}>m</button>
