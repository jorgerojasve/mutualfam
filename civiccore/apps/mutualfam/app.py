import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from civiccore.core.database import engine, Base
import models
from routers import auth, membership, config

# Crear todas las tablas en la base de datos SQLite aislada de MutualFam
Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI(title="Mutual Familiar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(membership.router, prefix="/api/v1/membership", tags=["membership"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])

from routers import loans, funds
app.include_router(loans.router, prefix="/api/v1/loans", tags=["loans"])
app.include_router(funds.router, prefix="/api/v1/funds", tags=["funds"])

@app.get("/")
def read_root():
    return {"message": "Mutual Familiar API is running"}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8002, reload=True)
