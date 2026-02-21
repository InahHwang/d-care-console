@echo off
chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         CTI Bridge 서비스 제거 스크립트                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 관리자 권한이 필요합니다.
    echo        이 파일을 우클릭하고 "관리자 권한으로 실행"을 선택하세요.
    echo.
    pause
    exit /b 1
)

set INSTALL_PATH=C:\CTIBridge
set SERVICE_NAME=CTI Bridge Service

echo 정말로 CTI Bridge를 제거하시겠습니까?
echo.
set /p CONFIRM="계속하려면 Y를 입력하세요 (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo 취소되었습니다.
    pause
    exit /b 0
)

echo.
echo [1/3] 서비스 중지 중...
net stop "%SERVICE_NAME%" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] 서비스 제거 중...
if exist "%INSTALL_PATH%\CTIBridge.exe" (
    "%INSTALL_PATH%\CTIBridge.exe" --uninstall
) else (
    sc delete "%SERVICE_NAME%" 2>nul
)
timeout /t 2 /nobreak >nul

echo.
echo [3/3] 파일 삭제 여부 확인...
set /p DELETE_FILES="설치 파일도 삭제하시겠습니까? (Y/N): "
if /i "%DELETE_FILES%"=="Y" (
    rmdir /s /q "%INSTALL_PATH%" 2>nul
    echo   - 파일 삭제됨
) else (
    echo   - 파일 유지됨: %INSTALL_PATH%
)

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                   제거 완료!                             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

pause
