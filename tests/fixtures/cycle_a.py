# Half of an import cycle: `cycle_b` imports this module while it runs.
__all__ = ["early", "late"]

early = "early"
import cycle_b
late = "late"
