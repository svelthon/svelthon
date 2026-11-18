<script lang="python">
# Three radios of one name: two bound to `picked`, the server checking the
# first, and one bound to `alternative`.
picked = "email"
alternative = None
</script>

<input data-k="email" type="radio" name="contact" value="email" bind:group={picked} />
<input data-k="mail" type="radio" name="contact" value="mail" bind:group={picked} />
<input data-k="other" type="radio" name="contact" value="other" bind:group={alternative} />
<p data-k="model">{picked or ""}|{alternative or ""}</p>
