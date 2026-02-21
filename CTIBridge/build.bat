@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════════╗
echo ║           CTI Bridge 빌드 스크립트                        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo [1/3] 이전 빌드 정리 중...
if exist "publish" rmdir /s /q "publish"

echo [2/3] Release 빌드 중...
dotnet publish -c Release -r win-x86 --self-contained true -o publish

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ✗ 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [3/3] 추가 파일 복사 중...
copy /y "SKB_OpenAPI_IMS.dll" "publish\" >nul 2>&1
copy /y "config.txt" "publish\" >nul 2>&1

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                  ✓ 빌드 완료!                            ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  출력 폴더: publish\                                     ║
echo ║                                                          ║
echo ║  다음 단계:                                              ║
echo ║  1. Inno Setup으로 installer\CTIBridge-Setup.iss 컴파일  ║
echo ║  2. 또는 publish 폴더를 직접 배포                        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause
