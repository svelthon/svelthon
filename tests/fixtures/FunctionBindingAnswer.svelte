<script lang="python">
# What a setter answers is nobody's: a generator it returns is never walked,
# answered at once or by a coroutine.
text = "initial"
walks = 0


def get():
    return text


def lazy():
    global walks
    walks += 1
    yield 42


def put(value):
    global text
    text = value.upper()
    return lazy()


async def put_later(value):
    global text
    text = value.upper()
    return lazy()
</script>

<input data-k="now" bind:value={get, put} />
<input data-k="later" bind:value={get, put_later} />
<p>{text}|{walks}</p>
