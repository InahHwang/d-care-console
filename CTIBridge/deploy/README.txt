═══════════════════════════════════════════════════════════════════════════
                    CTI Bridge 배포 패키지 사용 안내
═══════════════════════════════════════════════════════════════════════════

[배포 패키지 구성]

  deploy/
  ├── publish/              <- CTIBridge 실행 파일 (이 폴더에 복사)
  │   ├── CTIBridge.exe
  │   ├── CTIBridge.dll
  │   ├── SKB_OpenAPI_IMS.dll
  │   ├── config.txt
  │   └── ... (기타 DLL)
  ├── install-ctibridge.bat <- 설치 스크립트
  ├── uninstall-ctibridge.bat <- 제거 스크립트
  └── README.txt            <- 이 파일


═══════════════════════════════════════════════════════════════════════════
                            설치 방법
═══════════════════════════════════════════════════════════════════════════

[사전 준비]

  1. 개발자 PC에서 빌드:
     CTIBridge 폴더에서 build.bat 실행
     또는: dotnet publish -c Release -r win-x86 --self-contained true -o publish

  2. publish 폴더 내용을 이 deploy/publish/ 폴더에 복사

  3. 이 deploy 폴더 전체를 USB 또는 네트워크로 치과 PC에 복사


[설치 실행]

  1. 치과 데스크 PC에서 deploy 폴더 열기

  2. install-ctibridge.bat 파일을 우클릭

  3. "관리자 권한으로 실행" 선택

  4. 설치 완료 메시지 확인


[설치 결과]

  - 설치 경로: C:\CTIBridge\
  - 서비스명: CTI Bridge Service
  - HTTP 포트: 5080
  - 로그 경로: C:\CTIBridge\logs\


═══════════════════════════════════════════════════════════════════════════
                            문제 해결
═══════════════════════════════════════════════════════════════════════════

[서비스가 시작되지 않는 경우]

  1. 로그 확인:
     C:\CTIBridge\logs\cti-YYYYMMDD.log 파일 열기

  2. config.txt 확인:
     CTI 장비(IPDS) IP 주소가 올바른지 확인

  3. 수동 시작 시도:
     명령 프롬프트(관리자)에서:
     net start "CTI Bridge Service"


[웹에서 CTI 연결 안됨으로 표시되는 경우]

  1. 서비스 실행 확인:
     sc query "CTI Bridge Service"
     STATE가 RUNNING인지 확인

  2. 포트 확인:
     netstat -an | findstr 5080
     LISTENING 상태인지 확인

  3. 방화벽 확인:
     Windows 방화벽에서 5080 포트 인바운드 허용


[CTI 장비 연결 안되는 경우]

  1. config.txt에서 IPDS IP 주소 확인

  2. 해당 IP로 ping 테스트

  3. CTI 장비(IPDS) 전원 및 네트워크 상태 확인


═══════════════════════════════════════════════════════════════════════════
                            서비스 관리
═══════════════════════════════════════════════════════════════════════════

[서비스 시작]
  net start "CTI Bridge Service"

[서비스 중지]
  net stop "CTI Bridge Service"

[서비스 상태 확인]
  sc query "CTI Bridge Service"

[서비스 재시작]
  net stop "CTI Bridge Service" && net start "CTI Bridge Service"


═══════════════════════════════════════════════════════════════════════════
                            업데이트 방법
═══════════════════════════════════════════════════════════════════════════

  1. 새 버전 빌드 후 publish 폴더를 이 deploy/publish/에 복사

  2. deploy 폴더를 치과 PC에 복사

  3. install-ctibridge.bat 실행 (기존 버전은 자동 백업됨)


═══════════════════════════════════════════════════════════════════════════
