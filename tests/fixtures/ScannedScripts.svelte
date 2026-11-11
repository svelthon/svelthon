<script module>
    import { cubicOut } from 'svelte/easing';
</script>

<script lang="python">
    importjs { tweened } from "svelte/motion"
    importjs Child from "./Child.svelte"
    from helpers import double

    count = double(2)
</script>

<p>{count}</p>
