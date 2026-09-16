<script lang="python">
importjs {explode} from "./thrower.js"


def crossing():
    explode()


def raising():
    raise ValueError("from Python, not JavaScript")
</script>

<button data-k="js" onclick={crossing}>x</button>
<button data-k="py" onclick={raising}>x</button>
