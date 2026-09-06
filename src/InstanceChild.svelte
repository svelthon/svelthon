<script lang="python">
# A child with something worth calling from outside: a method that changes its
# own state. Everything it needs to talk to its parent is already here — a prop
# coming down, a callback going up, a bindable going both ways.
label: str = "child"
told: callable = None
heard: str = bindable()

count = 0


def shout():
    global count
    count += 1
    return "shouted {} times".format(count)


def tell():
    if told is not None:
        told("the child called up")


def hear(what):
    global heard
    heard = what
</script>

<p class="child">
    <b>{label}</b> shouted {count} times, heard "{heard if heard else "nothing"}"
    <button onclick={tell}>call up</button>
    <button onclick={lambda: hear("its own click")}>hear</button>
</p>
