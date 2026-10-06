<script lang="python">
set_context("amount", 0.42)
set_context(0.5, "half")
set_context("absent", None)
set_context(None, "under none")
</script>

<ContextReaderJs />
<ContextNoneReaderPy />

<script module>
import ContextReaderJs from './ContextReaderJs.svelte';
import ContextNoneReaderPy from './ContextNoneReaderPy.svelte';
</script>
