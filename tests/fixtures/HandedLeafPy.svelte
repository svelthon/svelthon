<script lang="python">
# A Python child, which reads a prop each time it reads it, as a Svelte child
# does: in its text, and when its button is clicked.
id: str
name: str = "blank"
href: str = "/record/A"
tick: int
picked = "-"


def pick():
    global picked
    picked = name
</script>

<a data-k={id} {href}>{name} ({tick})</a>
<button data-k="{id}-pick" onclick={pick}>{picked}</button>
