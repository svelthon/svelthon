<script lang="python">
# Each prop written by a way of binding a module name that is no target: at the
# module's level as it runs, or by `edit()`.
m_def: str
m_class: str
m_import: str
m_from: str
m_except: str
m_match: str
m_star: str
m_rest: str
f_def: str
f_class: str
f_import: str
f_except: str


def m_def():
    pass


class m_class:
    pass


import javascript as m_import
from javascript import JSON as m_from

try:
    raise ValueError()
except ValueError as m_except:
    pass

match "mine":
    case m_match:
        pass

match ["mine"]:
    case [*m_star]:
        pass

match {"a": 1}:
    case {**m_rest}:
        pass


@export
def edit():
    global f_def, f_class, f_import, f_except

    def f_def():
        pass

    class f_class:
        pass

    import javascript as f_import

    try:
        raise ValueError()
    except ValueError as f_except:
        pass


def shown(name):
    if name not in globals():
        return "unbound"
    return "parent" if globals()[name] == "parent" else "written"
</script>

<p data-k="m">{shown("m_def")} {shown("m_class")} {shown("m_import")} {shown("m_from")} {shown("m_except")} {shown("m_match")} {shown("m_star")} {shown("m_rest")}</p>
<p data-k="f">{shown("f_def")} {shown("f_class")} {shown("f_import")} {shown("f_except")}</p>
