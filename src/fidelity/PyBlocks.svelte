<script lang="python">
# Les quatre sites de gabarit qui restaient en JavaScript après le passage des
# expressions en Python : l'itérable d'un {#each}, {#key}, {@const}, {@html}.

scores = {"b": 2, "a": 1}
pair = (1, 2)


def squares():
    return (x * x for x in range(4))


def rebuild():
    # Égal au précédent, mais un objet neuf : en JavaScript, une identité neuve.
    global pair
    pair = (1, 2)


def change():
    global pair
    pair = (1, 3)
</script>

<ul data-k="dict">{#each scores as k}<li>{k}</li>{/each}</ul>
<ul data-k="items">{#each scores.items() as [k, v]}<li>{k}={v}</li>{/each}</ul>
<ul data-k="range">{#each range(3) as n}<li>{n}</li>{/each}</ul>
<ul data-k="gen">{#each squares() as n}<li>{n}</li>{/each}</ul>
<ul data-k="const">{#each range(2) as n}{@const half = (n - 7) // 2}<li>{half}</li>{/each}</ul>
<ul data-k="keyed">{#each scores.items() as [k, v] (k)}<li>{k}{v}</li>{/each}</ul>

<div data-k="html">{@html "<b>" + str(len(scores)) + "</b>"}</div>

{#key pair}<span data-k="keyblock"></span>{/key}

<button data-k="rebuild" onclick={rebuild}>rebuild</button>
<button data-k="change" onclick={change}>change</button>
