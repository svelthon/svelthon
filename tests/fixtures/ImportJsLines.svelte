<script lang="python">
importjs {fade} from "svelte/transition"


def boom():
    raise ValueError("line five above, line six here")
</script>

<button data-k="boom" onclick={boom}>x</button>
