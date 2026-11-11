<script lang="python">
# Svelte's function binding: the field shows what `get` answers, and what is
# typed reaches `put`, with or without the parentheses, and as two lambdas.
text = "s"


def get():
    return text.upper()


def put(value):
    global text
    text = value
</script>

<input data-k="bare" bind:value={get, put} />
<input data-k="grouped" bind:value={(get, put)} />
<input data-k="lambdas" bind:value={lambda: text * 2, put} />
<p data-k="text">{text}</p>
