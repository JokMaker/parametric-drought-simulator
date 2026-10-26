"""Delete all crop-loss reports, so a demo can start from zero.

    python scripts/reset_reports.py --yes
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.reports import default_store  # noqa: E402

if "--yes" not in sys.argv:
    sys.exit(f"This deletes every crop-loss report in {default_store().path}. Run again with --yes to confirm.")
print(f"Deleted {default_store().clear()} report(s) from {default_store().path}")
