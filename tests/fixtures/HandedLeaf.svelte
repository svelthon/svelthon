<script>
    // A Svelte child, which reads a prop each time it reads it: in its text,
    // and when its button is clicked.
    let { id, name = 'blank', href = '/record/A', tick } = $props();
    let picked = $state('-');
</script>

<a data-k={id} {href}>{name} ({tick})</a>
<button data-k="{id}-pick" onclick={() => (picked = name)}>{picked}</button>
