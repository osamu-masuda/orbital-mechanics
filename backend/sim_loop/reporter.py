"""
Sim-Loop — Session Report Generator (PostgreSQL / shared-db)

Generates markdown reports summarizing optimization sessions:
- Test result progression
- Parameter changes and their effects
- Lessons learned
- Remaining issues

Usage:
  from sim_loop.reporter import generate_report
  report = generate_report("lunar-lander")
  print(report)  # or save to file
"""

import json
from datetime import datetime
from typing import Optional

from .database import get_db


def _row_to_dict(cur, row):
    return {desc.name: val for desc, val in zip(cur.description, row)}


def generate_report(project: str, db_path: str = None, since_hours: int = 24) -> str:
    """Generate a markdown session report for a project.

    Args:
        project: project name
        db_path: 後方互換のため残す（無視される）
        since_hours: 過去何時間のランを詳細表示するか
    """
    db = get_db()
    cur = db.cursor()

    # 指定期間内のラン
    cur.execute(
        """SELECT * FROM sim_loop_runs
           WHERE source_project = %s AND timestamp > NOW() - (%s || ' hours')::interval
           ORDER BY id ASC""",
        (project, str(since_hours)),
    )
    runs = [_row_to_dict(cur, r) for r in cur.fetchall()]

    # 全ラン（遷移用）
    cur.execute(
        """SELECT id, timestamp, passed_tests, total_tests, objective_value, method,
                  change_description, outcome
           FROM sim_loop_runs
           WHERE source_project = %s
           ORDER BY id ASC""",
        (project,),
    )
    all_runs = [_row_to_dict(cur, r) for r in cur.fetchall()]

    # 教訓
    cur.execute(
        """SELECT * FROM sim_loop_lessons
           WHERE source_project = %s OR applicable_to LIKE %s
           ORDER BY severity DESC, id DESC""",
        (project, f"%{project}%"),
    )
    lessons = [_row_to_dict(cur, r) for r in cur.fetchall()]

    # バリデーション
    cur.execute(
        """SELECT * FROM sim_loop_validations
           WHERE source_project = %s ORDER BY id DESC""",
        (project,),
    )
    validations = [_row_to_dict(cur, r) for r in cur.fetchall()]

    db.close()

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = []
    lines.append(f"# Session Report: {project}")
    lines.append("")
    lines.append(f"Generated: {now}")
    lines.append("")

    if all_runs:
        first = all_runs[0]
        last = all_runs[-1]
        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total runs | {len(all_runs)} |")
        lines.append(f"| First run | {first['timestamp']} |")
        lines.append(f"| Latest run | {last['timestamp']} |")
        lines.append(f"| Current pass rate | {last['passed_tests']}/{last['total_tests']} |")
        best_obj = max((r['objective_value'] or 0) for r in all_runs)
        lines.append(f"| Best objective | {best_obj:.1f} |")
        methods = sorted({r['method'] for r in all_runs if r['method']})
        lines.append(f"| Methods used | {', '.join(methods)} |")
        lines.append("")

    if len(all_runs) > 1:
        lines.append("## Test Progression")
        lines.append("")
        lines.append("| Run# | Pass | Score | Method | Change | Outcome |")
        lines.append("|------|------|-------|--------|--------|---------|")
        for r in all_runs:
            passed = f"{r['passed_tests']}/{r['total_tests']}"
            score = f"{r['objective_value']:.0f}" if r['objective_value'] else "—"
            method = r['method'] or "—"
            change = (r['change_description'] or "—")[:40]
            outcome = r['outcome'] or "—"
            lines.append(f"| {r['id']} | {passed} | {score} | {method} | {change} | {outcome} |")
        lines.append("")

    if all_runs:
        best_run = max(all_runs, key=lambda r: r['objective_value'] or 0)
        # パラメータは runs (期間内) から再取得
        if runs:
            best_detail = max(runs, key=lambda r: r['objective_value'] or 0)
            params = best_detail.get('parameters')
            if params:
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except json.JSONDecodeError:
                        params = None
                if params:
                    lines.append(f"## Best Parameters (Run #{best_run['id']})")
                    lines.append("")
                    lines.append("```json")
                    lines.append(json.dumps(params, indent=2))
                    lines.append("```")
                    lines.append("")

    if lessons:
        lines.append(f"## Lessons Learned ({len(lessons)})")
        lines.append("")
        severity_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}
        for l in lessons:
            icon = severity_icon.get(l['severity'], "⚪")
            lines.append(f"### {icon} {l['pattern']}")
            lines.append("")
            lines.append(f"- **Root cause**: {l['root_cause']}")
            lines.append(f"- **Solution**: {l['solution']}")
            if l['applicable_to']:
                lines.append(f"- **Applies to**: {l['applicable_to']}")
            lines.append("")

    if validations:
        lines.append(f"## Model Validations ({len(validations)})")
        lines.append("")
        for v in validations:
            status_icon = "✅" if v['status'] == 'verified' else "🔧" if v['status'] == 'fixed' else "❌"
            lines.append(
                f"- {status_icon} **{v['model_name']}** ({v['parameter']}): "
                f"expected={v['expected_value']}, actual={v['actual_value']} [{v['status']}]"
            )
            if v['fix_description']:
                lines.append(f"  - Fix: {v['fix_description']}")
        lines.append("")

    if all_runs:
        last = all_runs[-1]
        if last['passed_tests'] < last['total_tests']:
            lines.append("## Remaining Issues")
            lines.append("")
            lines.append(f"- {last['total_tests'] - last['passed_tests']} test(s) still failing")
            lines.append("")

    return "\n".join(lines)


def save_report(project: str, output_dir: str = None, db_path: str = None) -> str:
    report = generate_report(project)

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
