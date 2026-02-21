@echo off
chcp 65001 >nul
echo CTI Bridge 서비스 제거
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ✗ 관리자 권한이 필요합니다.
    echo    이 파일을 우클릭하고 "관리자 권한으로 실행"을 선택하세요.
    echo.
    pause
    exit /b 1
)

:: 현재 디렉토리로 이동
cd /d "%~dp0"

:: 서비스 제거
echo 서비스 제거 중...
CTIBridge.exe --uninstall

echo.
pause
