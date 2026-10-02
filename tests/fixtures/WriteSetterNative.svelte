<script>
// The same model in Svelte's own language.
let value = $state('before');
let reads = 0;
let readsAtWrite = -1;
let blocked = false;

const model = {
    get value() {
        reads++;
        if (blocked) throw new Error('a read is refused, a write is not');
        return value;
    },
    set value(next) {
        readsAtWrite = reads;
        value = next;
        blocked = false;
    }
};

export function reset(block) {
    reads = 0;
    readsAtWrite = -1;
    blocked = block;
}

export function written() {
    return [value, readsAtWrite];
}
</script>

<input bind:value={model.value} />
