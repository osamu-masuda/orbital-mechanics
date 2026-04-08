#!/usr/bin/env python3
"""
Orbital Mechanics — Automated Test Runner
"""

import sys
import json
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app.physics import run_simulation, PRESETS

RESULTS_DIR = Path(__file__).parent / "test_results"
RESULTS_DIR.mkdir(exist_ok=True)

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
            "preset_id": pid,
            "outcome": r.outcome,
            "score": r.score,
            "mission_time": r.mission_time,
            "docking_speed": r.docking_speed,
            "fuel_used": r.fuel_used,
            "max_range": round(r.max_range, 0),
            "min_range": round(r.min_range, 1),
            "maneuver_count": r.maneuver_count,
            "checks": r.checks,
            "passed": passed,
            "sim_time_ms": round(elapsed * 1000),
        })

    return results

def print_results(results):
    passed = sum(1 for r in results if r["passed"])
    total = len(results)

    print(f"\n{'='*70}")
    print(f"  ORBITAL MECHANICS TEST RESULTS — {passed}/{total} PASSED")
    print(f"{'='*70}\n")

    for r in results:
        status = "✓ PASS" if r["passed"] else "✗ FAIL"
        print(f"  {status}  {r['preset_id']:20s}")
        print(f"         outcome={r['outcome']:10s} score={r['score']:3d} T={r['mission_time']:7.0f}s")
        print(f"         dock_speed={r['docking_speed']:.2f} m/s  fuel_used={r['fuel_used']:.0f}kg  maneuvers={r['maneuver_count']}")
        print(f"         max_range={r['max_range']:.0f}m  min_range={r['min_range']:.1f}m  sim={r['sim_time_ms']}ms")
        print()

    print(f"  Summary: {passed}/{total} passed")

    # Save
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filepath = RESULTS_DIR / f"run_{timestamp}.json"
    with open(filepath, "w") as f:
        json.dump({"timestamp": timestamp, "results": results}, f, indent=2)
    latest = RESULTS_DIR / "latest.json"
    with open(latest, "w") as f:
        json.dump({"timestamp": timestamp, "results": results}, f, indent=2)
    print(f"\n  Saved to: {filepath}")

if __name__ == "__main__":
    results = run_all_tests()
    print_results(results)
