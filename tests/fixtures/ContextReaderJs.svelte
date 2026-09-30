<script>
import { getContext } from 'svelte';

const amount = getContext('amount');
const half = getContext(0.5);
</script>

<p data-k="javascript-reads">{typeof amount}:{amount * 2}</p>
<p data-k="javascript-reads-key">{half}</p>
