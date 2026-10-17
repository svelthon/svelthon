<script lang="python">
importjs {greeting} from "#lib/greet.remote.py"
</script>

{#await greeting()}
    <p data-k="waiting">asking the server</p>
{:then answer}
    <p data-k="answer">{answer.text}, {answer.total}</p>
{/await}
