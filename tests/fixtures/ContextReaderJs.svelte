<script>
import { getContext } from 'svelte';

const amount = getContext('amount');
const half = getContext(0.5);
const absent = getContext('absent');
const underNone = getContext(null);
</script>

<p data-k="javascript-reads">{typeof amount}:{amount * 2}</p>
<p data-k="javascript-reads-key">{half}</p>
<p data-k="javascript-reads-none">{absent == null}:{Boolean(absent)}</p>
<p data-k="javascript-reads-none-key">{underNone}</p>
