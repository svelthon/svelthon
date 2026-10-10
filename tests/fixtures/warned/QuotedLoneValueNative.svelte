<script>
    // The witness: the same values and the same quotes, in Svelte's own terms.
    import JavaScriptChild from '../QuotedLoneChildJs.svelte';

    let { kind = 'int' } = $props();
    let chosen = $state(1);
    const item = 1;
    const missing = undefined;
    const callback = () => 1;
    const value = () => (kind === 'int' ? 7 : kind === 'none' ? undefined : kind === 'list' ? [7] : callback);
</script>

<div data-k="js-bare"><JavaScriptChild data={value()} /></div>
<div data-k="js-double"><JavaScriptChild data="{value()}" /></div>
<div data-k="js-single"><JavaScriptChild data='{value()}' /></div>
<a href="{missing}" title='{missing}'>link</a>
<select bind:value={chosen}><option value="{item}">one</option></select>
