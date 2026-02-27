
@echo off
echo Starting Sender Pro...

REM Check if node_modules exists in backend
cd backend
if not exist node_modules (
    echo Installing backend dependencies...
    npm install
)

REM Set Environment Variables
set NODE_ENV=production

REM Start Application
echo Starting Application Server on PORT 5000...
node server.js
