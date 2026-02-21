@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo   CTI Bridge 서비스 설치
echo ═══════════════════════════════════════════════════════
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

echo [확인] 관리자 권한 확인됨
echo.

:: 현재 디렉토리로 이동
cd /d "%~dp0"
echo [정보] 설치 경로: %~dp0
echo [정보] 실행 파일: %~dp0CTIBridge.exe
echo.

:: CTIBridge.exe 파일 존재 확인
if not exist "%~dp0CTIBridge.exe" (
    echo [오류] CTIBridge.exe 파일을 찾을 수 없습니다!
    echo        publish 폴더 전체가 복사되었는지 확인하세요.
    echo.
    pause
    exit /b 1
)

echo [확인] CTIBridge.exe 파일 존재함
echo.

:: 기존 서비스 확인
echo [단계 1/4] 기존 서비스 확인 중...
sc query CTIBridge >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [정보] 기존 서비스가 발견됨. 제거 후 재설치합니다.
    echo.
    echo [단계 2/4] 기존 서비스 중지 중...
    sc stop CTIBridge >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo [단계 3/4] 기존 서비스 삭제 중...
    sc delete CTIBridge
    timeout /t 2 /nobreak >nul
) else (
    echo [정보] 기존 서비스 없음. 새로 설치합니다.
)

:: 서비스 설치
echo.
echo [단계 4/4] 서비스 설치 중...
echo.
echo 실행 명령: sc create CTIBridge binPath= "\"%~dp0CTIBridge.exe\" --service" start= auto
echo.

sc create CTIBridge binPath= "\"%~dp0CTIBridge.exe\" --service" start= auto DisplayName= "CTI Bridge Service"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [성공] 서비스 설치 완료!
    echo.

    :: 서비스 설명 추가
    sc description CTIBridge "SK Broadband CTI 연동 서비스 - 발신자 표시 및 통화기록 관리" >nul 2>&1

    :: 서비스 시작
    echo 서비스 시작 중...
    sc start CTIBridge

    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [성공] 서비스가 시작되었습니다!
        echo.
        echo ═══════════════════════════════════════════════════════
        echo   설치 완료! 이제 전화가 오면 발신자 번호가 표시됩니다.
        echo ═══════════════════════════════════════════════════════
    ) else (
        echo.
        echo [경고] 서비스 시작 실패. 수동으로 시작해주세요.
        echo        services.msc 에서 "CTI Bridge Service" 찾아서 시작
    )
) else (
    echo.
    echo [오류] 서비스 설치 실패!
    echo.
    echo ───────────────────────────────────────────────────────
    echo  위의 오류 메시지를 확인하세요.
    echo
    echo  흔한 원인:
    echo  1. 경로에 한글이나 특수문자가 있으면 C:\CTIBridge\ 로 이동
    echo  2. 백신/보안 프로그램이 차단하는 경우 예외 추가
    echo ───────────────────────────────────────────────────────
)

echo.
pause
