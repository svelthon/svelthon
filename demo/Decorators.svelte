<script lang="python">
items = []
seen = "—"


@derived
def total():
    return sum(items)


@effect
def announce():
    global seen
    seen = f"{len(items)} items · total {total}"


def add():
    items.append(len(items) + 1)   # mutating is enough


def on_mount():
    print("mounted")
</script>

<output>{items}</output>
<output>@derived · {total}</output>
<output>@effect · {seen}</output>

<button onclick={add}>add()</button>
