<script>
// The same directives in Svelte's own language: the short spelling is the long
// one with the name as its value.
let active = $state(null);
const empty = 0;
const on = 'yes';
let color = $state(null);
const size = '2em';

const toggle = () => {
    active = true;
    color = 'red';
};
</script>

<p data-k="none-short" class:active>a</p>
<p data-k="none-long" class:active={active}>a</p>
<p data-k="empty-short" class:empty>b</p>
<p data-k="empty-long" class:empty={empty}>b</p>
<p data-k="on-short" class:on>c</p>
<p data-k="on-long" class:on={on}>c</p>
<p data-k="color-short" style:color>d</p>
<p data-k="color-long" style:color={color}>d</p>
<p data-k="size-short" style:font-size={size} style:size>e</p>
<p data-k="size-long" style:font-size={size} style:size={size}>e</p>
<button onclick={toggle}>toggle</button>
