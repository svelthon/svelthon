<script module>
    import { untrack } from 'svelte';
    import * as svelte from 'svelte';

    const LABEL = 'came from JavaScript';
</script>

<script lang="python">
# JavaScript names, read from Python.
@derived
def shouted():
    return LABEL.upper()
</script>

<p data-k="direct">{LABEL}</p>
<p data-k="derived">{shouted}</p>
<p data-k="function">{"yes" if untrack else "no"}</p>
<p data-k="star">{"yes" if svelte else "no"}</p>
