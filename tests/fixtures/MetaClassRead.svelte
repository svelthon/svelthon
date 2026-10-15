<script lang="python">
# A class whose metaclass is the author's, read directly for one of its special
# methods: declared here, imported from a module, or read by a function of the
# reactive module that declares it.
from meta_models import Subject as Imported, change_subject
from meta_owned import size, change_owned

kind: str = "declared"


class Meta(type):
    def __len__(cls):
        return 1


class Subject(metaclass=Meta):
    pass


def replacement(cls):
    return 99


@export
def change():
    if kind == "declared":
        Meta.__len__ = replacement
    elif kind == "imported":
        change_subject()
    else:
        change_owned()


@export
def model():
    return len(Subject) if kind == "declared" else len(Imported) if kind == "imported" else size()
</script>

<output>{len(Subject) if kind == "declared" else len(Imported) if kind == "imported" else size()}</output>
