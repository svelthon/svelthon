<script>
    let picked = $state(['a']);
    let choice = $state('a');
</script>

<input type="checkbox" value=a bind:group={picked} />
<input type="checkbox" value=b bind:group={picked} />
<input type=checkbox value="a" bind:group={picked} />
<input type=checkbox value="b" bind:group={picked} />
<input type=checkbox value=a bind:group={picked}/>
<input type=checkbox value=b bind:group={picked}/>
<input type="radio" value=a bind:group={choice} />
<input type="radio" value=b bind:group={choice} />
<input type=radio value=a bind:group={choice}/>
<input type=radio value=b bind:group={choice}/>
