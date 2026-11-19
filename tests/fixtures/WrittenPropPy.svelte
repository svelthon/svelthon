<script lang="python">
# A Python child that writes its prop in a function, called or not yet, beside
# a derived of it, which Svelte holds as it holds the prop.
ticket: str
whole: object
rev: int

upper => ticket + "!"


def mine():
    global ticket
    ticket = "mine"
</script>

<p data-k="child">{rev}|{ticket}|{upper}|{whole.ticket}</p>
<button data-k="mine" onclick={mine}>m</button>
