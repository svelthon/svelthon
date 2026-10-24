<script lang="python">
# Snippets one of whose parameters carries the snippet's name, by a default,
# a pattern, both, or a spelling Python reads as the same name; and a bare one.
pass
</script>

{#snippet first(first="ok")}<output>{first}</output>{/snippet}
{#snippet second({second})}<output>{second}</output>{/snippet}
{#snippet third([third])}<output>{third}</output>{/snippet}
{#snippet ｆｏｕｒｔｈ(fourth="ok")}<output>{fourth}</output>{/snippet}
{#snippet fifth([fifth]=["ok"])}<output>{fifth}</output>{/snippet}
{#snippet sixth({sixth}={"sixth": "ok"})}<output>{sixth}</output>{/snippet}
{#snippet seventh(seventh)}<output>{seventh}</output>{/snippet}

{@render first()}
{@render second({"second": "ok"})}
{@render third(["ok"])}
{@render fourth()}
{@render fifth()}
{@render sixth()}
{@render seventh("ok")}
