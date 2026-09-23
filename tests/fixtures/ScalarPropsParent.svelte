<script>
import ScalarProps from './ScalarProps.svelte';

let amount = $state(0.42);
</script>

<button onclick={() => (amount = 0.75)}>change</button>
<ScalarProps {amount} two_way={amount} />
