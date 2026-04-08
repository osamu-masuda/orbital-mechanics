"""
Sim-Loop — Session Report Generator

Generates markdown reports summarizing optimization sessions:
- Test result progression
- Parameter changes and their effects
- Lessons learned
- Remaining issues

Usage:
  from sim_loop.reporter import generate_report
  report = generate_report("lunar-lander", db_path="sim-loop.db")
  print(report)  # or save to file
"""

import json
import time
from datetime import datetime
from typing import Optional
from .database import get_db, init_db

def generate_report(project: str, db_path: str = None, since: str = None) -> str:
    """Generate a markdown session report for a project.

    Args:
        project: project name
        db_path: path to sim-loop.db
        since: ISO date string to filter runs (default: last 24h)
    """
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()

    if since is None:
        since = "datetime('now', '-24 hours')"
        time_filter = f"timestamp > {since}"
    else:
        time_filter = f"timestamp > '{since}'"

    # Get optimization runs
    cursor = db.execute(f"""
        SELECT * FROM optimization_runs
        WHERE project = ? AND {time_filter}
        ORDER BY id ASC
    """, (project,))
    runs = [dict(r) for r in cursor.fetchall()]

    # Get all runs for progression
    cursor = db.execute("""
        SELECT id, timestamp, passed_tests, total_tests, objective_value, method,
               change_description, outcome
        FROM optimization_runs WHERE project = ? ORDER BY id ASC
    """, (project,))
    all_runs = [dict(r) for r in cursor.fetchall()]

    # Get lessons
    cursor = db.execute("""
        SELECT * FROM lessons_learned
        WHERE project = ? OR applicable_to LIKE ?
        ORDER BY severity DESC, id DESC
    """, (project, f"%{project}%"))
    lessons = [dict(r) for r in cursor.fetchall()]

    # Get validations
    cursor = db.execute("""
        SELECT * FROM model_validations WHERE project = ? ORDER BY id DESC
    """, (project,))
    validations = [dict(r) for r in cursor.fetchall()]

    db.close()

    # Build report
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = []
    lines.append(f"# Session Report: {project}")
    lines.append(f"")
    lines.append(f"Generated: {now}")
    lines.append(f"")

    # === Summary ===
    if all_runs:
        first = all_runs[0]
        last = all_runs[-1]
        lines.append(f"## Summary")
        lines.append(f"")
        lines.append(f"| Metric | Value |")
        lines.append(f"|--------|-------|")
        lines.append(f"| Total runs | {len(all_runs)} |")
        lines.append(f"| First run | {first['timestamp']} |")
        lines.append(f"| Latest run | {last['timestamp']} |")
        lines.append(f"| Current pass rate | {last['passed_tests']}/{last['total_tests']} |")
        lines.append(f"| Best objective | {max(r['objective_value'] for r in all_runs):.1f} |")

        # Methods used
        methods = set(r['method'] for r in all_runs if r['method'])
        lines.append(f"| Methods used | {', '.join(methods)} |")
        lines.append(f"")

    # === Progression ===
    if len(all_runs) > 1:
        lines.append(f"## Test Progression")
        lines.append(f"")
        lines.append(f"| Run# | Pass | Score | Method | Change | Outcome |")
        lines.append(f"|------|------|-------|--------|--------|---------|")
        for r in all_runs:
            passed = f"{r['passed_tests']}/{r['total_tests']}"
            score = f"{r['objective_value']:.0f}" if r['objective_value'] else "—"
            method = r['method'] or "—"
            change = (r['change_description'] or "—")[:40]
            outcome = r['outcome'] or "—"
            lines.append(f"| {r['id']} | {passed} | {score} | {method} | {change} | {outcome} |")
        lines.append(f"")

    # === Best Parameters ===
    if all_runs:
        best_run = max(all_runs, key=lambda r: r['objective_value'] or 0)
        best_id = best_run['id']
        cursor2 = get_db(db_path) if db_path else get_db()
        c = cursor2.execute("SELECT parameters FROM optimization_runs WHERE id = ?", (best_id,))
        row = c.fetchone()
        cursor2.close()
        if row and row['parameters']:
            params = json.loads(row['parameters'])
            lines.append(f"## Best Parameters (Run #{best_id})")
            lines.append(f"")
            lines.append(f"```json")
            lines.append(json.dumps(params, indent=2))
            lines.append(f"```")
            lines.append(f"")

    # === Lessons Learned ===
    if lessons:
        lines.append(f"## Lessons Learned ({len(lessons)})")
        lines.append(f"")
        severity_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}
        for l in lessons:
            icon = severity_icon.get(l['severity'], "⚪")
            lines.append(f"### {icon} {l['pattern']}")
            lines.append(f"")
            lines.append(f"- **Root cause**: {l['root_cause']}")
            lines.append(f"- **Solution**: {l['solution']}")
            if l['applicable_to']:
                lines.append(f"- **Applies to**: {l['applicable_to']}")
            lines.append(f"")

    # === Model Validations ===
    if validations:
        lines.append(f"## Model Validations ({len(validations)})")
        lines.append(f"")
        for v in validations:
            status_icon = "✅" if v['status'] == 'verified' else "🔧" if v['status'] == 'fixed' else "❌"
            lines.append(f"- {status_icon} **{v['model_name']}** ({v['parameter']}): expected={v['expected_value']}, actual={v['actual_value']} [{v['status']}]")
            if v['fix_description']:
                lines.append(f"  - Fix: {v['fix_description']}")
        lines.append(f"")

    # === Remaining Issues ===
    if all_runs:
        last = all_runs[-1]
        if last['passed_tests'] < last['total_tests']:
            lines.append(f"## Remaining Issues")
            lines.append(f"")
            lines.append(f"- {last['total_tests'] - last['passed_tests']} test(s) still failing")
            try:
                results = json.loads(last.get('results_detail') or '[]')
                for r in results:
                    if not r.get('passed'):
                        pid = r.get('preset_id', r.get('preset', '?'))
                        outcome = r.get('outcome', '?')
                        lines.append(f"  - **{pid}**: {outcome}")
            except (json.JSONDecodeError, TypeError):
                pass
            lines.append(f"")

    return "\n".join(lines)

def save_report(project: str, output_dir: str = None, db_path: str = None) -> str:
    """Generate and save report to markdown file."""
    report = generate_report(project, db_path)

    if output_dir is None:
        from pathlib import Path
        output_dir = str(Path(__file__).parent.parent.parent / "docs")

    import os
    os.makedirs(output_dir, exist_ok=True)

    date = datetime.now().strftime("%Y-%m-%d")
    filename = f"session-report-{project}-{date}.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w") as f:
        f.write(report)

    return filepath
