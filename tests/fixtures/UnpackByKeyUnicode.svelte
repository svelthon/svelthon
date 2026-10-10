<script lang="python">
# A key written bare in a pattern is a name, read as Python reads one, normalized:
# `ﬁeld` is `field`, `𝐊ey` is `Key` and `ｅx` is `ex`. A quoted key is a string,
# kept as written.
class Row:
    def __init__(self):
        self.field = 1
        self.Key = 2
        self.ex = 3


class Slotted:
    __slots__ = ("field", "Key", "ex")

    def __init__(self):
        self.field = 1
        self.Key = 2
        self.ex = 3


rows = [{"field": 1, "Key": 2, "ex": 3}, Row(), Slotted()]
</script>

{#each rows as {ﬁeld: a = 7, 𝐊ey: b = 7, ｅx: c = 7, "ﬁeld": d = 7}}<p>{a}|{b}|{c}|{d}</p>{/each}
<p data-k="rest">{#each rows[:1] as {ﬁeld: a, **rest}}{rest}{/each}</p>
