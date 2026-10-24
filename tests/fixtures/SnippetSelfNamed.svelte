<script lang="python">
# Snippets whose own scope binds the snippet's name: a parameter, by a
# default, a pattern, both, or a spelling Python reads as the same name, and a
# bare one; and a value the body declares, as state, as a derived, or from a
# parameter.
pass
</script>

{#snippet first(first="ok")}<output>{first}</output>{/snippet}
{#snippet second({second})}<output>{second}</output>{/snippet}
{#snippet third([third])}<output>{third}</output>{/snippet}
{#snippet ｆｏｕｒｔｈ(fourth="ok")}<output>{fourth}</output>{/snippet}
{#snippet fifth([fifth]=["ok"])}<output>{fifth}</output>{/snippet}
{#snippet sixth({sixth}={"sixth": "ok"})}<output>{sixth}</output>{/snippet}
{#snippet seventh(seventh)}<output>{seventh}</output>{/snippet}
{#snippet eighth()}{eighth = "ok"}<output>{eighth}</output>{/snippet}
{#snippet ninth()}{ninth => "ok"}<output>{ninth}</output>{/snippet}
{#snippet tenth(value)}{tenth = value}<output>{tenth}</output>{/snippet}

{@render first()}
{@render second({"second": "ok"})}
{@render third(["ok"])}
{@render fourth()}
{@render fifth()}
{@render sixth()}
{@render seventh("ok")}
{@render eighth()}
{@render ninth()}
{@render tenth("ok")}
