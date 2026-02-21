@echo off
chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║     CTI Bridge 빠른 배포 패키지 생성                     ║
echo ║     (빌드 후 deploy 폴더에 바로 복사)                    ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/3] 빌드 중...
call build.bat

if %ERRORLEVEL% NEQ 0 (
    echo 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [2/3] deploy/publish 폴더에 복사 중...
if exist "deploy\publish" rmdir /s /q "deploy\publish"
mkdir "deploy\publish" 2>nul
xcopy /E /I /Y "publish\*" "deploy\publish\" >nul

echo.
echo [3/3] 완료!
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                   배포 준비 완료!                        ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                          ║
echo ║  배포 폴더: CTIBridge\deploy\                            ║
echo ║                                                          ║
echo ║  다음 단계:                                              ║
echo ║    1. deploy 폴더를 USB에 복사                           ║
echo ║    2. 치과 PC에서 install-ctibridge.bat 실행            ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

explorer "deploy"
pause
