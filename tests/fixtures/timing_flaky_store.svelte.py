# Binds names, a derived nobody reads and one read later, then fails, the
# first time only; and keeps hold of itself. `late` is bound by the attempt
# that succeeds.
import timing_log
import timing_flaky_store as itself

timing_log.flaky_store_modules.append(itself)
timing_log.flaky_store_runs += 1
base = 10 * timing_log.flaky_store_runs


@derived
def hidden():
    timing_log.hidden_runs += 1
    return 7


@derived
def doubled():
    return base * 2


def slug():
    return slugify("Hello World")


if timing_log.flaky_store_runs == 1:
    first = True
    raise ValueError("first attempt")

late = True
fresh = "first" not in globals()
