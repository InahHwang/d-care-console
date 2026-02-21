@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo          CTI Bridge 설치/업데이트 스크립트
echo          (치과 데스크 PC에서 관리자 권한으로 실행)
echo ============================================================
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

:: 현재 디렉토리로 이동
cd /d "%~dp0"

:: publish 폴더 확인
if not exist "publish\CTIBridge.exe" (
    echo [오류] publish 폴더에 CTIBridge.exe가 없습니다.
    echo        배포 패키지가 올바른지 확인하세요.
    echo.
    pause
    exit /b 1
)

:: 설치 경로 설정
set INSTALL_PATH=C:\CTIBridge
set SERVICE_NAME=CTIBridgeService

echo [1/6] 기존 서비스 중지 중...
net stop %SERVICE_NAME% 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - 서비스 중지됨
) else (
    echo   - 실행 중인 서비스 없음
)
timeout /t 2 /nobreak >nul

echo.
echo [2/6] 기존 서비스 제거 중...
sc query %SERVICE_NAME% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc delete %SERVICE_NAME% >nul 2>&1
    echo   - 기존 서비스 제거됨
    timeout /t 3 /nobreak >nul
) else (
    echo   - 제거할 서비스 없음
)

echo.
echo [3/6] 기존 파일 백업 중...
if exist "%INSTALL_PATH%" (
    for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
    set BACKUP_SUFFIX=!datetime:~0,8!_!datetime:~8,4!
    set BACKUP_PATH=%INSTALL_PATH%_backup_!BACKUP_SUFFIX!

    if exist "!BACKUP_PATH!" rmdir /s /q "!BACKUP_PATH!"
    move "%INSTALL_PATH%" "!BACKUP_PATH!" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo   - 백업 완료: !BACKUP_PATH!
    ) else (
        echo   - 백업 실패, 강제 삭제 시도...
        rmdir /s /q "%INSTALL_PATH%" 2>nul
    )
) else (
    echo   - 기존 설치 없음 (신규 설치)
)

echo.
echo [4/6] 새 파일 설치 중...
mkdir "%INSTALL_PATH%" 2>nul
xcopy /E /I /Y "publish\*" "%INSTALL_PATH%\" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 파일 복사 실패!
    pause
    exit /b 1
)
echo   - 설치 완료: %INSTALL_PATH%

:: logs 폴더 생성
mkdir "%INSTALL_PATH%\logs" 2>nul

echo.
echo [5/6] 서비스 등록 중 (자동 시작 설정)...
sc create %SERVICE_NAME% binPath= "\"%INSTALL_PATH%\CTIBridge.exe\"" start= auto DisplayName= "CTI Bridge Service"
if %ERRORLEVEL% EQU 0 (
    echo   - 서비스 등록 완료
) else (
    echo   - 서비스가 이미 존재하거나 등록 실패
)
:: 서비스 설명 추가
sc description %SERVICE_NAME% "CTI-Web Bridge Service" >nul 2>&1
:: 서비스 실패 시 자동 재시작 설정
sc failure %SERVICE_NAME% reset= 86400 actions= restart/60000/restart/60000/restart/60000 >nul 2>&1
echo   - 자동 재시작 정책 설정됨
timeout /t 2 /nobreak >nul

echo.
echo [6/6] 서비스 시작 중...
sc start %SERVICE_NAME%
if %ERRORLEVEL% EQU 0 (
    echo   - 서비스 시작됨
) else (
    echo   - 서비스 시작 실패. 수동으로 시작해보세요.
    echo.
    echo   수동 시작 방법:
    echo   1. 시작 메뉴에서 "서비스" 검색
    echo   2. "CTI Bridge Service" 찾기
    echo   3. 우클릭 - 시작
)

timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo                    설치 완료!
echo ============================================================
echo.
echo   설치 경로: C:\CTIBridge
echo   로그 경로: C:\CTIBridge\logs\
echo.
echo   서비스 관리:
echo     시작: sc start %SERVICE_NAME%
echo     중지: sc stop %SERVICE_NAME%
echo     상태: sc query %SERVICE_NAME%
echo.
echo ============================================================

:: 서비스 상태 확인
echo.
echo [서비스 상태]
sc query %SERVICE_NAME% | findstr "STATE"
echo.

:: 연결 테스트
echo [연결 테스트]
timeout /t 2 /nobreak >nul
curl -s http://localhost:5080/api/status 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - HTTP 응답 확인됨
) else (
    echo   - 응답 대기 중... (잠시 후 브라우저에서 확인하세요)
)
echo.

pause
