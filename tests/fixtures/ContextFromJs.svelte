<script>
import { setContext } from 'svelte';
import ContextReaderPy from './ContextReaderPy.svelte';

setContext('amount', 0.42);
</script>

<ContextReaderPy />
