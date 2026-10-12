# A module with a root, whose first attempt stops the root, keeps its
# destructor and fails; the next attempt succeeds.
__js__ = {"./root_retry_log.js": ["record"]}
import root_retry_state

count = 0


@effect.root
def watch():
    record(count)


root_retry_state.attempts += 1
root_retry_state.kept.append(watch)
if root_retry_state.attempts == 1:
    watch()
    raise ValueError("first attempt")


def bump():
    global count
    count += 1
