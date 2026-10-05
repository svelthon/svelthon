# Calls the callback it is handed, so the frame that raises is in another file.
__all__ = ["run"]


def run(callback):
    return callback()
