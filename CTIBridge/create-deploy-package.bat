@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║     CTI Bridge 배포 패키지 생성 스크립트                 ║
echo ║     (개발자 PC에서 실행)                                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: 현재 디렉토리로 이동
cd /d "%~dp0"

:: 날짜/시간 생성
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,4%

:: 배포 폴더 생성
set DEPLOY_DIR=deploy_%TIMESTAMP%
set DEPLOY_ZIP=CTIBridge_Deploy_%TIMESTAMP%.zip

echo [1/4] 빌드 중...
echo.

:: 빌드 실행
dotnet publish -c Release -r win-x86 --self-contained true -o publish

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ✗ 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [2/4] 배포 폴더 생성 중...

:: 기존 배포 폴더 삭제
if exist "%DEPLOY_DIR%" rmdir /s /q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%"

:: 필수 파일 복사
echo   - publish 폴더 복사 중...
xcopy /E /I /Y "publish\*" "%DEPLOY_DIR%\publish\" >nul

:: 추가 필수 파일 복사
echo   - CTI DLL 복사 중...
if exist "SKB_OpenAPI_IMS.dll" copy /y "SKB_OpenAPI_IMS.dll" "%DEPLOY_DIR%\publish\" >nul
if exist "config.txt" copy /y "config.txt" "%DEPLOY_DIR%\publish\" >nul

echo.
echo [3/4] 설치 스크립트 생성 중...

:: 설치 스크립트 생성
(
echo @echo off
echo chcp 65001 ^>nul
echo setlocal enabledelayedexpansion
echo.
echo echo.
echo echo ╔══════════════════════════════════════════════════════════╗
echo echo ║         CTI Bridge 설치/업데이트 스크립트               ║
echo echo ║         ^(치과 데스크 PC에서 관리자 권한으로 실행^)       ║
echo echo ╚══════════════════════════════════════════════════════════╝
echo echo.
echo.
echo :: 관리자 권한 확인
echo net session ^>nul 2^>^&1
echo if %%ERRORLEVEL%% NEQ 0 ^(
echo     echo [오류] 관리자 권한이 필요합니다.
echo     echo        이 파일을 우클릭하고 "관리자 권한으로 실행"을 선택하세요.
echo     echo.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo :: 현재 디렉토리로 이동
echo cd /d "%%~dp0"
echo.
echo :: 설치 경로 설정
echo set INSTALL_PATH=C:\CTIBridge
echo set SERVICE_NAME=CTI Bridge Service
echo.
echo echo [1/6] 기존 서비스 중지 중...
echo net stop "%%SERVICE_NAME%%" 2^>nul
echo timeout /t 2 /nobreak ^>nul
echo.
echo echo [2/6] 기존 서비스 제거 중...
echo if exist "%%INSTALL_PATH%%\CTIBridge.exe" ^(
echo     "%%INSTALL_PATH%%\CTIBridge.exe" --uninstall 2^>nul
echo     timeout /t 2 /nobreak ^>nul
echo ^)
echo.
echo echo [3/6] 기존 파일 백업 중...
echo if exist "%%INSTALL_PATH%%" ^(
echo     set BACKUP_PATH=%%INSTALL_PATH%%_backup_%%date:~0,4%%%%date:~5,2%%%%date:~8,2%%
echo     if exist "!BACKUP_PATH!" rmdir /s /q "!BACKUP_PATH!"
echo     move "%%INSTALL_PATH%%" "!BACKUP_PATH!" ^>nul 2^>^&1
echo     echo   - 백업 완료: !BACKUP_PATH!
echo ^) else ^(
echo     echo   - 기존 설치 없음 ^(신규 설치^)
echo ^)
echo.
echo echo [4/6] 새 파일 설치 중...
echo mkdir "%%INSTALL_PATH%%" 2^>nul
echo xcopy /E /I /Y "publish\*" "%%INSTALL_PATH%%\" ^>nul
echo if %%ERRORLEVEL%% NEQ 0 ^(
echo     echo [오류] 파일 복사 실패!
echo     pause
echo     exit /b 1
echo ^)
echo echo   - 설치 완료: %%INSTALL_PATH%%
echo.
echo echo [5/6] 서비스 등록 중...
echo cd /d "%%INSTALL_PATH%%"
echo CTIBridge.exe --install
echo timeout /t 2 /nobreak ^>nul
echo.
echo echo [6/6] 서비스 시작 중...
echo net start "%%SERVICE_NAME%%"
echo.
echo echo.
echo echo ╔══════════════════════════════════════════════════════════╗
echo echo ║                   설치 완료!                             ║
echo echo ╠══════════════════════════════════════════════════════════╣
echo echo ║  설치 경로: C:\CTIBridge                                 ║
echo echo ║  로그 경로: C:\CTIBridge\logs\                           ║
echo echo ║                                                          ║
echo echo ║  서비스 상태 확인:                                       ║
echo echo ║    sc query "CTI Bridge Service"                         ║
echo echo ║                                                          ║
echo echo ║  문제 발생 시:                                           ║
echo echo ║    1. 로그 파일 확인                                     ║
echo echo ║    2. 방화벽에서 5080 포트 허용 확인                     ║
echo echo ║    3. CTI 장비 IP 설정 확인 ^(config.txt^)                ║
echo echo ╚══════════════════════════════════════════════════════════╝
echo echo.
echo.
echo :: 서비스 상태 확인
echo echo [서비스 상태]
echo sc query "%%SERVICE_NAME%%" ^| findstr "STATE"
echo.
echo pause
) > "%DEPLOY_DIR%\install.bat"

:: 제거 스크립트 생성
(
echo @echo off
echo chcp 65001 ^>nul
echo echo CTI Bridge 서비스 제거
echo echo.
echo.
echo :: 관리자 권한 확인
echo net session ^>nul 2^>^&1
echo if %%ERRORLEVEL%% NEQ 0 ^(
echo     echo [오류] 관리자 권한이 필요합니다.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo set INSTALL_PATH=C:\CTIBridge
echo set SERVICE_NAME=CTI Bridge Service
echo.
echo echo 서비스 중지 중...
echo net stop "%%SERVICE_NAME%%" 2^>nul
echo.
echo echo 서비스 제거 중...
echo if exist "%%INSTALL_PATH%%\CTIBridge.exe" ^(
echo     "%%INSTALL_PATH%%\CTIBridge.exe" --uninstall
echo ^)
echo.
echo echo 완료!
echo pause
) > "%DEPLOY_DIR%\uninstall.bat"

:: README 생성
(
echo ═══════════════════════════════════════════════════════════
echo            CTI Bridge 배포 패키지
echo            생성일: %TIMESTAMP%
echo ═══════════════════════════════════════════════════════════
echo.
echo [설치 방법]
echo.
echo 1. 이 폴더 전체를 USB 또는 네트워크로 치과 데스크 PC에 복사
echo.
echo 2. install.bat 파일을 우클릭 → "관리자 권한으로 실행"
echo.
echo 3. 설치 완료 후 웹 브라우저에서 CTI 연결 상태 확인
echo.
echo.
echo [제거 방법]
echo.
echo uninstall.bat 파일을 우클릭 → "관리자 권한으로 실행"
echo.
echo.
echo [문제 해결]
echo.
echo - CTI 연결 안됨: config.txt에서 IPDS IP 주소 확인
echo - 서비스 시작 안됨: C:\CTIBridge\logs\ 폴더의 로그 확인
echo - 웹에서 연결 안됨: 방화벽에서 5080 포트 허용
echo.
echo ═══════════════════════════════════════════════════════════
) > "%DEPLOY_DIR%\README.txt"

echo.
echo [4/4] 패키지 완료!
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                   배포 패키지 생성 완료!                 ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                          ║
echo ║  폴더: %DEPLOY_DIR%                           ║
echo ║                                                          ║
echo ║  포함된 파일:                                            ║
echo ║    - publish\     : CTIBridge 실행 파일                  ║
echo ║    - install.bat  : 설치 스크립트                        ║
echo ║    - uninstall.bat: 제거 스크립트                        ║
echo ║    - README.txt   : 설치 안내                            ║
echo ║                                                          ║
echo ║  다음 단계:                                              ║
echo ║    1. %DEPLOY_DIR% 폴더를 USB에 복사          ║
echo ║    2. 치과 데스크 PC에서 install.bat 실행               ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: 폴더 열기
explorer "%DEPLOY_DIR%"

pause
