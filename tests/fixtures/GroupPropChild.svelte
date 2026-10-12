<script>
    let { group = $bindable() } = $props();

    export function write() {
        group = 0.25;
    }
</script>

<p>{typeof group}|{String(group)}</p>
