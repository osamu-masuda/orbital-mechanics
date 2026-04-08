"""
Sim-Loop — Database Models

Tables:
- optimization_runs: Each test run with parameters, results, and lineage
- lessons_learned: Failure patterns → root cause → solution
- model_validations: Physics model verification against references
"""

SCHEMA = """
CREATE TABLE IF NOT EXISTS optimization_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    -- Parameters used in this run
    parameters TEXT NOT NULL,        -- JSON: {"rcs_gain": 1.0, ...}
    -- Test results
    total_tests INTEGER,
    passed_tests INTEGER,
    scores TEXT,                     -- JSON: [85, 96, 0, ...]
    results_detail TEXT,             -- JSON: full test results
    -- Lineage
    parent_run_id INTEGER REFERENCES optimization_runs(id),
    -- What changed from parent
    change_description TEXT,         -- "RCS gain 0.3→1.0"
    change_reason TEXT,              -- "attitude response too slow"
    outcome TEXT,                    -- "improved", "regressed", "no_change"
    -- Optimization metadata
    method TEXT,                     -- "manual", "nelder-mead", "grid-search", "ai"
    objective_value REAL,            -- scalar optimization objective
    elapsed_ms INTEGER              -- simulation time
);

CREATE TABLE IF NOT EXISTS lessons_learned (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    category TEXT,                   -- "control", "physics", "numerics", "ui"
    pattern TEXT NOT NULL,            -- "H/S overshoot at zero crossing"
    root_cause TEXT,                 -- "PD controller reversal too slow"
    solution TEXT,                   -- "Two-mode: brake>3m/s, micro-correct<3m/s"
    applicable_to TEXT,              -- "any PD-controlled landing" or project list
    severity TEXT DEFAULT 'medium',  -- "critical", "high", "medium", "low"
    verified INTEGER DEFAULT 0       -- 1 = confirmed fix
);

CREATE TABLE IF NOT EXISTS model_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    model_name TEXT NOT NULL,         -- "barometric_formula"
    parameter TEXT,                   -- "exponent"
    expected_value TEXT,              -- "5.255"
    actual_value TEXT,                -- "5255 (bug: ×1000)"
    reference_url TEXT,               -- NASA document URL
    reference_title TEXT,
    status TEXT DEFAULT 'open',       -- "open", "fixed", "verified"
    fix_description TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON optimization_runs(project);
CREATE INDEX IF NOT EXISTS idx_lessons_project ON lessons_learned(project);
CREATE INDEX IF NOT EXISTS idx_validations_project ON model_validations(project);
"""
