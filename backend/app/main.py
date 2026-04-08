"""
Orbital Mechanics — Flight Recorder API (placeholder)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Orbital Mechanics Flight Recorder")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/smoke-test")
async def smoke_test():
    return {"status": "ok", "checks": [{"name": "api", "status": "ok"}]}
