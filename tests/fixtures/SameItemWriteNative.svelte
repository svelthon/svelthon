<script>
    let { kind = 'item', tick } = $props();
    let items = $state([1.5]);

    class Box {
        x = $state(1.5);
    }

    const box = new Box();
    const round = (value) => Math.round(value * 100) / 100;

    $effect(() => {
        tick();
        if (kind === 'item') items[0] = round(items[0]);
        else if (kind === 'item same') items[0] = Number(items[0]);
        else if (kind === 'item from the end') items[items.length - 1] = round(items[items.length - 1]);
        else if (kind === 'attribute') box.x = round(box.x);
        else if (kind === 'attribute same') box.x = Number(box.x);
    });

    let doubled = $derived.by(() => {
        if (kind === 'derived item') items[0] = Number(items[0]);
        else if (kind === 'derived attribute') box.x = Number(box.x);
        return Math.trunc(items[0] * 2 + box.x * 2);
    });

    export function change() {
        items[0] = 2.5;
        box.x = 2.5;
    }
</script>

<output>{items[0]} {box.x} {doubled}</output>
