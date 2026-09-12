<script lang="python">
# Python 3 accepts these names and so does Svelthon, which means every sign the
# dialect adds to Python has to accept them too, not only `=`.
élèves = ["Zoé"]
moyenne: float <=> 12.5

effectif => len(élèves)


def inscrire():
    élèves.append("Loïc")
</script>

<p data-k="effectif">{effectif}</p>
<p data-k="moyenne">{moyenne}</p>
<p data-k="élèves">{élèves}</p>

{#each élèves as élève}<span data-k="élève">{élève}</span>{/each}

{première = élèves[0]}
<p data-k="première">{première}</p>

<button data-k="inscrire" onclick={inscrire}>inscrire</button>
<button data-k="noter" onclick={lambda: (moyenne := 15.0)}>noter</button>
