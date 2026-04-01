@echo off
REM Build Bloom Jump for Windows
REM Sets up MSVC environment and compiles with Perry

call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

echo Building Bloom Jump for Windows...
perry compile src\main.ts -o jump
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

if exist jump (
    move /Y jump jump.exe >nul
)

echo Build complete: jump.exe
