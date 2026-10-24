<script>
    // The witness: Svelte's own deriveds, written past their declaration.
    let base = $state(1);
    let arrow = $derived(base * 2);
    let fn = $derived.by(() => base * 3);
    let called = $derived.by(() => base * 4);

    export const held = () => `${arrow} ${fn} ${called}`;
    export function write(value) {
        arrow = fn = called = value;
    }
    export function bump() {
        base += 1;
    }
</script>

<p data-k="shown">{arrow} {fn} {called}</p>
