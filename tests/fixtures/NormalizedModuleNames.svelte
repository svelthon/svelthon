<script module>
    // Names Python reads in their NFKC form: a ligature, a full-width letter
    // and the Kelvin sign, and one that is then a builtin's, which it hides.
    const ﬁeld = 7;
    const ｉ = 8;
    const K = 9;
    const ｌｅｎ = () => 10;
</script>

<script lang="python">
pass
</script>

<output data-k="ligature">{ﬁeld}</output>
<output data-k="ligature, spelled plain">{field}</output>
<output data-k="full width">{i}</output>
<output data-k="kelvin">{K}</output>
<output data-k="builtin">{len()}</output>
