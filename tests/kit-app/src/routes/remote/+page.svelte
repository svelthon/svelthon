<script lang="python">
import models
importjs {greeting, facts} from "#lib/greet.remote.py"
</script>

{#await greeting()}
    <p data-k="waiting">asking the server</p>
{:then answer}
    <p data-k="answer">{answer["text"]}, {answer["total"]}</p>
{/await}

{#await facts() then known}
    <p data-k="facts">{known["text"]}, {known["squares"]}, {models.describe(known["point"])}</p>
{/await}
