<script lang="python">
# A boundary around a Python child that raises, with its `onerror` written in
# Python, and a way to fix the cause before `reset`.
importjs Divides from "./Divides.svelte"

divisor = 0
caught = []


def on_error(error, reset):
    caught.append(type(error).__name__)


def fix():
    global divisor
    divisor = 2
</script>

<button class="fix" onclick={fix}>fix</button>
<output class="caught">{caught}</output>

<svelte:boundary onerror={on_error}>
    <Divides n={divisor} />

    {#snippet failed(error, reset)}
        <p class="failed">{type(error).__name__}: {error}</p>
        <button class="reset" onclick={reset}>reset</button>
    {/snippet}
</svelte:boundary>
