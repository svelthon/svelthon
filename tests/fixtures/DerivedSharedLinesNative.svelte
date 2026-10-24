<script>
    // The witness: the same lines in Svelte, and the value the `:=` hands the
    // default written out.
    let base = $state(1);
    let lined = $derived(base * 2); let other = 1;
    let first = 1; let overridden = $derived(base * 3); overridden = 99;
    let between = $derived(base * 4 + 5);

    export const held = () => `${lined} ${other} ${first} ${overridden} ${between}`;
    export function bump() {
        base += 1;
    }
</script>

<p data-k="shown">{lined} {other} {first} {overridden} {between}</p>
