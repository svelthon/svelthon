<script lang="python">
# The markers spelled as Python reads them, by their NFKC form: full-width, a
# ligature, mathematical letters, two on one line, and a string holding one,
# which stays the author's.
notify: object = None
base = 1
said = "ｄｅｒｉｖｅｄ"


def run():
    notify(f"run {base}")


wide = ｄｅｒｉｖｅｄ(lambda: base * 2)


@ｄｅｒｉｖｅｄ
def decorated():
    return base * 3


math = 𝒅𝒆𝒓𝒊𝒗𝒆𝒅(lambda: base * 4)
ligated = eﬀect(run); lined = derived(lambda: base * 5)


@ｅｆｆｅｃｔ.pre
def early():
    notify(f"early {base}")


@export
def held():
    return f"{wide} {decorated} {math} {lined} {said}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{wide} {decorated} {math} {lined}</p>
