"""
Sim-Loop — Automatic Parameter Optimizer

Strategies:
1. Grid Search: exhaustive sweep of parameter combinations
2. Nelder-Mead: gradient-free simplex optimization (scipy)
3. Random Search: random sampling of parameter space

The optimizer calls a user-provided simulation function repeatedly,
recording each run to the DB, and returns the best parameters found.
"""

import json
import time
import itertools
from typing import Callable, Any, Optional
from dataclasses import dataclass, field

from .recorder import record_run, get_latest_run

@dataclass
class OptimizationConfig:
    """Configuration for automatic optimization"""
    project: str
    # Parameter space: {name: [values]} for grid, {name: (min, max)} for continuous
    parameter_space: dict[str, Any]
    # Simulation function: (params: dict) -> list[dict] (test results)
    simulate_fn: Callable[[dict], list[dict]]
    # Objective: higher is better (default: sum of scores)
    objective_fn: Optional[Callable[[list[dict]], float]] = None
    # Method
    method: str = "grid"  # "grid", "nelder-mead", "random"
    # Limits
    max_iterations: int = 100
    db_path: str = None

@dataclass
class OptimizationResult:
    best_params: dict = field(default_factory=dict)
    best_score: float = 0
    best_run_id: int = 0
    total_iterations: int = 0
    elapsed_seconds: float = 0
    history: list[dict] = field(default_factory=list)

def default_objective(results: list[dict]) -> float:
    """Default: sum of scores + bonus for passed tests"""
    total = len(results)
    passed = sum(1 for r in results if r.get("passed", False))
    scores = sum(r.get("score", 0) for r in results)
    return scores + passed * 50  # heavily reward passing

def optimize_parameters(config: OptimizationConfig) -> OptimizationResult:
    """Run automatic parameter optimization"""
    objective = config.objective_fn or default_objective
    result = OptimizationResult()
    t0 = time.time()

    # Get parent run for lineage
    parent = get_latest_run(config.project, config.db_path)
    parent_id = parent["id"] if parent else None

    if config.method == "grid":
        result = _grid_search(config, objective, parent_id)
    elif config.method == "nelder-mead":
        result = _nelder_mead(config, objective, parent_id)
    elif config.method == "random":
        result = _random_search(config, objective, parent_id)
    else:
        raise ValueError(f"Unknown method: {config.method}")

    result.elapsed_seconds = time.time() - t0
    return result

def _grid_search(config: OptimizationConfig, objective, parent_id) -> OptimizationResult:
    """Exhaustive grid search over parameter space"""
    result = OptimizationResult()

    # Build grid
    param_names = list(config.parameter_space.keys())
    param_values = list(config.parameter_space.values())
    grid = list(itertools.product(*param_values))

    print(f"  Grid search: {len(grid)} combinations")

    for i, combo in enumerate(grid):
        if i >= config.max_iterations:
            break

        params = dict(zip(param_names, combo))
        t0 = time.time()
        test_results = config.simulate_fn(params)
        elapsed = int((time.time() - t0) * 1000)

        score = objective(test_results)
        passed = sum(1 for r in test_results if r.get("passed", False))

        # Record
        run_id = record_run(
            project=config.project,
            parameters=params,
            results=test_results,
            parent_run_id=parent_id,
            change_description=f"Grid search iteration {i+1}/{len(grid)}",
            change_reason="auto-optimization",
            method="grid-search",
            elapsed_ms=elapsed,
            db_path=config.db_path,
        )

        result.history.append({
            "iteration": i, "params": params, "score": score,
            "passed": passed, "total": len(test_results), "run_id": run_id,
        })

        if score > result.best_score:
            result.best_score = score
            result.best_params = params
            result.best_run_id = run_id

        result.total_iterations = i + 1

        # Progress
        status = "✓" if passed == len(test_results) else f"{passed}/{len(test_results)}"
        print(f"    [{i+1}/{len(grid)}] {status} score={score:.0f} params={params}")

    return result

def _nelder_mead(config: OptimizationConfig, objective, parent_id) -> OptimizationResult:
    """Nelder-Mead simplex optimization"""
    try:
        from scipy.optimize import minimize
    except ImportError:
        print("  scipy not available, falling back to grid search")
        return _grid_search(config, objective, parent_id)

    result = OptimizationResult()
    param_names = list(config.parameter_space.keys())

    # Initial point: midpoint of each range
    x0 = []
    bounds = []
    for name in param_names:
        lo, hi = config.parameter_space[name]
        x0.append((lo + hi) / 2)
        bounds.append((lo, hi))

    iteration = [0]

    def neg_objective(x):
        params = dict(zip(param_names, x))
        test_results = config.simulate_fn(params)
        score = objective(test_results)
        passed = sum(1 for r in test_results if r.get("passed", False))
        total = len(test_results)

        iteration[0] += 1
        run_id = record_run(
            project=config.project, parameters=params, results=test_results,
            parent_run_id=parent_id,
            change_description=f"Nelder-Mead iter {iteration[0]}",
            change_reason="auto-optimization",
            method="nelder-mead",
            db_path=config.db_path,
        )

        result.history.append({
            "iteration": iteration[0], "params": params,
            "score": score, "passed": passed, "total": total, "run_id": run_id,
        })

        if score > result.best_score:
            result.best_score = score
            result.best_params = params
            result.best_run_id = run_id

        status = "✓" if passed == total else f"{passed}/{total}"
        print(f"    [NM-{iteration[0]}] {status} score={score:.0f} {params}")

        return -score  # minimize negative

    opt_result = minimize(
        neg_objective, x0, method='Nelder-Mead',
        options={'maxiter': config.max_iterations, 'xatol': 0.001, 'fatol': 1.0},
    )

    result.total_iterations = iteration[0]
    result.best_params = dict(zip(param_names, opt_result.x))
    return result

def _random_search(config: OptimizationConfig, objective, parent_id) -> OptimizationResult:
    """Random sampling of parameter space"""
    import random
    result = OptimizationResult()

    param_names = list(config.parameter_space.keys())

    for i in range(config.max_iterations):
        params = {}
        for name in param_names:
            spec = config.parameter_space[name]
            if isinstance(spec, (list, tuple)) and len(spec) == 2 and isinstance(spec[0], (int, float)):
                params[name] = random.uniform(spec[0], spec[1])
            elif isinstance(spec, list):
                params[name] = random.choice(spec)

        test_results = config.simulate_fn(params)
        score = objective(test_results)
        passed = sum(1 for r in test_results if r.get("passed", False))

        run_id = record_run(
            project=config.project, parameters=params, results=test_results,
            parent_run_id=parent_id,
            change_description=f"Random search {i+1}/{config.max_iterations}",
            change_reason="auto-optimization",
            method="random-search",
            db_path=config.db_path,
        )

        result.history.append({
            "iteration": i, "params": params, "score": score,
            "passed": passed, "total": len(test_results), "run_id": run_id,
        })

        if score > result.best_score:
            result.best_score = score
            result.best_params = params
            result.best_run_id = run_id

        result.total_iterations = i + 1

        status = "✓" if passed == len(test_results) else f"{passed}/{len(test_results)}"
        print(f"    [R-{i+1}] {status} score={score:.0f}")

    return result
