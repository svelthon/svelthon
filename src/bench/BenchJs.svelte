<script>
    // Le même composant, à l'identique, en JavaScript : c'est la référence.
    let total = $state(0);
    let items = $state([]);

    function tick() {
        total += 1;
    }

    function heavy() {
        let sum = 0;
        for (let i = 0; i < 500; i++) sum += i * i;
        total = sum;
    }

    function fill() {
        items = Array.from({ length: 500 }, (_, i) => ({ id: i, label: `row ${i}` }));
    }
</script>

<output data-k="total">{total}</output>
<button data-k="tick" onclick={tick}>tick</button>
<button data-k="heavy" onclick={heavy}>heavy</button>
<button data-k="fill" onclick={fill}>fill</button>
<ul data-k="rows">{#each items as row (row.id)}<li>{row.label}</li>{/each}</ul>
