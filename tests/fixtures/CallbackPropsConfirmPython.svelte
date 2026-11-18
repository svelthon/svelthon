<script lang="python">
revision: int
choice: str
onboarding: str
confirm: object
onconfirm: object
receipt = ""


def receive():
    global receipt
    receipt = "|".join([choice, onboarding, confirm(), onconfirm()])
</script>

<output data-k="preview">{revision}|{choice}|{onboarding}</output>
<button onclick={receive}>Confirm</button>
<output data-k="receipt">{receipt}</output>
