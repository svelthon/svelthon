<script>
import { setContext } from 'svelte';
import ContextReaderPy from './ContextReaderPy.svelte';

setContext('amount', 0.42);
setContext(0.5, 'half');
</script>

<ContextReaderPy />
