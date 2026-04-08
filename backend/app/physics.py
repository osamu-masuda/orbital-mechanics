"""
Orbital Mechanics — Headless Physics Engine (Python)

Port of TypeScript kepler.ts + simulation.ts + autopilot
Runs rendezvous & docking simulation without browser.
"""

import math
from dataclasses import dataclass, field
from typing import Optional

# Constants
MU_EARTH = 3.986004418e14  # m³/s²
R_EARTH = 6.371e6  # m
G0 = 9.80665  # m/s²
ISS_ALTITUDE = 408000  # m
PHYSICS_DT = 1.0  # seconds

# === Vector Math ===

@dataclass
class Vec3:
    x: float = 0
    y: float = 0
    z: float = 0

    def mag(self): return math.sqrt(self.x**2 + self.y**2 + self.z**2)
    def __add__(self, o): return Vec3(self.x+o.x, self.y+o.y, self.z+o.z)
    def __sub__(self, o): return Vec3(self.x-o.x, self.y-o.y, self.z-o.z)
    def scale(self, s): return Vec3(self.x*s, self.y*s, self.z*s)
    def dot(self, o): return self.x*o.x + self.y*o.y + self.z*o.z
    def cross(self, o): return Vec3(self.y*o.z-self.z*o.y, self.z*o.x-self.x*o.z, self.x*o.y-self.y*o.x)
    def norm(self):
        m = self.mag()
        return self.scale(1/m) if m > 1e-12 else Vec3()

# === Kepler Solver ===

def solve_kepler(M: float, e: float) -> float:
    E = M + e * math.sin(M)
    for _ in range(20):
        dE = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
        E -= dE
        if abs(dE) < 1e-12: break
    return E

def eccentric_to_true(E: float, e: float) -> float:
    return 2 * math.atan2(math.sqrt(1+e)*math.sin(E/2), math.sqrt(1-e)*math.cos(E/2))

def true_to_eccentric(nu: float, e: float) -> float:
    return 2 * math.atan2(math.sqrt(1-e)*math.sin(nu/2), math.sqrt(1+e)*math.cos(nu/2))

def true_to_mean(nu: float, e: float) -> float:
    E = true_to_eccentric(nu, e)
    return E - e * math.sin(E)

# === Orbital Elements ===

@dataclass
class OrbitalElements:
    sma: float = R_EARTH + ISS_ALTITUDE
    ecc: float = 0.0001
    inc: float = 0.9  # ~51.6°
    raan: float = 0
    arg_pe: float = 0
    true_anomaly: float = 0

def propagate(elem: OrbitalElements, dt: float) -> OrbitalElements:
    n = math.sqrt(MU_EARTH / elem.sma**3)
    M0 = true_to_mean(elem.true_anomaly, elem.ecc)
    M = (M0 + n * dt) % (2 * math.pi)
    E = solve_kepler(M, elem.ecc)
    nu = eccentric_to_true(E, elem.ecc)
    return OrbitalElements(elem.sma, elem.ecc, elem.inc, elem.raan, elem.arg_pe, nu)

def elements_to_state(elem: OrbitalElements) -> tuple[Vec3, Vec3]:
    sma, ecc, inc, raan, arg_pe, nu = elem.sma, elem.ecc, elem.inc, elem.raan, elem.arg_pe, elem.true_anomaly
    p = sma * (1 - ecc**2)
    r = p / (1 + ecc * math.cos(nu))
    xP, yP = r * math.cos(nu), r * math.sin(nu)
    mu_p = math.sqrt(MU_EARTH / p)
    vxP, vyP = -mu_p * math.sin(nu), mu_p * (ecc + math.cos(nu))
    cO, sO = math.cos(raan), math.sin(raan)
    cI, sI = math.cos(inc), math.sin(inc)
    cW, sW = math.cos(arg_pe), math.sin(arg_pe)
    r11 = cO*cW - sO*sW*cI; r12 = -cO*sW - sO*cW*cI
    r21 = sO*cW + cO*sW*cI; r22 = -sO*sW + cO*cW*cI
    r31 = sW*sI; r32 = cW*sI
    pos = Vec3(r11*xP+r12*yP, r21*xP+r22*yP, r31*xP+r32*yP)
    vel = Vec3(r11*vxP+r12*vyP, r21*vxP+r22*vyP, r31*vxP+r32*vyP)
    return pos, vel

def compute_relative(t_pos: Vec3, t_vel: Vec3, c_pos: Vec3, c_vel: Vec3) -> tuple[Vec3, Vec3]:
    """Compute relative state in LVLH frame"""
    rMag = t_pos.mag()
    rHat = t_pos.norm()
    h = t_pos.cross(t_vel)
    hHat = h.norm()
    vHat = hHat.cross(rHat)
    dp = c_pos - t_pos
    dv = c_vel - t_vel
    rel_pos = Vec3(dp.dot(vHat), dp.dot(rHat), dp.dot(hHat))
    rel_vel = Vec3(dv.dot(vHat), dv.dot(rHat), dv.dot(hHat))
    return rel_pos, rel_vel

# === Spacecraft State ===

@dataclass
class Spacecraft:
    name: str = ""
    elements: OrbitalElements = field(default_factory=OrbitalElements)
    mass: float = 12000
    fuel: float = 1200
    thrust: float = 4000
    isp: float = 290

# === CW-based Autopilot ===

def compute_autopilot_dv(rel_pos: Vec3, rel_vel: Vec3, rng: float, phase: str, n: float) -> Vec3:
    """Compute delta-V command in LVLH frame"""
    if phase == 'phasing':
        # Move toward target: boost along V-bar if behind
        if rng > 5000:
            return Vec3(-0.1 if rel_pos.x > 0 else 0.1, 0, 0)
        return Vec3(0, 0, 0)

    if phase == 'approach':
        # V-bar approach: null R-bar and H-bar, reduce V-bar slowly
        dvx = -rel_vel.x * 0.01 - rel_pos.x * 0.0001  # slow approach
        dvy = -rel_vel.y * 0.05 - rel_pos.y * 0.001    # null R-bar
        dvz = -rel_vel.z * 0.05 - rel_pos.z * 0.001    # null H-bar
        return Vec3(dvx, dvy, dvz)

    if phase in ('proximity', 'final-approach'):
        # Precise approach: PD control on position, target closing rate ~0.1 m/s
        target_rate = -0.1 if rng > 5 else -0.03
        range_hat = Vec3(rel_pos.x, rel_pos.y, rel_pos.z).norm()
        current_rate = rel_vel.dot(range_hat)
        rate_error = current_rate - target_rate

        dvx = -rel_vel.x * 0.1 - rel_pos.x * 0.005 + range_hat.x * rate_error * 0.05
        dvy = -rel_vel.y * 0.1 - rel_pos.y * 0.005 + range_hat.y * rate_error * 0.05
        dvz = -rel_vel.z * 0.1 - rel_pos.z * 0.005 + range_hat.z * rate_error * 0.05
        return Vec3(dvx, dvy, dvz)

    return Vec3()

# === Simulation ===

@dataclass
class SimResult:
    outcome: str = ""
    docking_speed: float = 0
    fuel_used: float = 0
    mission_time: float = 0
    score: int = 0
    max_range: float = 0
    min_range: float = 1e12
    maneuver_count: int = 0
    samples: list[dict] = field(default_factory=list)
    checks: list[dict] = field(default_factory=list)

# Presets
PRESETS = {
    "iss-close": {
        "target": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, 0),
        "chaser": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, -0.00003),
        "chaser_fuel": 1200,
    },
    "iss-1km": {
        "target": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, 0),
        "chaser": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, -0.00015),
        "chaser_fuel": 1200,
    },
    "iss-10km": {
        "target": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, 0),
        "chaser": OrbitalElements(R_EARTH+ISS_ALTITUDE-2000, 0.0001, 0.9, 0, 0, -0.0015),
        "chaser_fuel": 1200,
    },
    "hohmann": {
        "target": OrbitalElements(R_EARTH+ISS_ALTITUDE, 0.0001, 0.9, 0, 0, 0),
        "chaser": OrbitalElements(R_EARTH+ISS_ALTITUDE-50000, 0.0001, 0.9, 0, 0, -0.01),
        "chaser_fuel": 1200,
    },
}

def run_simulation(preset_id: str, pilot_mode: str = "full-auto") -> SimResult:
    preset = PRESETS.get(preset_id)
    if not preset:
        raise ValueError(f"Unknown preset: {preset_id}")

    target = Spacecraft("Target", OrbitalElements(**vars(preset["target"])), mass=420000, fuel=0)
    chaser = Spacecraft("Chaser", OrbitalElements(**vars(preset["chaser"])), fuel=preset["chaser_fuel"])
    initial_fuel = chaser.fuel
    result = SimResult()

    max_time = 20000  # ~5.5 hours max
    t = 0
    maneuver_interval = 30  # apply correction every 30s
    sample_interval = 10

    while t < max_time:
        # Propagate
        target.elements = propagate(target.elements, PHYSICS_DT)
        chaser.elements = propagate(chaser.elements, PHYSICS_DT)
        t += PHYSICS_DT

        # Compute relative state
        t_pos, t_vel = elements_to_state(target.elements)
        c_pos, c_vel = elements_to_state(chaser.elements)
        rel_pos, rel_vel = compute_relative(t_pos, t_vel, c_pos, c_vel)
        rng = rel_pos.mag()
        range_rate = rel_vel.dot(rel_pos.norm()) if rng > 0.1 else 0

        # Track
        if rng > result.max_range: result.max_range = rng
        if rng < result.min_range: result.min_range = rng

        # Phase
        if rng < 2:
            speed = rel_vel.mag()
            result.outcome = "docked" if speed < 0.5 else "collision"
            result.docking_speed = speed
            break
        phase = "final-approach" if rng < 10 else "proximity" if rng < 100 else "approach" if rng < 5000 else "phasing"

        # Autopilot
        if pilot_mode == "full-auto" and int(t) % maneuver_interval == 0:
            n = math.sqrt(MU_EARTH / target.elements.sma**3)
            dv = compute_autopilot_dv(rel_pos, rel_vel, rng, phase, n)
            dv_mag = dv.mag()
            if dv_mag > 0.001 and chaser.fuel > 0:
                # Apply delta-V (simplified: directly modify velocity)
                c_vel_new = c_vel + Vec3(dv.x, dv.y, dv.z)  # TODO: proper LVLH→ECI transform
                # Fuel consumption
                fuel_used = chaser.mass * (1 - math.exp(-dv_mag / (chaser.isp * G0)))
                chaser.fuel = max(0, chaser.fuel - fuel_used)
                result.maneuver_count += 1

        # Sample
        if int(t) % sample_interval == 0:
            result.samples.append({
                "time": round(t, 1),
                "range": round(rng, 1),
                "range_rate": round(range_rate, 3),
                "rel_x": round(rel_pos.x, 1),
                "rel_y": round(rel_pos.y, 1),
                "rel_z": round(rel_pos.z, 1),
                "fuel": round(chaser.fuel, 0),
                "phase": phase,
            })

    if not result.outcome:
        result.outcome = "timeout"

    result.fuel_used = round(initial_fuel - chaser.fuel, 0)
    result.mission_time = round(t, 0)

    if result.outcome == "docked":
        result.score = max(0, 100 - int(result.docking_speed * 100) - int(result.fuel_used / 10))
    else:
        result.score = 0

    # Checks
    result.checks = [
        {"name": "outcome", "status": "ok" if result.outcome == "docked" else "error", "detail": result.outcome},
        {"name": "docking_speed", "status": "ok" if result.docking_speed < 0.5 else "error", "detail": f"{result.docking_speed:.2f} m/s"},
        {"name": "fuel", "status": "ok" if chaser.fuel > 0 else "error", "detail": f"{chaser.fuel:.0f} kg remaining"},
    ]

    return result
