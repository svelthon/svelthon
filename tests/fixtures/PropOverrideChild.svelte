<script lang="python">
# A prop the child writes to: an override until the parent passes a new value,
# and the declared default once the parent passes nothing again.
amount: float = 0.25

@export
def own():
    global amount
    amount = 0.5

@export
def model():
    return str(amount)
</script>

<p>{amount}</p>
