<script>
    // Le mécanisme candidat, écrit à la main en JavaScript : deux signaux par
    // nom — la valeur, et un compteur de révision que le *lecteur* consulte.
    // Muter en place n'incrémente que le compteur, sans copier ni réaffecter.
    let items = $state.raw([1, 2]);
    let revision = $state.raw(0);

    // Ce que ferait l'accesseur du namespace.
    const read = () => {
        revision;
        return items;
    };

    const total = $derived.by(() => read().reduce((a, b) => a + b, 0));

    // Le cas dur : un dérivé qui rend *le même objet*.
    const same = $derived.by(() => read());

    function mutate() {
        items.push(items.length + 1);
        revision += 1;
    }

    function silently() {
        items.push(99); // sans toucher au compteur : témoin
    }
</script>

<ul data-k="each">{#each read() as x}<li>{x}</li>{/each}</ul>
<ul data-k="derived">{#each same as x}<li>{x}</li>{/each}</ul>
<output data-k="len">{read().length}</output>
<output data-k="total">{total}</output>

<button data-k="mutate" onclick={mutate}>mutate</button>
<button data-k="silently" onclick={silently}>silently</button>
