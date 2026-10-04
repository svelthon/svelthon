<script lang="python">
# A linked list built by a loop and held by a name: the watch takes every node
# in hand at mount, and a change at the tail climbs every link back up.
size: int = 20000


class Node:
    def __init__(self, value, rest):
        self.value = value
        self.rest = rest


def build(n):
    head = None
    for i in range(n):
        head = Node(i, head)
    return head


chain = build(size)
held = []


def length(at):
    count = 0
    while at is not None:
        count += 1
        at = at.rest
    return count


def last():
    at = chain
    while at.rest is not None:
        at = at.rest
    return at


def bump():
    last().value += 1


def hold():
    held.append(build(size))
</script>

<p data-k="chain">{length(chain)}:{last().value}</p>
<p data-k="held">{len(held)}:{length(held[0]) if held else 0}</p>
<button class="bump" onclick={bump}>bump</button>
<button class="hold" onclick={hold}>hold</button>
