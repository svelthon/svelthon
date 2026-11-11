<script lang="python">
# A write of the body is the child's own, as Svelte's is: only the write the
# annotation makes declares the default.
upper: str
upper = upper.upper()

over: str = "d"
over = "over"

seen: str = "d"
if seen == "given":
    seen = "seen"

normed: str = "d"


def norm():
    global normed
    normed = normed.strip().upper()


norm()

count: int = 0
count += 1

kept: str = "kept"
none: str = None

bound: str = bindable("d")
bound = bound.upper()
</script>

<p>{upper}|{over}|{seen}|{normed}|{count}|{kept}|{none}|{bound}</p>
