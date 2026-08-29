<script module>
    import BindArrowChild from './BindArrowChild.svelte';
</script>

<script>
    let text = $state('hello');
</script>

<div data-k="bound"><BindArrowChild bind:value={text} /></div>
<div data-k="unbound"><BindArrowChild /></div>
<p data-k="parent">{text}</p>
