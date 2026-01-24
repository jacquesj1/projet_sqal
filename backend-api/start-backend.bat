@echo off
set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db
cd /d "%~dp0"
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
