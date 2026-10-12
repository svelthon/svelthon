# Imports whose module runs when the statement does, and only then.
import timing_log

if False:
    import timing_never
if False:
    from timing_never import value

timing_log.entries.append("before")
import timing_first
timing_log.entries.append("after")

try:
    import timing_fails
except ValueError:
    timing_log.entries.append("caught")


def later():
    import timing_later
    return timing_later.value


def again():
    try:
        import timing_fails
    except ValueError:
        timing_log.entries.append("caught again")


def attempts(load):
    outcomes = []
    for _ in range(3):
        try:
            outcomes.append(load())
        except ValueError:
            outcomes.append("failed")
    return outcomes


def flaky():
    import timing_flaky
    return timing_flaky.fresh()


def flaky_store():
    import timing_flaky_store
    return timing_flaky_store.fresh


def retried():
    return [attempts(flaky), attempts(flaky_store)]


def kept():
    rows = []
    for modules in (timing_log.flaky_modules, timing_log.flaky_store_modules):
        old, new = modules[0], modules[-1]
        shared = hasattr(old, "late")
        old.late = "written on the old one"
        rows.append([old is new, getattr(old, "first", "missing"), shared, new.late])
    return rows
