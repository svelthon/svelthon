<script>
    // The same four shapes in JavaScript, to see where Svelte itself draws the
    // line. This component declares no Python, so the preprocessor leaves it
    // alone.
    let n = $state(0);
    let topRan = $state('never');
    let innerRan = $state('never');
    let late = $state('not tried');

    $effect(() => {
        topRan = `ran, n=${n}`;
    });

    function register() {
        $effect(() => {
            innerRan = `ran, n=${n}`;
        });
    }

    // Called while the component initialises, so there is a current owner.
    register();

    // Called later, from a click. There is no owner then, and Svelte says so.
    function tryLate() {
        try {
            $effect(() => {});
            late = 'accepted';
        } catch (error) {
            // Their message is a link in a built runtime, so the code is
            // what carries the meaning.
            const text = String(error.message || error);
            late = 'refused: ' + (text.match(/e\/(\w+)/) || [, text])[1];
        }
    }
</script>

<p>at the top: <b data-k="top">{topRan}</b></p>
<p>in a function, at init: <b data-k="inner">{innerRan}</b></p>
<p>in a function, on a click: <b data-k="late">{late}</b></p>
<button onclick={() => n++}>n = {n} +1</button>
<button data-k="try" onclick={tryLate}>make an effect from this click</button>
