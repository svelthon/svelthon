<script module>
    import CtxMiddle from './CtxMiddle.svelte';
</script>

<script lang="python">
label: str = "dark"

set_context("theme", label)
</script>

<CtxMiddle />
