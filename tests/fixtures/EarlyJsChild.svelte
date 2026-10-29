<script>
// A pre effect whose cleanup reads the props a Python parent passes.
let { n, capture } = $props();

$effect.pre(() => {
    capture('run', n);
    return () => capture('clean', n);
});
</script>

<output>{n}</output>
