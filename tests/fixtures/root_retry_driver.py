# Imports `root_retry`, which fails the first time, and handles what each
# attempt handed out.
__all__ = ["attempt", "stop_first", "bump", "same"]
import root_retry_state


def attempt():
    try:
        import root_retry
    except ValueError:
        return "failed"
    return "loaded"


def stop_first():
    root_retry_state.kept[0]()


def bump():
    import root_retry
    root_retry.bump()


def same():
    return root_retry_state.kept[0] is root_retry_state.kept[-1]
