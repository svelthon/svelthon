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
