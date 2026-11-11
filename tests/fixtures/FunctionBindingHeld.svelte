<script lang="python">
# The halves of a function binding are evaluated once, where the binding is
# made: the getter keeps the text it was made with, the setter its count.
text = "initial"


def make_get():
    first = text
    return lambda: f"{first}|{text}"


def make_put():
    count = 0

    def save(value):
        nonlocal count
        global text
        count += 1
        text = f"{value}#{count}"

    return save
</script>

<input bind:value={make_get(), make_put()} />
<p>{text}</p>
