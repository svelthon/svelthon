<script lang="python">
# Every falsy value Python has, carried by a prop, by a prop's default, and by a
# context. `0`, `""`, `False` and `[]` are values an author writes on purpose,
# and each is the one input that tells `??` from `||` — `0 ?? x` is `0`, and
# `0 || x` is `x`.
count: int = 0
label: str = ""
flag: bool = False
rows: list = []

from_context = get_context("zero")
context_text = get_context("empty")


def kinds():
    # What the page cannot show: `0` and `None` are both short, and an empty
    # string and an absent one are both nothing at all. The type settles it.
    return "|".join(
        type(one).__name__
        for one in (count, label, flag, rows, from_context, context_text)
    )
</script>

<p data-k="count">{count}</p>
<p data-k="label">[{label}]</p>
<p data-k="flag">{flag}</p>
<p data-k="rows">{rows}</p>
<p data-k="context">{from_context}</p>
<p data-k="context-text">[{context_text}]</p>
<p data-k="kinds">{kinds()}</p>
