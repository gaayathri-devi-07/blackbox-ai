@echo off
echo ================================================
echo 🚀 BLACKBOX AI - FIREBASE FIX SCRIPT
echo ================================================
echo.

echo Step 1: Clearing Next.js cache...
if exist .next (
    rmdir /s /q .next
    echo ✅ Cache cleared!
) else (
    echo ⚠️  No cache found (this is okay)
)
echo.

echo Step 2: Verifying environment variables...
node verify-env.js
echo.

echo Step 3: Instructions
echo ================================================
echo.
echo 🔥 To start the dev server, run:
echo    npm run dev
echo.
echo 🌐 Then open: http://localhost:3000
echo.
echo 📋 Test authentication:
echo    1. Press F12 to open console
echo    2. Click "Get Started"
echo    3. Click "Continue with Google"
echo    4. Check console for success messages
echo.
echo ================================================
echo.
pause
