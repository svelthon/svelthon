<script>
    // Svelte idiomatique : $state proxifie en profondeur, donc muter une clé
    // notifie. La question est de savoir si l'attribut du DOM en tient compte.
    const attrs = $state({ 'data-n': '0' });
    const list = $state(['a']);

    function mutate() {
        attrs['data-n'] = '1';
        list.push('b');
    }
</script>

<p data-k="spread" {...attrs}>étalé</p>
<p data-k="attr" title={list.join(',')}>attribut calculé</p>
<p data-k="raw" title={list}>attribut brut</p>
<p data-k="witness">{JSON.stringify(attrs)} {list.length}</p>

<button data-k="mutate" onclick={mutate}>go</button>
