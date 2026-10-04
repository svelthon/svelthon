<script>
    // The same instance API in Svelte: the witness for InstanceData.
    let conf = $state({ count: 0, rate: 0.5, none: null });
    let rows = $state([1, 2]);

    export function config() {
        return conf;
    }

    export function items() {
        return rows;
    }

    export function bump() {
        conf.count += 1;
        rows.push(3);
    }
</script>
