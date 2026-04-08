"""
Orbital Mechanics — Headless Physics Engine (Python)

State-vector based propagation with 2-body gravity.
Delta-V applied directly to velocity vector.
"""

import math
from dataclasses import dataclass, field
from typing import Optional

MU_EARTH = 3.986004418e14
R_EARTH = 6.371e6
G0 = 9.80665
ISS_ALTITUDE = 408000
PHYSICS_DT = 1.0

@dataclass
class Vec3:
    x: float = 0; y: float = 0; z: float = 0
    def mag(self): return math.sqrt(self.x**2 + self.y**2 + self.z**2)
    def __add__(self, o): return Vec3(self.x+o.x, self.y+o.y, self.z+o.z)
    def __sub__(self, o): return Vec3(self.x-o.x, self.y-o.y, self.z-o.z)
    def scale(self, s): return Vec3(self.x*s, self.y*s, self.z*s)
    def dot(self, o): return self.x*o.x + self.y*o.y + self.z*o.z
    def cross(self, o): return Vec3(self.y*o.z-self.z*o.y, self.z*o.x-self.x*o.z, self.x*o.y-self.y*o.x)
    def norm(self):
        m = self.mag()
        return self.scale(1/m) if m > 1e-12 else Vec3()

# === Initial state from orbital elements ===

def circular_orbit_state(altitude: float, inc: float, true_anomaly: float) -> tuple[Vec3, Vec3]:
    """Create position/velocity for circular orbit"""
    r = R_EARTH + altitude
    v = math.sqrt(MU_EARTH / r)
    # Position in orbital plane
    cos_nu = math.cos(true_anomaly)
    sin_nu = math.sin(true_anomaly)
    cos_i = math.cos(inc)
    sin_i = math.sin(inc)
    # ECI position
    pos = Vec3(r * cos_nu, r * sin_nu * cos_i, r * sin_nu * sin_i)
    # ECI velocity (perpendicular to position in orbital plane)
    vel = Vec3(-v * sin_nu, v * cos_nu * cos_i, v * cos_nu * sin_i)
    return pos, vel

# === 2-body gravity propagation (Velocity Verlet) ===

def gravity_accel(pos: Vec3) -> Vec3:
    r = pos.mag()
    return pos.scale(-MU_EARTH / (r * r * r))

def propagate_state(pos: Vec3, vel: Vec3, dt: float) -> tuple[Vec3, Vec3]:
    """Velocity Verlet integration"""
    a = gravity_accel(pos)
    new_pos = pos + vel.scale(dt) + a.scale(0.5 * dt * dt)
    new_a = gravity_accel(new_pos)
    new_vel = vel + (a + new_a).scale(0.5 * dt)
    return new_pos, new_vel

# === LVLH Frame ===

def compute_lvlh(t_pos: Vec3, t_vel: Vec3):
    """Compute LVLH unit vectors at target position"""
    rHat = t_pos.norm()
    h = t_pos.cross(t_vel)
    hHat = h.norm()
    vHat = hHat.cross(rHat)
    return vHat, rHat, hHat

def to_lvlh(dp: Vec3, vHat: Vec3, rHat: Vec3, hHat: Vec3) -> Vec3:
    return Vec3(dp.dot(vHat), dp.dot(rHat), dp.dot(hHat))

def from_lvlh(dv_lvlh: Vec3, vHat: Vec3, rHat: Vec3, hHat: Vec3) -> Vec3:
    return Vec3(
        dv_lvlh.x * vHat.x + dv_lvlh.y * rHat.x + dv_lvlh.z * hHat.x,
        dv_lvlh.x * vHat.y + dv_lvlh.y * rHat.y + dv_lvlh.z * hHat.y,
        dv_lvlh.x * vHat.z + dv_lvlh.y * rHat.z + dv_lvlh.z * hHat.z,
    )

# === Autopilot ===

hohmann_done = False  # module-level flag

def compute_autopilot_dv(rel_pos: Vec3, rel_vel: Vec3, rng: float, phase: str,
                          t_pos: Vec3 = None, c_pos: Vec3 = None) -> Vec3:
    """Compute delta-V in LVLH frame"""
    global hohmann_done

    if phase == 'phasing':
        # If large R-bar offset (altitude difference > 1km), do Hohmann transfer
        r_bar = abs(rel_pos.y)
        if r_bar > 1000 and not hohmann_done and t_pos and c_pos:
            # Hohmann: compute prograde ΔV to raise/lower orbit to match target
            r_chaser = c_pos.mag()
            r_target = t_pos.mag()
            v_circ = math.sqrt(MU_EARTH / r_chaser)
            # Transfer orbit semi-major axis
            a_transfer = (r_chaser + r_target) / 2
            v_transfer = math.sqrt(MU_EARTH * (2/r_chaser - 1/a_transfer))
            dv1 = v_transfer - v_circ  # prograde burn
            hohmann_done = True
            return Vec3(dv1, 0, 0)  # prograde in LVLH

        # PD phasing: V-bar drift + gentle R-bar/H-bar correction
        boost = min(0.3, abs(rel_pos.x) * 0.00004)
        dvx = boost if rel_pos.x > 50 else -boost if rel_pos.x < -50 else 0
        # Very gentle altitude correction to avoid orbit perturbation
        dvy = -rel_pos.y * 0.00005 - rel_vel.y * 0.005
        dvz = -rel_pos.z * 0.00005 - rel_vel.z * 0.005
        return Vec3(dvx, dvy, dvz)

    if phase == 'approach':
        # PD control with range-dependent gains
        # Gentler as we get closer to prevent overshoot
        g_pos = 0.0001 if rng > 1000 else 0.00005
        g_vel = 0.005 if rng > 1000 else 0.02
        dvx = -rel_pos.x * g_pos - rel_vel.x * g_vel
        dvy = -rel_pos.y * g_pos * 5 - rel_vel.y * g_vel * 3
        dvz = -rel_pos.z * g_pos * 5 - rel_vel.z * g_vel * 3
        dv = Vec3(dvx, dvy, dvz)
        mag = dv.mag()
        max_dv = 0.3 if rng > 500 else 0.1
        if mag > max_dv:
            dv = dv.scale(max_dv / mag)
        return dv

    if phase in ('proximity', 'final-approach'):
        # Fine PD: target closing rate proportional to range
        target_rate = -0.08 if rng > 10 else -0.02 if rng > 3 else -0.005
        rhat = rel_pos.norm()
        current_rate = rel_vel.dot(rhat) if rng > 0.1 else 0

        # Position control: drive to origin (target)
        dvx = -rel_pos.x * 0.002 - rel_vel.x * 0.05
        dvy = -rel_pos.y * 0.005 - rel_vel.y * 0.1
        dvz = -rel_pos.z * 0.005 - rel_vel.z * 0.1

        # Range rate control
        rate_error = current_rate - target_rate
        dvx += rhat.x * rate_error * 0.02
        dvy += rhat.y * rate_error * 0.02
        dvz += rhat.z * rate_error * 0.02

        dv = Vec3(dvx, dvy, dvz)
        mag = dv.mag()
        if mag > 0.2:
            dv = dv.scale(0.2 / mag)
        return dv

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

PRESETS = {
    "iss-close": {"alt": ISS_ALTITUDE, "chaser_alt": ISS_ALTITUDE, "phase_lag": 0.00003, "fuel": 1200},
    "iss-1km": {"alt": ISS_ALTITUDE, "chaser_alt": ISS_ALTITUDE, "phase_lag": 0.00015, "fuel": 1200},
    "iss-10km": {"alt": ISS_ALTITUDE, "chaser_alt": ISS_ALTITUDE - 2000, "phase_lag": 0.0015, "fuel": 1200},
    "hohmann": {"alt": ISS_ALTITUDE, "chaser_alt": ISS_ALTITUDE - 50000, "phase_lag": 0.01, "fuel": 1200},
}

def run_simulation(preset_id: str, pilot_mode: str = "full-auto") -> SimResult:
    preset = PRESETS.get(preset_id)
    if not preset:
        raise ValueError(f"Unknown preset: {preset_id}")

    inc = 0.9  # 51.6°
    t_pos, t_vel = circular_orbit_state(preset["alt"], inc, 0)
    c_pos, c_vel = circular_orbit_state(preset["chaser_alt"], inc, -preset["phase_lag"])

    global hohmann_done
    hohmann_done = False
    fuel = preset["fuel"]
    initial_fuel = fuel
    chaser_mass = 12000
    chaser_isp = 290
    result = SimResult()

    max_time = 50000  # ~14 hours for hohmann transfers
    t = 0
    maneuver_interval = 30
    sample_interval = 10

    while t < max_time:
        # Propagate both spacecraft (2-body)
        t_pos, t_vel = propagate_state(t_pos, t_vel, PHYSICS_DT)
        c_pos, c_vel = propagate_state(c_pos, c_vel, PHYSICS_DT)
        t += PHYSICS_DT

        # LVLH frame at target
        vHat, rHat, hHat = compute_lvlh(t_pos, t_vel)
        dp = c_pos - t_pos
        dv = c_vel - t_vel
        rel_pos = to_lvlh(dp, vHat, rHat, hHat)
        rel_vel = to_lvlh(dv, vHat, rHat, hHat)
        rng = rel_pos.mag()
        range_rate = rel_vel.dot(rel_pos.norm()) if rng > 0.1 else 0

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
        # Maneuver interval varies by phase
        interval = 60 if phase == "phasing" else 10 if phase in ("proximity", "final-approach") else 30
        if pilot_mode == "full-auto" and int(t) % interval == 0 and fuel > 0:
            dv_lvlh = compute_autopilot_dv(rel_pos, rel_vel, rng, phase, t_pos, c_pos)
            dv_mag = dv_lvlh.mag()
            if dv_mag > 0.0001:
                # Convert LVLH dV to ECI
                dv_eci = from_lvlh(dv_lvlh, vHat, rHat, hHat)
                # Apply to chaser velocity
                c_vel = c_vel + dv_eci
                # Fuel consumption
                fuel_used = chaser_mass * (1 - math.exp(-dv_mag / (chaser_isp * G0)))
                fuel = max(0, fuel - fuel_used)
                chaser_mass -= fuel_used
                result.maneuver_count += 1

        # Sample
        if int(t) % sample_interval == 0:
            result.samples.append({
                "time": round(t, 1), "range": round(rng, 1),
                "range_rate": round(range_rate, 3),
                "rel_x": round(rel_pos.x, 1), "rel_y": round(rel_pos.y, 1),
                "rel_z": round(rel_pos.z, 1), "fuel": round(fuel, 0), "phase": phase,
            })

    if not result.outcome:
        result.outcome = "timeout"

    result.fuel_used = round(initial_fuel - fuel, 0)
    result.mission_time = round(t, 0)
    if result.outcome == "docked":
        result.score = max(0, 100 - int(result.docking_speed * 100) - int(result.fuel_used / 10))

    result.checks = [
        {"name": "outcome", "status": "ok" if result.outcome == "docked" else "error", "detail": result.outcome},
        {"name": "docking_speed", "status": "ok" if result.docking_speed < 0.5 else "error", "detail": f"{result.docking_speed:.2f} m/s"},
        {"name": "fuel", "status": "ok" if fuel > 0 else "error", "detail": f"{fuel:.0f} kg"},
    ]
    return result
