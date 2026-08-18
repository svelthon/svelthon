<script module>
    import { untrack } from 'svelte';
    import * as svelte from 'svelte';

    const ETIQUETTE = 'venu du JavaScript';
</script>

<script lang="python">
# Des noms JavaScript, lus depuis Python.
@derived
def majuscules():
    return ETIQUETTE.upper()
</script>

<p data-k="direct">{ETIQUETTE}</p>
<p data-k="derive">{majuscules}</p>
<p data-k="fonction">{"oui" if untrack else "non"}</p>
<p data-k="etoile">{"oui" if svelte else "non"}</p>
