<script module>
    // What the collector had to learn, and it is JavaScript because a
    // `<script module>` is: an import that is commented out declares nothing,
    // and one declaration binds two names.
    // import Absent from "./nowhere.js"
    const MARGE = 2, SIGNE = '·';
</script>

<script lang="python">
"""One component carrying every recent repair at once.

A unit test writes the smallest file that exercises one thing, and the smallest
file is the one where nothing meets anything. An author's file is large. This is
that file: each line below was a defect on its own, and what this measures is
whether they still hold when they sit together.
"""
from calendrier import date as apporté
from together_module import LIMIT, TITLE


class Ressource:
    def __init__(self, nom):
        self.nom = nom

    def fermer(self):
        # Written to a name the effect does not read. Writing back into
        # `ressource` would loop, and rightly: the effect reads `ressource` to
        # reach this method, so a teardown that mutates it is an effect that
        # writes what it reads. Worth knowing, and reachable only since a bound
        # method became a teardown at all.
        global fermetures
        fermetures = fermetures + 1


rôle = "hôte"
génération = 0
choix = ""
cochés = []
élèves = ["Ada", "Alan"]
ressource = Ressource("r")
fermetures = 0
compte = 0
ouvertures = "-"


@effect
def veille():
    # A bound method as the teardown, which `typeof === 'function'` dropped.
    #
    # A plain assignment, never `ouvertures.append(...)`: appending reads the
    # list to reach `.append`, so the effect would depend on what it writes and
    # Svelte loops. That trap is the model's, not a defect, and it belongs in
    # this file precisely because an author meets it here.
    global ouvertures
    ouvertures = f"ouvert:{génération}"
    return ressource.fermer


@effect.pre
def avant():
    js.String(génération)


def avancer():
    global génération
    génération += 1


def porter():
    global compte
    compte += 1


@export
def état():
    # What Python holds, read without going through the page.
    return f"{rôle}|{génération}|{choix}|{len(cochés)}|{fermetures}"
</script>

<h1 data-k="titre">{TITLE} {SIGNE} {LIMIT}</h1>

<!-- A name the author imported that collides with an injected helper: theirs
     wins, which is what `every-binding-is-the-authors` means. -->
<p data-k="apporté">{apporté(LIMIT)}</p>

<button data-k="avancer" onclick={avancer}>avancer</button>
<button data-k="morse" onclick={lambda: (compte := compte + 2)}>morse</button>
<p data-k="compte">{compte}</p>

<!-- A group value written as text around an interpolation, which the action
     read off the node and therefore read stale. -->
<input data-k="radio" type="radio" value="item-{génération}" bind:group={choix} />
<input data-k="nombre" type="radio" value={LIMIT} bind:group={choix} />
<p data-k="choix">{choix}</p>

<input data-k="case" type="checkbox" value="c-{génération}" bind:group={cochés} />
<p data-k="cochés">{cochés}</p>

{#each élèves as élève, rang (élève)}
    <p data-k="élève-{rang}">{élève}</p>
{/each}

{#snippet résumé(nom)}
    <span data-k="résumé">{nom} en {rôle}</span>
{/snippet}

{@render résumé(TITLE)}

{marge = LIMIT * MARGE}
<p data-k="marge">{marge}</p>

<p data-k="json">{tojson({"rôle": rôle, "limite": LIMIT})}</p>
<p data-k="ouvertures">{ouvertures}</p>

<style >
    h1 { font-weight: 600; }
</style>
