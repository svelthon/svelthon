<script lang="python">
# A class whose `__eq__` answers an int, which Python reads as true. Ordinary
# Python: `__eq__` may return anything.
class Token:
    def __init__(self, n):
        self.n = n

    def __eq__(self, other):
        return int(self.n == other.n)


class Plain:
    def __init__(self, n):
        self.n = n

    def __eq__(self, other):
        return self.n == other.n


selected = Token(1)
option = Token(1)
picked = [selected]

plain_selected = Plain(1)
plain_option = Plain(1)
plain_picked = [plain_selected]


def equal():
    return bool(selected == option)
</script>

<input data-k="radio" type="radio" bind:group={selected} value={option} />
<input data-k="box" type="checkbox" bind:group={picked} value={option} />

<input data-k="plain-radio" type="radio" bind:group={plain_selected} value={plain_option} />
<input data-k="plain-box" type="checkbox" bind:group={plain_picked} value={plain_option} />

<p data-k="equal">{equal()}</p>
