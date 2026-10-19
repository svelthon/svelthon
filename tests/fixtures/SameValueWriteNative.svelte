<script>
    let { kind = 'state', tick, ratio = 1.5, level = $bindable(1.5) } = $props();
    let plain = $state(1.5);
    const round = (value) => Math.round(value * 100) / 100;

    $effect(() => {
        tick();
        if (kind === 'state') plain = round(plain);
        else if (kind === 'state same') plain = Number(plain);
        else if (kind === 'prop') ratio = round(ratio);
        else if (kind === 'bindable') level = round(level);
    });

    let doubled = $derived.by(() => {
        if (kind === 'derived write') plain = Number(plain);
        return Math.trunc(plain * 2);
    });

    export function change() {
        plain = 2.5;
        ratio = 2.5;
        level = 2.5;
    }
</script>

<output>{plain} {ratio} {level} {doubled}</output>
