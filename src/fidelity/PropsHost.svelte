<script>
    import Greeting from '../Greeting.svelte';

    let who = $state('Pierre');
</script>

<Greeting name={who} />
<button data-k="rename" onclick={() => (who = 'Ada')}>renommer</button>
