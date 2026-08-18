<script module>
    import BindChild from './BindChild.svelte';
</script>

<script>
    let text = $state('hello');
</script>

<div data-k="bound"><BindChild bind:value={text} /></div>
<div data-k="unbound"><BindChild /></div>
<p data-k="parent">{text}</p>
<button data-k="reset" onclick={() => (text = 'reset')}>reset</button>
