#!/usr/bin/env python3
"""
Orbital Mechanics — Test Runner + Optimizer

Usage:
  python3 run_tests.py                     # Run all tests
  python3 run_tests.py --optimize          # Auto-optimize (grid)
  python3 run_tests.py --optimize --method nelder-mead
  python3 run_tests.py --lessons           # Show lessons
"""

import sys
import json
import time
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app.physics import run_simulation, PRESETS, set_tuning, TUNING

sys.path.insert(0, str(Path(__file__).parent / "sim_loop"))
from sim_loop import record_run, record_lesson, get_lessons
from sim_loop.recorder import get_latest_run
from sim_loop.optimizer import optimize_parameters, OptimizationConfig

DB_PATH = str(Path(__file__).parent / "sim_loop" / "sim-loop.db")

def run_all_tests(presets=None):
    if presets is None:
        presets = list(PRESETS.keys())
    results = []
    for pid in presets:
        t0 = time.time()
        r = run_simulation(pid, "full-auto")
        elapsed = time.time() - t0
        passed = r.outcome == "docked" and r.docking_speed < 0.5
        results.append({
            "preset_id": pid, "outcome": r.outcome, "score": r.score,
            "mission_time": r.mission_time, "docking_speed": r.docking_speed,
            "fuel_used": r.fuel_used, "min_range": round(r.min_range, 1),
            "max_range": round(r.max_range, 0), "maneuver_count": r.maneuver_count,
            "passed": passed, "sim_time_ms": round(elapsed * 1000),
        })
    return results

def print_results(results):
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    print(f"\n{'='*70}")
    print(f"  ORBITAL MECHANICS — {passed}/{total} PASSED")
    print(f"{'='*70}\n")
    for r in results:
        s = "✓" if r["passed"] else "✗"
        print(f"  {s} {r['preset_id']:20s} {r['outcome']:10s} score={r['score']:3d} dock={r['docking_speed']:.2f}m/s fuel={r['fuel_used']:.0f}kg min={r['min_range']:.0f}m")
    print(f"\n  Summary: {passed}/{total}")

def run_optimization(method="grid"):
    print(f"\n  Optimizing with {method}...")
    def simulate(params):
        set_tuning(params)
        return run_all_tests()

    if method == "grid":
        config = OptimizationConfig(
            project="orbital-mechanics",
            parameter_space={
                "phasing_boost_gain": [0.00002, 0.00004, 0.00006],
                "phasing_rbar_gain": [0.00003, 0.00005, 0.0001],
                "approach_pos_gain_near": [0.00003, 0.00005, 0.0001],
                "approach_vel_gain_near": [0.01, 0.02, 0.03],
            },
            simulate_fn=simulate, method="grid", max_iterations=81, db_path=DB_PATH,
        )
    else:
        config = OptimizationConfig(
            project="orbital-mechanics",
            parameter_space={
                "phasing_boost_gain": (0.00001, 0.0001),
                "phasing_rbar_gain": (0.00001, 0.0002),
                "approach_pos_gain_near": (0.00001, 0.0002),
                "approach_vel_gain_near": (0.005, 0.05),
                "proximity_target_rate_far": (-0.15, -0.03),
            },
            simulate_fn=simulate, method=method, max_iterations=40, db_path=DB_PATH,
        )

    result = optimize_parameters(config)
    print(f"\n  Best: score={result.best_score:.0f} params={result.best_params}")
    set_tuning(result.best_params)
    final = run_all_tests()
    print_results(final)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", help="Single preset")
    parser.add_argument("--optimize", action="store_true")
    parser.add_argument("--method", default="grid")
    parser.add_argument("--lessons", action="store_true")
    args = parser.parse_args()

    if args.lessons:
        for l in get_lessons("orbital-mechanics", DB_PATH):
            print(f"  [{l['severity']}] {l['pattern']}: {l['solution']}")
    elif args.optimize:
        run_optimization(args.method)
    else:
        results = run_all_tests([args.preset] if args.preset else None)
        print_results(results)
        # 親ラン取得して系譜を記録
        parent = get_latest_run("orbital-mechanics", db_path=DB_PATH)
        parent_id = parent["id"] if parent else None
        record_run("orbital-mechanics", dict(TUNING), results, method="manual",
                   parent_run_id=parent_id, db_path=DB_PATH)
