<script lang="python">
# A page that imports a server module, copied into the routes by
# `scripts/kit-check.sh` for a build SvelteKit must refuse.
importjs {token} from "#lib/server/secret.py"
</script>

<p>{token}</p>
