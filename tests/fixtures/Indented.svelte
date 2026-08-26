<script lang="python">
    importjs {cubicOut} from "svelte/easing"

    name = "world"

    TEXT = """one
    two"""

    def boom():
        raise ValueError("from an indented block")
</script>

<p data-k="name">{name.title()}</p>
<p data-k="text">{TEXT}</p>
<p data-k="js">{"yes" if cubicOut else "no"}</p>
<button data-k="boom" onclick={boom}>x</button>
