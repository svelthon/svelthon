<script lang="python">
# A dataclass in a component: the shortest an object-shaped record can be, and a
# test of the stdlib closure at the same time — `from dataclasses import
# dataclass` is exactly the import form that used never to travel.
from dataclasses import dataclass


@dataclass
class Pep:
    number: int
    title: str
    year: int

    @property
    def url(self):
        return "https://peps.python.org/pep-{:04d}/".format(self.number)


pep = Pep(703, "Making the GIL Optional", 2023)
twin = Pep(703, "Making the GIL Optional", 2023)


def bump():
    global pep
    pep.year = 2024
</script>

<p data-k="field">{pep.title}</p>
<p data-k="computed">{pep.url}</p>
<p data-k="year">{pep.year}</p>
<p data-k="equal">{pep == twin}</p>
<p data-k="repr">{repr(pep)}</p>

<button data-k="bump" onclick={bump}>bump</button>
