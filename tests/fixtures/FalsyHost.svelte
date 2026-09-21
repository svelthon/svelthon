<script module>
    import FalsyLeaf from './FalsyLeaf.svelte';
</script>

<script lang="python">
# A context holding the two falsy values a lookup can be asked for, and a child
# given falsy props explicitly — which is a different question from the child's
# own defaults: `0` passed is a value, `0` defaulted is a value, and absence is
# None. The three used to be one.
set_context("zero", 0)
set_context("empty", "")
</script>

<div data-k="passed">
    <FalsyLeaf count={0} label="" flag={False} rows={[]} />
</div>

<div data-k="defaulted">
    <FalsyLeaf />
</div>
