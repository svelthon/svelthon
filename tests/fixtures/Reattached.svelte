<script lang="python">
# A container taken out, left behind while its child changes, then put back.
# `inner` lives in a closure, so no name watches it: taken out, it is a dead end.
leaf = []
holder = []


def make():
    inner = [leaf]

    def detach():
        holder.clear()

    def reattach():
        holder.append(inner)

    def name():
        global named
        named = inner

    return [reattach, detach, name]


named = None
made = make()
attach = made[0]
detach = made[1]
name = made[2]
attach()


def touch():
    leaf.append(1)


def grow():
    leaf.append(2)
</script>

<button data-k="detach" onclick={detach}>detach</button>
<button data-k="touch" onclick={touch}>touch</button>
<button data-k="reattach" onclick={attach}>reattach</button>
<button data-k="grow" onclick={grow}>grow</button>
<button data-k="name" onclick={name}>name</button>
<p>{holder}</p>
<i>{named}</i>
