; CTI Bridge Installer Script
; Inno Setup 6.x 이상 필요
; 다운로드: https://jrsoftware.org/isdl.php

#define MyAppName "CTI Bridge"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "D-Care"
#define MyAppExeName "CTIBridge.exe"
#define MyAppServiceName "CTIBridge"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf32}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
OutputDir=output
OutputBaseFilename=CTIBridge-Setup-{#MyAppVersion}
SetupIconFile=..\cti.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x86 x64
ArchitecturesInstallIn64BitMode=

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Messages]
korean.BeveledLabel=D-Care CTI Bridge

[CustomMessages]
korean.InstallingService=CTI Bridge 서비스를 설치하는 중...
korean.StartingService=CTI Bridge 서비스를 시작하는 중...
korean.StoppingService=CTI Bridge 서비스를 중지하는 중...
korean.RemovingService=CTI Bridge 서비스를 제거하는 중...

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "추가 아이콘:"; Flags: unchecked

[Files]
; 메인 실행 파일 및 런타임 파일들
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; SK CTI DLL
Source: "..\SKB_OpenAPI_IMS.dll"; DestDir: "{app}"; Flags: ignoreversion
; 설정 파일 (있으면)
Source: "..\config.txt"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{#MyAppName} 제거"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; 설치 후 서비스 등록 및 시작
Filename: "{app}\{#MyAppExeName}"; Parameters: "--install"; StatusMsg: "{cm:InstallingService}"; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "CTI Bridge 콘솔 모드로 실행 (테스트용)"; Flags: nowait postinstall skipifsilent unchecked

[UninstallRun]
; 제거 전 서비스 중지 및 삭제
Filename: "{app}\{#MyAppExeName}"; Parameters: "--uninstall"; StatusMsg: "{cm:RemovingService}"; Flags: runhidden waituntilterminated

[Code]
// 설치 전 기존 서비스 확인 및 중지
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';

  // 기존 서비스가 있으면 중지
  Exec('sc.exe', 'stop CTIBridge', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);

  // 기존 서비스 삭제
  Exec('sc.exe', 'delete CTIBridge', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

// 설치 완료 메시지
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // 설치 완료 후 추가 작업
  end;
end;
