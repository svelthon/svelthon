<script lang="python">
importjs {shout} from "#lib/remote.py"
</script>

{#await shout()}
    <p data-k="waiting">asking remote.py</p>
{:then answer}
    <p data-k="answer">{answer.text}, {answer.length}</p>
{/await}
