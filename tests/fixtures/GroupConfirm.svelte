<script lang="python">
# A radio group the server checks, beside a confirmation that renders the page
# again without touching the choice.
picked = "a"
confirmed = ""


def confirm():
    global confirmed
    confirmed = picked
</script>

<form data-k="form">
    <input data-k="a" type="radio" name="contact" value="a" bind:group={picked} />
    <input data-k="b" type="radio" name="contact" value="b" bind:group={picked} />
    <button data-k="confirm" type="button" onclick={confirm}>Confirmer</button>
    <p data-k="message">{confirmed}</p>
</form>
