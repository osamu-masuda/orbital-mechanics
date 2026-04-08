"""
Sim-Loop — Run Recorder

Records optimization runs, lessons learned, and model validations to DB.
"""

import json
import time
from typing import Any, Optional
from .database import get_db, init_db

def record_run(
    project: str,
    parameters: dict,
    results: list[dict],
    parent_run_id: Optional[int] = None,
    change_description: str = "",
    change_reason: str = "",
    method: str = "manual",
    elapsed_ms: int = 0,
    db_path: str = None,
) -> int:
    """Record an optimization run and return run ID"""
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()

    total = len(results)
    passed = sum(1 for r in results if r.get("passed", False))
    scores = [r.get("score", 0) for r in results]
    objective = sum(scores) / max(total, 1)

    # Determine outcome vs parent
    outcome = "no_change"
    if parent_run_id:
        cursor = db.execute("SELECT passed_tests, objective_value FROM optimization_runs WHERE id=?", (parent_run_id,))
        parent = cursor.fetchone()
        if parent:
            if passed > parent["passed_tests"]:
                outcome = "improved"
            elif passed < parent["passed_tests"]:
                outcome = "regressed"
            elif objective > parent["objective_value"]:
                outcome = "improved"
            elif objective < parent["objective_value"]:
                outcome = "regressed"

    cursor = db.execute("""
        INSERT INTO optimization_runs (project, parameters, total_tests, passed_tests,
            scores, results_detail, parent_run_id, change_description, change_reason,
            outcome, method, objective_value, elapsed_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project, json.dumps(parameters), total, passed,
        json.dumps(scores), json.dumps(results),
        parent_run_id, change_description, change_reason,
        outcome, method, objective, elapsed_ms,
    ))
    run_id = cursor.lastrowid
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
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()
    cursor = db.execute("""
        INSERT INTO lessons_learned (project, category, pattern, root_cause, solution,
            applicable_to, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (project, category, pattern, root_cause, solution, applicable_to, severity))
    lesson_id = cursor.lastrowid
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
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()
    cursor = db.execute("""
        INSERT INTO model_validations (project, model_name, parameter,
            expected_value, actual_value, reference_url, reference_title,
            status, fix_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project, model_name, parameter, expected_value, actual_value,
          reference_url, reference_title, status, fix_description))
    val_id = cursor.lastrowid
    db.commit()
    db.close()
    return val_id

def get_latest_run(project: str, db_path: str = None) -> Optional[dict]:
    """Get the most recent optimization run for a project"""
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()
    cursor = db.execute(
        "SELECT * FROM optimization_runs WHERE project=? ORDER BY id DESC LIMIT 1",
        (project,))
    row = cursor.fetchone()
    db.close()
    return dict(row) if row else None

def get_lessons(project: str = None, db_path: str = None) -> list[dict]:
    """Get lessons learned, optionally filtered by project"""
    init_db(db_path) if db_path else init_db()
    db = get_db(db_path) if db_path else get_db()
    if project:
        cursor = db.execute(
            "SELECT * FROM lessons_learned WHERE project=? OR applicable_to LIKE ? ORDER BY id DESC",
            (project, f"%{project}%"))
    else:
        cursor = db.execute("SELECT * FROM lessons_learned ORDER BY id DESC")
    rows = cursor.fetchall()
    db.close()
    return [dict(r) for r in rows]
