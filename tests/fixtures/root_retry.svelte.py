# A module with a root, whose first attempt stops the root, keeps its
# destructor and itself, and fails; the next attempt succeeds.
__js__ = {"./root_retry_log.js": ["record"]}
import root_retry_state
import root_retry as itself

count = 0


@effect.root
def watch():
    record(count)


root_retry_state.attempts += 1
root_retry_state.kept.append(watch)
root_retry_state.modules.append(itself)
if root_retry_state.attempts == 1:
    watch()
    raise ValueError("first attempt")


def bump():
    global count
    count += 1
