<script lang="python">
# Handlers read off a JavaScript object whose field the parent replaces in
# place, by a member, between quotes, chosen by a conditional or an `or`, and
# called by a lambda.
config: object
</script>

<button data-k="member" onclick={config.confirm}>member</button>
<button data-k="quoted" onclick="{config.confirm}">quoted</button>
<button data-k="conditional" onclick={config.confirm if config.ready else config.fallback}>conditional</button>
<button data-k="or" onclick={config.missing or config.confirm}>or</button>
<button data-k="lambda" onclick={lambda event: config.confirm(event)}>lambda</button>
