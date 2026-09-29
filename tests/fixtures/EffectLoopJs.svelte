<script>
    // An effect that reads the state it changes: `push` reads `history`.
    let count = $state(0);
    let history = $state([]);

    $effect(() => {
        history.push(count);
    });
</script>

<output class="history">{history.length}</output>
