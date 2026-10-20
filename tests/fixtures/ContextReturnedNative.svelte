<script>
    // ContextReturned in Svelte, whose `setContext` returns its context.
    import { setContext } from 'svelte';

    class Price extends Number {}

    const rows = ['a'];
    const price = new Price(0.5);
    const half = 0.5;
    const greet = () => 'hi';

    const same = [
        setContext('rows', rows) === rows,
        setContext('price', price) === price,
        setContext('half', half) === half,
        setContext('greet', greet) === greet
    ];
    const model = setContext('model', { count: 0 });
</script>

<p data-k="same">{same.map((one) => (one ? '1' : '0')).join(' ')}</p>
<p data-k="model">{model.count}</p>
