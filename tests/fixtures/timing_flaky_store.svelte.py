# Binds a name and a derived nobody reads, then fails, the first time only;
# and keeps hold of itself. `late` is bound by the attempt that succeeds.
import timing_log
import timing_flaky_store as itself

timing_log.flaky_store_modules.append(itself)
timing_log.flaky_store_runs += 1


@derived
def hidden():
    timing_log.hidden_runs += 1
    return 7


if timing_log.flaky_store_runs == 1:
    first = True
    raise ValueError("first attempt")

late = True
fresh = "first" not in globals()
