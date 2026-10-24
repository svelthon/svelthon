<script>
    // The witness: Svelte's own deriveds, written at the top of the script.
    let base = 1;
    let arrow = $derived(base * 2);
    let fn = $derived.by(() => base * 3);
    let called = $derived.by(() => base * 4);

    arrow = fn = called = 99;
</script>

<output>{arrow} {fn} {called}</output>
