"""Delete all crop-loss reports, so a demo can start from zero.

    python scripts/reset_reports.py --yes
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import reports  # noqa: E402

if "--yes" not in sys.argv:
    sys.exit("This deletes every crop-loss report in " + str(reports.DB_PATH) + ". Run again with --yes to confirm.")
print(f"Deleted {reports.clear()} report(s) from {reports.DB_PATH}")
