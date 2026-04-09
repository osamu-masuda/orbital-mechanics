"""
Sim-Loop — Run Recorder (PostgreSQL / shared-db)

テーブル: sim_loop_runs / sim_loop_lessons / sim_loop_validations
設計: common/docs/sim-loop-aggregation-design-2026-04-09.md
"""

import json
from typing import Any, Optional

from .database import get_db


def record_run(
    project: str,
    parameters: dict,
    results: list[dict],
    parent_run_id: Optional[int] = None,
    change_description: str = "",
    change_reason: str = "",
    method: str = "manual",
    elapsed_ms: int = 0,
    db_path: str = None,  # 後方互換のため残す
) -> int:
    """Record an optimization run and return run ID"""
    db = get_db()
    cur = db.cursor()

    total = len(results)
    passed = sum(1 for r in results if r.get("passed", False))
    scores = [r.get("score", 0) for r in results]
    objective = sum(scores) / max(total, 1)

    # Determine outcome vs parent
    outcome = "no_change"
    if parent_run_id:
        cur.execute(
            "SELECT passed_tests, objective_value FROM sim_loop_runs WHERE id = %s",
            (parent_run_id,),
        )
        parent = cur.fetchone()
        if parent:
            p_passed, p_objective = parent
            if passed > p_passed:
                outcome = "improved"
            elif passed < p_passed:
                outcome = "regressed"
            elif p_objective is not None and objective > p_objective:
                outcome = "improved"
            elif p_objective is not None and objective < p_objective:
                outcome = "regressed"

    cur.execute(
        """INSERT INTO sim_loop_runs
           (source_project, parameters, total_tests, passed_tests,
            scores, results_detail, parent_run_id, change_description, change_reason,
            outcome, method, objective_value, elapsed_ms)
           VALUES (%s, %s::jsonb, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (
            project, json.dumps(parameters), total, passed,
            json.dumps(scores), json.dumps(results),
            parent_run_id, change_description, change_reason,
            outcome, method, objective, elapsed_ms,
        ),
    )
    run_id = cur.fetchone()[0]
    db.commit()
    db.close()
    return run_id


def record_lesson(
    project: str,
    category: str,
    pattern: str,
    root_cause: str,
    solution: str,
    applicable_to: str = "",
    severity: str = "medium",
    db_path: str = None,
) -> int:
    """Record a lesson learned"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """INSERT INTO sim_loop_lessons
           (source_project, category, pattern, root_cause, solution,
            applicable_to, severity)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (project, category, pattern, root_cause, solution, applicable_to, severity),
    )
    lesson_id = cur.fetchone()[0]
    db.commit()
    db.close()
    return lesson_id


def record_validation(
    project: str,
    model_name: str,
    parameter: str,
    expected_value: str,
    actual_value: str,
    reference_url: str = "",
    reference_title: str = "",
    status: str = "open",
    fix_description: str = "",
    db_path: str = None,
) -> int:
    """Record a model validation"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """INSERT INTO sim_loop_validations
           (source_project, model_name, parameter, expected_value, actual_value,
            reference_url, reference_title, status, fix_description)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (project, model_name, parameter, expected_value, actual_value,
         reference_url, reference_title, status, fix_description),
    )
    val_id = cur.fetchone()[0]
    db.commit()
    db.close()
    return val_id


def get_latest_run(project: str, db_path: str = None) -> Optional[dict]:
    """Get the most recent optimization run for a project"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT id, source_project, timestamp, total_tests, passed_tests,
                  outcome, method, objective_value
           FROM sim_loop_runs
           WHERE source_project = %s
           ORDER BY id DESC LIMIT 1""",
        (project,),
    )
    row = cur.fetchone()
    db.close()
    if row is None:
        return None
    return {
        "id": row[0],
        "project": row[1],
        "timestamp": row[2].isoformat() if row[2] else None,
        "total_tests": row[3],
        "passed_tests": row[4],
        "outcome": row[5],
        "method": row[6],
        "objective_value": row[7],
    }


def get_lessons(project: str = None, db_path: str = None) -> list[dict]:
    """Get lessons learned, optionally filtered by project"""
    db = get_db()
    cur = db.cursor()
    if project:
        cur.execute(
            """SELECT id, source_project, timestamp, category, pattern, root_cause,
                      solution, applicable_to, severity, verified
               FROM sim_loop_lessons
               WHERE source_project = %s OR applicable_to LIKE %s
               ORDER BY id DESC""",
            (project, f"%{project}%"),
        )
    else:
        cur.execute(
            """SELECT id, source_project, timestamp, category, pattern, root_cause,
                      solution, applicable_to, severity, verified
               FROM sim_loop_lessons
               ORDER BY id DESC""",
        )
    rows = cur.fetchall()
    db.close()
    return [
        {
            "id": r[0],
            "project": r[1],
            "timestamp": r[2].isoformat() if r[2] else None,
            "category": r[3],
            "pattern": r[4],
            "root_cause": r[5],
            "solution": r[6],
            "applicable_to": r[7],
            "severity": r[8],
            "verified": r[9],
        }
        for r in rows
    ]
