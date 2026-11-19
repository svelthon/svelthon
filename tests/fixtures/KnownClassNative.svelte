<script>
    // The same in Svelte.
    let on = $state(true);

    function flip() {
        on = !on;
    }
</script>

<button data-k="flip" onclick={flip}>flip</button>
<p data-k="literal" class={'active'}>x</p>
<p data-k="choice" class={on ? 'active' : 'other'}>x</p>
<p data-k="nested" class={on ? 'active' : !on ? 'other' : ''}>x</p>
<p data-k="quoted" class="x {on ? 'active' : 'other'}">x</p>
