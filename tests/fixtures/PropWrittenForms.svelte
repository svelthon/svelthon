<script lang="python">
# Each prop written by a way of binding a module name that is no target: at the
# module's level as it runs, or by `edit()`.
import builtins

m_def: str
m_class: str
m_import: str
m_from: str
m_except: str
m_match: str
m_star: str
m_rest: str
m_vars: str
m_locals: str
f_def: str
f_class: str
f_import: str
f_except: str
f_globals_attr: str
f_renamed: str
f_builtins: str
f_traceback: str


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

vars()["m_vars"] = "mine"
locals()["m_locals"] = "mine"

g = globals


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

    edit.__globals__["f_globals_attr"] = "mine"
    g()["f_renamed"] = "mine"
    builtins.globals()["f_builtins"] = "mine"

    try:
        raise ValueError()
    except ValueError as error:
        error.__traceback__.tb_frame.f_globals["f_traceback"] = "mine"


def shown(name):
    if name not in globals():
        return "unbound"
    return "parent" if globals()[name] == "parent" else "written"
</script>

<p data-k="m">{shown("m_def")} {shown("m_class")} {shown("m_import")} {shown("m_from")} {shown("m_except")} {shown("m_match")} {shown("m_star")} {shown("m_rest")} {shown("m_vars")} {shown("m_locals")}</p>
<p data-k="f">{shown("f_def")} {shown("f_class")} {shown("f_import")} {shown("f_except")} {shown("f_globals_attr")} {shown("f_renamed")} {shown("f_builtins")} {shown("f_traceback")}</p>
