# SK Broadband CTI OpenAPI 연동 가이드

> C# .NET 개발자용 - CID(발신자표시) 수신 중심

## 개요

SK브로드밴드 CS OpenAPI를 사용하여 착신 전화의 발신자 번호(CID)를 실시간으로 수신하는 방법을 정리한 문서입니다.

## 필수 파일

- **DLL 파일**: `SKB_OpenAPI_IMS.dll`
- **위치**: 프로그램 실행 디렉토리 또는 Windows 시스템 디렉토리

---

## 1. API 초기화

### IMS_Init() - API 초기화 및 서버 연결

프로그램 시작 시 **반드시 1회만 호출**해야 합니다.

```csharp
[DllImport("SKB_OpenAPI_IMS.dll")]
public static extern int IMS_Init(string strAppKey);
```

**파라미터**
| Name | Type | Description |
|------|------|-------------|
| strAppKey | string | Application-Key (SK브로드밴드에서 발급) |

**Return Code**
| Code | Value | Description |
|------|-------|-------------|
| SUCCESS | 0x0000 | 성공 |
| API_FC_INIT_FAIL | 0x8000 | API 초기화 실패 |
| API_FC_DISP_CONNECT_FAIL | 0x8010 | DISP 연결 실패 |
| API_FC_INVALID_APPKEY | 0x801B | 잘못된 APP-Key |

**이벤트**
| Event | Value | Description |
|-------|-------|-------------|
| EVT_CONNECTING | 0x0100 | 호스트 연결중 |
| EVT_CONNECTED | 0x0101 | 호스트 연결 됨 |
| EVT_CONNECTION_FAIL | 0x0103 | 호스트 연결 실패 |

**예제 코드**
```csharp
int nResult = IMS_Init("YOUR_APP_KEY");
if (nResult == 0)
    Log("API 초기화 성공");
else
    Log("API 초기화 실패: " + nResult);
```

---

## 2. 로그인

### IMS_Login() - 사용자 로그인

CID 수신 등 서비스를 사용하려면 **반드시 로그인** 해야 합니다.

```csharp
[DllImport("SKB_OpenAPI_IMS.dll")]
public static extern int IMS_Login(string strUserId, string strPasswd);
```

**파라미터**
| Name | Type | Description |
|------|------|-------------|
| strUserId | string | 사용자 ID |
| strPasswd | string | 비밀번호 (8자리 이상, 영문+특수문자+숫자 각 1개 이상) |

**Return Code**
| Code | Value | Description |
|------|-------|-------------|
| SUCCESS | 0x0000 | 성공 |
| API_FC_ALREADY_LOGIN | 0x8007 | 중복 로그인 |
| API_FC_HOST_NOT_CONNECTED | 0x8014 | 호스트 연결되어있지 않음 |
| API_FC_INVALID_ID | 0x8017 | 잘못된 사용자 ID |
| API_FC_INVALID_PASSWD | 0x8019 | 비밀번호 오류 |

**이벤트**
| Event | Value | Description |
|-------|-------|-------------|
| EVT_LOGIN | 0x0104 | 로그인 완료 |

**예제 코드**
```csharp
int nResult = IMS_Login("user_id", "password123!");
if (nResult == 0) 
    Log("로그인 요청 성공");
```

---

## 3. 이벤트 수신 (핵심)

### IMS_GetEvent() - 이벤트 수신

**Timer를 사용하여 주기적으로 호출**해야 합니다. 모든 서비스 이벤트(CID 포함)가 이 함수를 통해 전달됩니다.

```csharp
[DllImport("SKB_OpenAPI_IMS.dll")]
public static extern int IMS_GetEvent(ref _EVTMSG stEvtMsg);
```

### 이벤트 구조체 정의

```csharp
[StructLayout(LayoutKind.Sequential, Pack=1), Serializable]
public struct _EVTMSG
{
    public int nService;      // 서비스 유형
    public int nEvtType;      // 이벤트 유형
    public int nResult;       // 결과코드
    
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
    public string strDn1;     // 발신번호 (Caller ID)
    
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
    public string strDn2;     // 착신번호
    
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=1024)]
    public string strExtInfo; // 추가 정보
}
```

### 이벤트 폴링 예제

```csharp
private System.Windows.Forms.Timer tmrEvent;
private _EVTMSG m_stEvtMsg;

private void InitEventTimer()
{
    tmrEvent = new System.Windows.Forms.Timer();
    tmrEvent.Interval = 100; // 100ms 간격
    tmrEvent.Tick += tmrEvent_Tick;
    tmrEvent.Start();
}

private void tmrEvent_Tick(object sender, EventArgs e)
{
    tmrEvent.Enabled = false;
    
    int nResult = IMS_GetEvent(ref m_stEvtMsg);
    if (nResult == 0) // SUCCESS - 이벤트 있음
    {
        ProcessEvent(m_stEvtMsg.nService, m_stEvtMsg.nEvtType, 
                     m_stEvtMsg.nResult, m_stEvtMsg.strDn1, 
                     m_stEvtMsg.strDn2, m_stEvtMsg.strExtInfo);
    }
    
    tmrEvent.Enabled = true;
}
```

---

## 4. CID 수신 서비스 (발신자 표시)

로그인 상태에서 전화가 걸려오면 **자동으로** 발신번호를 수신합니다.

### 서비스 코드
| Service Code | Value | Description |
|--------------|-------|-------------|
| IMS_SVC_CID | - | CID 수신 서비스 |

### 이벤트 데이터
| Field | Description |
|-------|-------------|
| strDn1 | **발신번호** (Caller ID) - 전화 건 사람 번호 |
| strDn2 | 착신번호 - 우리 전화번호 |

### CID 이벤트 처리 예제

```csharp
public void ProcessEvent(int nSvc, int nEvtType, int nResult, 
                         string strDn1, string strDn2, string strExtInfo)
{
    switch (nSvc)
    {
        case (int)SVCCODE.IMS_SVC_CID:
            // CID 수신 - 전화 왔을 때
            OnCallerIdReceived(strDn1, strDn2);
            break;
            
        case (int)SVCCODE.IMS_SVC_ABS_NOTI:
            // 부재중 알림 - 통화 연결 안됐을 때
            OnMissedCall(strDn1, strDn2, strExtInfo);
            break;
            
        case (int)SVCCODE.IMS_SVC_TERMCALL_START_NOTI:
            // 착신통화 시작 - 통화 연결됐을 때
            OnCallStarted(strDn1, strDn2, strExtInfo);
            break;
            
        case (int)SVCCODE.IMS_SVC_TERMCALL_END_NOTI:
            // 착신통화 종료 - 통화 끝났을 때
            OnCallEnded(strDn1, strDn2, strExtInfo);
            break;
    }
}

private void OnCallerIdReceived(string callerNumber, string myNumber)
{
    // 여기서 발신번호로 고객 정보 조회
    Log($"전화 수신: {callerNumber} -> {myNumber}");
    
    // TODO: 고객 DB 조회 후 팝업 표시
}

private void OnMissedCall(string callerNumber, string myNumber, string callTime)
{
    Log($"부재중 전화: {callerNumber} -> {myNumber}, 시간: {callTime}");
}
```

---

## 5. 관련 통화 이벤트 서비스

### 5.1 부재중 알림 서비스 (IMS_SVC_ABS_NOTI)
전화가 왔지만 통화 연결이 안 된 경우 알림

| Field | Description |
|-------|-------------|
| strDn1 | 발신번호 |
| strDn2 | 착신번호 |
| strExtInfo | 수신 시간 |

### 5.2 착신통화시작 통보 (IMS_SVC_TERMCALL_START_NOTI)
착신 전화가 연결(응답)되었을 때 알림

| Field | Description |
|-------|-------------|
| strDn1 | 발신번호 |
| strDn2 | 착신번호 |
| strExtInfo | 통화 시작 시간 |

### 5.3 착신통화종료 통보 (IMS_SVC_TERMCALL_END_NOTI)
착신 통화가 종료되었을 때 알림

| Field | Description |
|-------|-------------|
| strDn1 | 발신번호 |
| strDn2 | 착신번호 |
| strExtInfo | 통화 종료 시간 |

---

## 6. 서비스 코드 정의 (SVCCODE)

```csharp
public enum SVCCODE
{
    IMS_SVC_NORMAL = 0,              // 일반 (로그인/연결 등)
    IMS_SVC_CID = /* value */,       // CID 수신
    IMS_SVC_ABS_NOTI = /* value */,  // 부재중 알림
    IMS_SVC_TERMCALL_START_NOTI,     // 착신통화 시작
    IMS_SVC_TERMCALL_END_NOTI,       // 착신통화 종료
    IMS_SVC_ORIGCALL_START_NOTI,     // 발신통화 시작
    IMS_SVC_ORIGCALL_END_NOTI,       // 발신통화 종료
    // ... 기타 서비스
}
```

---

## 7. 이벤트 코드 정의 (EVTTYPE)

| Name | Value | Description |
|------|-------|-------------|
| EVT_TIMEOUT | 0x0000 | 시간 초과 |
| EVT_NORMAL | 0x0001 | 일반 이벤트 |
| EVT_SYS_FAULT | 0x0002 | 시스템 오류 |
| EVT_CONNECTING | 0x0100 | 호스트 연결중 |
| EVT_CONNECTED | 0x0101 | 호스트 연결 됨 |
| EVT_DISCONNECTED | 0x0102 | 호스트 연결 종료 |
| EVT_CONNECTION_FAIL | 0x0103 | 호스트 연결 실패 |
| EVT_LOGIN | 0x0104 | 사용자 로그인 |
| EVT_LOGOUT | 0x0105 | 사용자 로그아웃 |

---

## 8. 오류 코드 정의 (ERRCODE)

| Name | Value | Description |
|------|-------|-------------|
| SUCCESS | 0x0000 | 성공 |
| API_FC_ETC_FAIL | 0x8000 | 기타 오류 |
| API_FC_INIT_FAIL | 0x8001 | API 초기화 실패 |
| API_FC_HB_TIMEOUT | 0x8002 | Heartbeat Timeout |
| API_FC_ALREADY_LOGIN | 0x8007 | 중복 로그인 |
| API_FC_USER_NOT_LOGIN | 0x800B | 로그인되어있지 않음 |
| API_FC_HOST_NOT_CONNECTED | 0x8014 | 호스트 연결 안됨 |
| API_FC_INVALID_ID | 0x8017 | 잘못된 사용자 ID |
| API_FC_INVALID_PASSWD | 0x8019 | 비밀번호 오류 |
| API_FC_INVALID_APPKEY | 0x801B | 잘못된 APP-Key |
| API_FC_NOT_ALLOWED_SERVICE | 0x8075 | 부가서비스 미가입 |

---

## 9. API 종료

### IMS_Close() - API 종료

프로그램 종료 시 호출하여 리소스를 해제합니다.

```csharp
[DllImport("SKB_OpenAPI_IMS.dll")]
public static extern int IMS_Close();
```

### IMS_Logout() - 로그아웃

```csharp
[DllImport("SKB_OpenAPI_IMS.dll")]
public static extern int IMS_Logout();
```

---

## 10. 전체 연동 흐름

```
1. IMS_Init(appKey)           → 호스트 연결
2. EVT_CONNECTED 이벤트 대기   → 연결 확인
3. IMS_Login(userId, passwd)  → 로그인
4. EVT_LOGIN 이벤트 대기       → 로그인 확인
5. Timer로 IMS_GetEvent() 반복 호출
   ↓
   IMS_SVC_CID 이벤트 수신 시 → 발신번호(strDn1)로 고객 조회
   ↓
6. 프로그램 종료 시
   - IMS_Logout()
   - IMS_Close()
```

---

## 11. CatchAll 연동 시 고려사항

### 기존 CTIBridge.cs 수정 포인트

1. **DLL Import 추가**: `SKB_OpenAPI_IMS.dll` 함수들 import
2. **이벤트 구조체 정의**: `_EVTMSG` 구조체 추가
3. **Timer 기반 이벤트 폴링**: `IMS_GetEvent()` 주기적 호출
4. **CID 수신 시 콜백**: 발신번호 수신 → 고객 DB 조회 → UI 팝업

### 주의사항

- DLL 파일이 실행 파일과 같은 디렉토리에 있어야 함
- App-Key는 SK브로드밴드 개발자 페이지에서 발급받아야 함
- 비밀번호는 3개월마다 변경 필요 (정책)
- 한번 사용한 비밀번호는 6개월 내 재사용 불가