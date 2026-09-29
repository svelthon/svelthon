<script>
import { getContext } from 'svelte';

const amount = getContext('amount');
</script>

<p data-k="javascript-reads">{typeof amount}:{amount * 2}</p>
