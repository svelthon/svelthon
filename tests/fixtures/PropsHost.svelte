<script>
    import Greeting from '../../src/Greeting.svelte';

    let who = $state('Pierre');
</script>

<Greeting name={who} />
<button data-k="rename" onclick={() => (who = 'Ada')}>renommer</button>
