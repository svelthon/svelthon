<script>
    let boxes = $state([]);
    let choice = $state('');
</script>

<input data-k="box" type="checkbox" value="yes" checked={true} bind:group={boxes} />
<input data-k="radio" type="radio" value="yes" checked={true} bind:group={choice} />
<p data-k="model">{boxes.join(',')}|{choice}</p>
