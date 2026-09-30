<!-- <script module>const answer = -1;</script> -->
<script module>
    const opening = '<!--';
    const answer = 42;
    const closing = '-->';
</script>
<script lang="python">
# Comment delimiters are the author's text inside a block, a comment only in
# the markup: the commented module above is not the module.
wrapped = "<!-- kept -->"
opened = "<!--"
reached = answer
</script>
<style>
    p::before { content: '<!--'; }
</style>
<!-- a real comment -->
<p data-k="wrapped">{wrapped}</p>
<p data-k="opened">{opened}</p>
<p data-k="reached">{reached}</p>
