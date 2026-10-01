<script lang="python">
# An uncaught exception in a handler is an ordinary mistake, the kind anyone
# makes on their first afternoon. What it hands the host is the question.
def boom():
    raise ValueError("BOOM")


async def later():
    raise ValueError("LATER")
</script>

<button data-k="boom" onclick={boom}>boom</button>
<button data-k="later" onclick={later}>later</button>
