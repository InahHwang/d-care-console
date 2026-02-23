// CTIBridge/CTIWorker.cs
// Windows 서비스로 실행되는 CTI 브릿지 워커
// v2: 비동기 큐 + 재시도 + 로컬 백업 방식으로 개선

using System.Collections.Concurrent;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CTIBridge;

#region Event Models
// 전송할 이벤트 타입
public enum CallEventType
{
    IncomingCall,       // 수신 전화 알림
    CallLog,            // 통화 로그 (ring, start, end, missed 등)
    OutgoingCall,       // 발신 전화
    Recording           // 녹취 완료
}

// 전송 대기 이벤트
public class CallEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public CallEventType Type { get; set; }
    public string CallerNumber { get; set; } = "";
    public string CalledNumber { get; set; } = "";
    public string? EventType { get; set; }      // ring, start, end, missed, outbound_end
    public string? ExtInfo { get; set; }
    public string? RecordingInfo { get; set; }
    public string? CallLogId { get; set; }      // ★ V2 callLogId (큐 enqueue 시점에 저장, 레이스컨디션 방지)
    public int Duration { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public int RetryCount { get; set; } = 0;
}
#endregion

public class CTIWorker : BackgroundService
{
    private readonly ILogger<CTIWorker> _logger;
    private readonly HttpClient _http;
    private Encoding _cp949;

    // 설정
    private string _appKey = "zeQ4GBTe/n7Of6S0fd3egUfL4QDxsyc9fJWHwRTGUW4woKsHqFYINVBmFGEnCNyc";
    private string _userId = "dsbrdental";
    private string _password = "ektksqkfms1!";
    private string _nextJsUrl = "https://d-care-console.vercel.app";

    // 상태
    private bool _gotLogin = false;
    private bool _gotSvcInfo = false;
    private bool _needReconnect = false;
    private bool _isConnected = false;
    private int _consecutiveAuthErrors = 0;  // 0x800B 연속 발생 카운터
    private const int MAX_AUTH_ERRORS_BEFORE_RECONNECT = 3;  // 3회 연속 시 재연결
    private int _consecutiveLoopErrors = 0;  // 메인 루프 연속 오류 카운터
    private const int MAX_LOOP_ERRORS_BEFORE_RECONNECT = 5;  // 5회 연속 시 재연결
    private DateTime _lastHealthCheckTime = DateTime.Now;  // 마지막 건강체크 시각
    private const int HEALTH_CHECK_INTERVAL_SEC = 180;  // 3분마다 세션 유효성 확인

    // 착신녹취 상태
    private bool _isRecordingReady = false;
    private bool _isRecording = false;
    private string _currentCallerId = "";
    private string _currentCalledId = "";
    private DateTime _recordingStartTime;

    // ★ ClickCall 발신 상태
    private bool _isClickCallActive = false;
    private bool _isClickCallRecording = false;
    private string _clickCallCallerDn = "";  // 발신자 (치과)
    private string _clickCallCalledDn = "";  // 착신자 (환자)
    private DateTime _clickCallStartTime;
    private string _clickCallLogId = "";     // ★ 서버에서 반환한 V2 callLogId (녹취 매칭용)
    private HttpListener? _httpListener;
    private const int HTTP_PORT = 5080;  // 발신 요청 수신 포트
    private const int CLICKCALL_TIMEOUT_SEC = 3600;  // ★ ClickCall 타임아웃 (1시간) - 상태 꼬임 방지용 안전장치

    // ★ 수신 통화 중복 방지 상태 (동시착신 대응)
    private bool _inboundCallStartSent = false;  // start 이벤트 전송 여부
    private string _inboundCallerNumber = "";    // 현재 수신 중인 발신자 번호
    private string _inboundCalledNumber = "";    // 실제로 받은 착신 번호 (031 or 070)
    private DateTime _inboundCallTime;           // ring 시점 (부재중 판단용)
    private DateTime _inboundCallStartTime;      // ★ 실제 통화 연결 시점 (duration 계산용)
    private const int INBOUND_CALL_TIMEOUT_SEC = 300;  // 5분 후 상태 자동 리셋

    // ★ 비동기 큐 관련
    private readonly ConcurrentQueue<CallEvent> _eventQueue = new();
    private const int MAX_RETRY = 3;
    private const int RETRY_DELAY_MS = 2000;
    private string _pendingDir = "";
    private DateTime _lastPendingCheck = DateTime.MinValue;
    private const int PENDING_CHECK_INTERVAL_SEC = 300; // 5분마다 pending 체크

    #region DLL Imports
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_Init(string strAppKey);

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_Login(string strUserId, string strPasswd);

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_Logout();

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_GetEvent(ref _EVTMSG_RAW stEvtMsg);

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_Close();

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_TermRec_Start();

    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_TermRec_Stop();

    // Sub DN 목록 조회 (가입자 소속 전화번호 리스트)
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_QrySubDnList();

    // 모니터링 전화번호 추가 (다른 번호의 이벤트를 받기 위해 등록)
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_AddMonDn(string strDn);

    // 모니터링 전화번호 삭제
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_DelMonDn(string strDn);

    // 모니터링 전화번호 목록 조회
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_QryMonDnList();

    // ★ ClickCall API (발신 녹취용)
    // 클릭콜 서비스 시작
    // strDestDn: 착신 전화번호 (환자번호)
    // nRecordF: 녹취 옵션 (0: 녹취안함, 1: 녹취함, 2: 부분녹취)
    // nEventF: 이벤트 수신 여부 (0: 안함, 1: 수신)
    // nAutoAnswerF: 발신자 자동응답 (0: 자동응답, 1: 자동응답안함)
    // ※ 발신자 번호는 로그인 계정의 기본 전화번호가 자동 사용됨
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_ClickCall_Start(string strDestDn, int nRecordF, int nEventF, int nAutoAnswerF);

    // 클릭콜 서비스 종료
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_ClickCall_Stop();

    // 클릭콜 호상태 조회
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_ClickCall_CallStatus();

    // 클릭콜 녹음 시작 (부분녹취)
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_ClickCall_StartRecord();

    // 클릭콜 녹음 종료 (부분녹취)
    [DllImport("SKB_OpenAPI_IMS.dll", CharSet = CharSet.Ansi)]
    public static extern int IMS_ClickCall_StopRecord();

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
    public struct _EVTMSG_RAW
    {
        public int nService;
        public int nEvtType;
        public int nResult;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
        public byte[] dn1;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
        public byte[] dn2;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1024)]
        public byte[] ext;
    }

    public struct EvtMsg
    {
        public int Service;
        public int EvtType;
        public int Result;
        public string Dn1;
        public string Dn2;
        public string ExtInfo;
    }
    #endregion

    #region Constants
    public const int SUCCESS = 0x0000;
    public const int IMS_SVC_CID_NOTIFY = 28;
    public const int IMS_SVC_RING = 7;
    public const int IMS_SVC_CONNECTED = 9;
    public const int EVT_CONNECTED = 0x0101;
    public const int EVT_LOGIN = 0x0104;
    public const int EVT_SERVICE_INFO = 0x0300;
    public const int IMS_SVC_TERMCALL_START = 11;  // 착신(수신) 시작 (TERM = Terminating)
    public const int IMS_SVC_TERMCALL_END = 12;    // 착신(수신) 종료 (TERM = Terminating)
    public const int IMS_SVC_CALL_ANSWERED = 13;
    public const int IMS_SVC_CALL_END = 14;
    public const int IMS_SVC_CALL_STATUS = 15;
    public const int EVT_CALL_STATUS_CHANGE = 0x0304;
    public const int IMS_SVC_TERM_REC = 8;

    public const int IMS_SVC_ORIGCALL_START_NOTI = 0x0015;
    public const int IMS_SVC_ORIGCALL_END_NOTI = 0x0016;
    public const int EVT_CALL_STATUS = 0x0301;
    public const int EVT_START_SERVICE = 0x0302;
    public const int EVT_STOP_SERVICE = 0x0303;
    public const int EVT_READY_SERVICE = 0x0304;
    public const int EVT_INIT_RECORD = 0x0306;
    public const int EVT_START_RECORD = 0x0307;
    public const int EVT_STOP_RECORD = 0x0308;

    // Sub DN 목록 조회 응답 이벤트
    public const int EVT_SUBS_DN_QRY = 0x0107;

    // ★ ClickCall 서비스 상수
    public const int IMS_SVC_CLICKCALL = 10;  // ClickCall 서비스
    public const int EVT_CLICKCALL_START = 0x0401;       // ClickCall 시작 응답
    public const int EVT_CLICKCALL_STOP = 0x0402;        // ClickCall 종료 응답
    public const int EVT_CLICKCALL_CALLER_ANSWER = 0x0403;  // 발신자(치과) 응답
    public const int EVT_CLICKCALL_CALLED_ANSWER = 0x0404;  // 착신자(환자) 응답
    public const int EVT_CLICKCALL_RECORD_START = 0x0405;   // 녹음 시작
    public const int EVT_CLICKCALL_RECORD_STOP = 0x0406;    // 녹음 종료
    #endregion

    public CTIWorker(ILogger<CTIWorker> logger)
    {
        _logger = logger;
        _http = new HttpClient();
        _http.Timeout = TimeSpan.FromSeconds(30);

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        _cp949 = Encoding.GetEncoding(949);

        // pending 폴더 설정
        _pendingDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pending");
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("CTI Bridge 서비스 시작 중...");
        LoadConfig();

        // pending 폴더 생성
        Directory.CreateDirectory(_pendingDir);

        // ★ HTTP 서버 시작 (발신 요청 수신용)
        StartHttpServer();

        await base.StartAsync(cancellationToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("CTI Bridge 서비스 종료 중...");

        // ★ HTTP 서버 종료
        StopHttpServer();

        // 남은 이벤트 로컬에 저장
        while (_eventQueue.TryDequeue(out var evt))
        {
            SaveToLocalBackup(evt);
        }

        try { IMS_Logout(); } catch { }
        try { IMS_Close(); } catch { }

        await base.StopAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CTI Bridge 서비스 실행 시작");

        // 초기 연결
        if (!await ConnectToCTI())
        {
            _logger.LogError("CTI 초기 연결 실패 - 자동 재연결 예정");
            _needReconnect = true;
        }

        // ★ SendWorker 태스크 시작 (별도 스레드에서 전송 처리)
        var sendWorkerTask = Task.Run(() => SendWorkerLoop(stoppingToken), stoppingToken);

        // 메인 루프 (이벤트 폴링)
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // 재연결 필요 시
                if (_needReconnect)
                {
                    _logger.LogWarning("CTI 재연결 시도...");
                    _needReconnect = false;
                    _isConnected = false;

                    try { IMS_Logout(); } catch { }
                    try { IMS_Close(); } catch { }
                    await Task.Delay(2000, stoppingToken);

                    if (await ConnectToCTI())
                    {
                        _logger.LogInformation("CTI 재연결 성공");
                        _consecutiveAuthErrors = 0;
                        _consecutiveLoopErrors = 0;
                        _lastHealthCheckTime = DateTime.Now;
                    }
                    else
                    {
                        _logger.LogError("CTI 재연결 실패 - 5초 후 재시도");
                        await Task.Delay(5000, stoppingToken);
                        _needReconnect = true;
                        continue;
                    }
                }

                // 이벤트 폴링 (빠르게 여러 이벤트 처리)
                if (_isConnected)
                {
                    PollAllEvents();
                }

                // ★ Fix 3: 주기적 세션 건강체크 (무소식 끊김 감지)
                if (_isConnected && (DateTime.Now - _lastHealthCheckTime).TotalSeconds > HEALTH_CHECK_INTERVAL_SEC)
                {
                    _lastHealthCheckTime = DateTime.Now;
                    CheckSessionHealth();
                }

                // ★ 수신 통화 타임아웃 체크 (end 이벤트 누락 시 상태 리셋)
                CheckInboundCallTimeout();

                // ★ ClickCall 타임아웃 체크
                CheckClickCallTimeout();

                // 주기적으로 pending 폴더 체크
                if ((DateTime.Now - _lastPendingCheck).TotalSeconds > PENDING_CHECK_INTERVAL_SEC)
                {
                    _lastPendingCheck = DateTime.Now;
                    LoadPendingEvents();
                }

                _consecutiveLoopErrors = 0;  // 정상 루프 완료 시 리셋
                await Task.Delay(100, stoppingToken); // 100ms로 단축
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                // ★ Fix 2: 메인 루프 연속 오류 시 재연결
                _consecutiveLoopErrors++;
                _logger.LogError(ex, "CTI 이벤트 처리 오류 ({Count}/{Max})",
                    _consecutiveLoopErrors, MAX_LOOP_ERRORS_BEFORE_RECONNECT);
                if (_consecutiveLoopErrors >= MAX_LOOP_ERRORS_BEFORE_RECONNECT)
                {
                    _logger.LogError("메인 루프 오류 {Count}회 연속 - 재연결 시도", _consecutiveLoopErrors);
                    _consecutiveLoopErrors = 0;
                    _needReconnect = true;
                }
                await Task.Delay(1000, stoppingToken);
            }
        }

        // SendWorker 종료 대기
        try
        {
            await sendWorkerTask;
        }
        catch (OperationCanceledException) { }

        _logger.LogInformation("CTI Bridge 서비스 종료됨");
    }

    #region Send Worker (비동기 전송 처리)
    private async Task SendWorkerLoop(CancellationToken ct)
    {
        _logger.LogInformation("[SendWorker] 전송 워커 시작");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (_eventQueue.TryDequeue(out var evt))
                {
                    await SendEventWithRetry(evt, ct);
                }
                else
                {
                    await Task.Delay(50, ct); // 큐 비면 대기
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SendWorker] 오류");
                await Task.Delay(100, ct);
            }
        }

        _logger.LogInformation("[SendWorker] 전송 워커 종료");
    }

    private async Task SendEventWithRetry(CallEvent evt, CancellationToken ct)
    {
        for (int attempt = 1; attempt <= MAX_RETRY; attempt++)
        {
            try
            {
                bool success = await SendEventToServer(evt);
                if (success)
                {
                    _logger.LogInformation("[SendWorker] 전송 성공: {Type} {Caller} (시도 {Attempt})",
                        evt.Type, evt.CallerNumber, attempt);
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SendWorker] 전송 실패 (시도 {Attempt}/{Max}): {Type} {Caller}",
                    attempt, MAX_RETRY, evt.Type, evt.CallerNumber);
            }

            if (attempt < MAX_RETRY)
            {
                await Task.Delay(RETRY_DELAY_MS * attempt, ct); // 백오프
            }
        }

        // 모든 재시도 실패 → 로컬 백업
        _logger.LogWarning("[SendWorker] 모든 재시도 실패, 로컬 백업: {Type} {Caller}", evt.Type, evt.CallerNumber);
        SaveToLocalBackup(evt);
    }

    private async Task<bool> SendEventToServer(CallEvent evt)
    {
        switch (evt.Type)
        {
            case CallEventType.IncomingCall:
                return await DoSendIncomingCall(evt);

            case CallEventType.CallLog:
                return await DoSendCallLog(evt);

            case CallEventType.OutgoingCall:
                return await DoSendOutgoingCall(evt);

            case CallEventType.Recording:
                return await DoSendRecording(evt);

            default:
                _logger.LogWarning("[SendWorker] 알 수 없는 이벤트 타입: {Type}", evt.Type);
                return true; // 알 수 없는 타입은 버림
        }
    }

    private async Task<bool> DoSendIncomingCall(CallEvent evt)
    {
        var payload = new
        {
            callerNumber = evt.CallerNumber,
            calledNumber = evt.CalledNumber,
            timestamp = evt.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
        };

        var json = JsonSerializer.Serialize(payload);
        var response = await _http.PostAsync(
            $"{_nextJsUrl}/api/v2/cti/incoming-call",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        return response.IsSuccessStatusCode;
    }

    private async Task<bool> DoSendCallLog(CallEvent evt)
    {
        var payload = new
        {
            eventType = evt.EventType,
            callerNumber = evt.CallerNumber,
            calledNumber = evt.CalledNumber,
            timestamp = evt.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz"),
            duration = evt.Duration,
            callLogId = evt.CallLogId,
            extInfo = evt.ExtInfo
        };

        var json = JsonSerializer.Serialize(payload);
        var response = await _http.PostAsync(
            $"{_nextJsUrl}/api/v2/cti/call-logs",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("[CallLog] 전송 실패: HTTP {Status} - {Body}",
                (int)response.StatusCode, body);
        }

        return response.IsSuccessStatusCode;
    }

    private async Task<bool> DoSendOutgoingCall(CallEvent evt)
    {
        var payload = new
        {
            phoneNumber = evt.CallerNumber, // 환자번호
            callerNumber = evt.CalledNumber, // 치과번호
            timestamp = evt.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
        };

        var json = JsonSerializer.Serialize(payload);
        var response = await _http.PostAsync(
            $"{_nextJsUrl}/api/v2/cti/outgoing-call",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        // ★ 응답에서 callLogId 추출하여 저장 (녹취 매칭에 사용)
        if (response.IsSuccessStatusCode)
        {
            try
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseBody);

                if (doc.RootElement.TryGetProperty("callLogId", out var callLogIdElement))
                {
                    _clickCallLogId = callLogIdElement.GetString() ?? "";
                    _logger.LogInformation("[OutgoingCall] V2 callLogId 저장: {CallLogId}", _clickCallLogId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[OutgoingCall] V2 callLogId 파싱 실패");
            }
        }

        return response.IsSuccessStatusCode;
    }

    private async Task<bool> DoSendRecording(CallEvent evt)
    {
        _logger.LogInformation("[Recording] 녹취 전송 시작: {Caller}", evt.CallerNumber);

        bool isUrl = !string.IsNullOrEmpty(evt.RecordingInfo) &&
                    (evt.RecordingInfo.StartsWith("http://") || evt.RecordingInfo.StartsWith("https://"));

        string fileName = isUrl ? Path.GetFileName(evt.RecordingInfo!) : evt.RecordingInfo ?? "";
        string? recordingBase64 = null;

        // URL인 경우 다운로드
        if (isUrl)
        {
            try
            {
                var audioBytes = await _http.GetByteArrayAsync(evt.RecordingInfo);
                _logger.LogInformation("[Recording] 다운로드 완료: {Size} bytes", audioBytes.Length);

                // 3MB 이하만 base64 전송 (base64 변환 시 33% 증가 → ~4MB)
                // 초과 시 URL만 전송하고 서버에서 직접 다운로드
                if (audioBytes.Length <= 3 * 1024 * 1024)
                {
                    recordingBase64 = Convert.ToBase64String(audioBytes);
                    _logger.LogInformation("[Recording] Base64 변환: {Size} bytes → {Base64Size} chars",
                        audioBytes.Length, recordingBase64.Length);
                }
                else
                {
                    _logger.LogInformation("[Recording] 파일이 커서 URL만 전송 ({Size} bytes)", audioBytes.Length);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Recording] 다운로드 실패, URL만 전송");
            }
        }

        // ★ ClickCall 녹취인 경우 callLogId 포함 (정확한 매칭을 위해)
        // 이벤트 객체에 저장된 CallLogId 우선 사용 (레이스컨디션 방지)
        // fallback: 인스턴스 변수 (아직 리셋 안 된 경우)
        string? callLogId = evt.CallLogId;
        if (string.IsNullOrEmpty(callLogId) && (_isClickCallActive || !string.IsNullOrEmpty(_clickCallLogId)))
        {
            callLogId = _clickCallLogId;
        }
        if (!string.IsNullOrEmpty(callLogId))
        {
            _logger.LogInformation("[Recording] ClickCall 녹취 - callLogId 포함: {CallLogId}", callLogId);
        }

        var payload = new
        {
            callerNumber = evt.CallerNumber,
            calledNumber = evt.CalledNumber,
            recordingFileName = fileName,
            recordingUrl = isUrl ? evt.RecordingInfo : (string?)null,
            recordingBase64 = recordingBase64,
            duration = evt.Duration,
            timestamp = evt.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz"),
            callLogId = callLogId  // ★ V2 callLogId 추가 (전화번호 매칭 대신 사용)
        };

        var json = JsonSerializer.Serialize(payload);
        var response = await _http.PostAsync(
            $"{_nextJsUrl}/api/v2/call-analysis/recording",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("[Recording] 전송 성공!");
        }
        else
        {
            var body = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("[Recording] 전송 실패: HTTP {Status} - {Body}",
                (int)response.StatusCode, body);
        }

        return response.IsSuccessStatusCode;
    }
    #endregion

    #region Local Backup (실패 시 로컬 저장)
    private void SaveToLocalBackup(CallEvent evt)
    {
        try
        {
            string fileName = $"{evt.CreatedAt:yyyyMMdd_HHmmss}_{evt.Id}.json";
            string filePath = Path.Combine(_pendingDir, fileName);

            var json = JsonSerializer.Serialize(evt, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filePath, json);

            _logger.LogInformation("[Backup] 로컬 백업 저장: {File}", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Backup] 로컬 백업 저장 실패");
        }
    }

    private void LoadPendingEvents()
    {
        try
        {
            if (!Directory.Exists(_pendingDir)) return;

            var files = Directory.GetFiles(_pendingDir, "*.json")
                .OrderBy(f => f)
                .Take(10) // 한 번에 10개씩만
                .ToList();

            if (files.Count > 0)
            {
                _logger.LogInformation("[Backup] {Count}개 pending 이벤트 로드", files.Count);
            }

            foreach (var file in files)
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var evt = JsonSerializer.Deserialize<CallEvent>(json);
                    if (evt != null)
                    {
                        evt.RetryCount++;
                        _eventQueue.Enqueue(evt);
                        File.Delete(file); // 큐에 넣었으니 삭제
                        _logger.LogInformation("[Backup] 복구 완료: {File}", Path.GetFileName(file));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Backup] 파일 복구 실패: {File}", file);
                    // 너무 오래된 파일(24시간)은 삭제
                    var fileInfo = new FileInfo(file);
                    if ((DateTime.Now - fileInfo.CreationTime).TotalHours > 24)
                    {
                        File.Delete(file);
                        _logger.LogInformation("[Backup] 오래된 파일 삭제: {File}", Path.GetFileName(file));
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Backup] pending 이벤트 로드 실패");
        }
    }
    #endregion

    #region Config & Connection
    private void LoadConfig()
    {
        string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.txt");

        if (File.Exists(configPath))
        {
            try
            {
                foreach (var line in File.ReadAllLines(configPath))
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("#")) continue; // 주석 무시

                    if (trimmed.StartsWith("URL="))
                    {
                        _nextJsUrl = trimmed.Substring(4).Trim();
                        _logger.LogInformation("설정 파일에서 URL 로드: {Url}", _nextJsUrl);
                    }
                    else if (trimmed.StartsWith("APP_KEY="))
                    {
                        _appKey = trimmed.Substring(8).Trim();
                    }
                    else if (trimmed.StartsWith("USER_ID="))
                    {
                        _userId = trimmed.Substring(8).Trim();
                    }
                    else if (trimmed.StartsWith("PASSWORD="))
                    {
                        _password = trimmed.Substring(9).Trim();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "설정 파일 읽기 실패");
            }
        }
        else
        {
            try
            {
                File.WriteAllText(configPath,
                    $"URL={_nextJsUrl}\n" +
                    "# 로컬 개발: URL=http://localhost:3000\n" +
                    "# Vercel 배포: URL=https://d-care-console.vercel.app\n");
                _logger.LogInformation("설정 파일 생성됨: {Path}", configPath);
            }
            catch { }
        }
    }

    private async Task<bool> ConnectToCTI()
    {
        _logger.LogInformation("SK CTI API 초기화 중...");

        int rc = IMS_Init(_appKey);
        if (rc != SUCCESS)
        {
            _logger.LogError("CTI 초기화 실패 (코드: 0x{Code:X})", rc);
            return false;
        }
        _logger.LogInformation("CTI 초기화 성공");

        for (int attempt = 1; attempt <= 3; attempt++)
        {
            if (attempt > 1)
            {
                _logger.LogInformation("로그인 {Attempt}차 재시도...", attempt);
                try { IMS_Logout(); } catch { }
                await Task.Delay(1500);
            }

            _gotLogin = false;
            _gotSvcInfo = false;

            rc = IMS_Login(_userId, _password);
            if (rc != SUCCESS)
            {
                _logger.LogWarning("로그인 요청 실패 (코드: 0x{Code:X})", rc);
                continue;
            }

            await Task.Delay(200);

            if (await WaitLoginAndSvcInfo(60000))
            {
                _logger.LogInformation("CTI 로그인 성공");
                _isConnected = true;
                _lastHealthCheckTime = DateTime.Now;

                // ★ Sub DN 목록 조회 (가입자 소속 전화번호 확인)
                _logger.LogInformation("═══════════════════════════════════════════════════════");
                _logger.LogInformation("📋 Sub DN 목록 조회 시작 (가입자 소속 전화번호 확인)");
                int qryResult = IMS_QrySubDnList();
                if (qryResult == SUCCESS)
                {
                    _logger.LogInformation("📋 Sub DN 목록 조회 요청 성공 - EVT_SUBS_DN_QRY(0x0107) 응답 대기");
                }
                else
                {
                    _logger.LogWarning("📋 Sub DN 목록 조회 요청 실패 (코드: 0x{Code:X})", qryResult);
                }
                _logger.LogInformation("═══════════════════════════════════════════════════════");

                // ★ 070 모니터링 번호 등록 (다른 번호의 이벤트를 받기 위해)
                await Task.Delay(500); // 잠시 대기
                _logger.LogInformation("═══════════════════════════════════════════════════════");
                _logger.LogInformation("📞 070 모니터링 번호 등록 시작");
                int addMonResult = IMS_AddMonDn("07047414202");
                if (addMonResult == SUCCESS)
                {
                    _logger.LogInformation("✅ 070 모니터링 등록 요청 성공! (07047414202)");
                    _logger.LogInformation("   → 070의 기본 사용자가 로그아웃/부재중일 때 이벤트 수신 가능");
                }
                else
                {
                    _logger.LogWarning("❌ 070 모니터링 등록 실패 (코드: 0x{Code:X})", addMonResult);
                    _logger.LogWarning("   → SK브로드밴드에 모니터링 권한 문의 필요");
                }

                // 현재 모니터링 목록 조회
                int qryMonResult = IMS_QryMonDnList();
                if (qryMonResult == SUCCESS)
                {
                    _logger.LogInformation("📋 모니터링 목록 조회 요청 성공");
                }
                _logger.LogInformation("═══════════════════════════════════════════════════════");

                return true;
            }
        }

        _logger.LogError("CTI 로그인 실패");
        return false;
    }

    private async Task<bool> WaitLoginAndSvcInfo(int maxWaitMs)
    {
        var cts = new CancellationTokenSource(maxWaitMs);

        while (!cts.IsCancellationRequested && !_gotLogin)
        {
            PollAllEvents();
            await Task.Delay(150);
        }

        if (!_gotLogin) return false;

        var cts2 = new CancellationTokenSource(5000);
        while (!cts2.IsCancellationRequested && !_gotSvcInfo)
        {
            PollAllEvents();
            await Task.Delay(150);
        }

        return true;
    }
    #endregion

    #region Event Polling & Processing
    // ★ 이벤트가 있는 동안 계속 처리 (개선됨)
    private void PollAllEvents()
    {
        int processedCount = 0;
        const int maxEventsPerPoll = 20; // 한 번에 최대 20개

        while (processedCount < maxEventsPerPoll)
        {
            try
            {
                var raw = new _EVTMSG_RAW
                {
                    dn1 = new byte[32],
                    dn2 = new byte[32],
                    ext = new byte[1024]
                };

                int r = IMS_GetEvent(ref raw);
                if (r != SUCCESS) break; // 더 이상 이벤트 없음

                var evt = ParseRaw(raw);
                if (!HasPayload(evt)) break;

                // 연결 끊김 감지 (0x8000=기타오류, 0x0102=Disconnected, 0x8002=Heartbeat Timeout)
                if (evt.Result == 0x8000 || evt.Result == 0x8002 ||
                    (evt.Service == 30 && evt.EvtType == 0x102 && evt.Result != SUCCESS))
                {
                    _logger.LogWarning("CTI 연결 끊김 감지 (Result=0x{Result:X}, EvtType=0x{EvtType:X})",
                        evt.Result, evt.EvtType);
                    _needReconnect = true;
                    break;
                }

                // 0x800B(미인증) 연속 발생 감지 → 재연결 트리거
                if (evt.Result == 0x800B)
                {
                    _consecutiveAuthErrors++;
                    _logger.LogWarning("CTI 미인증 오류 (0x800B) 발생 ({Count}/{Max})",
                        _consecutiveAuthErrors, MAX_AUTH_ERRORS_BEFORE_RECONNECT);
                    if (_consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_RECONNECT)
                    {
                        _logger.LogError("CTI 미인증 오류 {Count}회 연속 - 재연결 시도", _consecutiveAuthErrors);
                        _consecutiveAuthErrors = 0;
                        _needReconnect = true;
                        break;
                    }
                }
                else if (evt.Result == SUCCESS)
                {
                    _consecutiveAuthErrors = 0;  // 정상 응답 시 카운터 리셋
                }

                // 이벤트 처리 (큐에 넣기)
                ProcessEvent(evt);
                processedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "이벤트 폴링 오류");
                break;
            }
        }

        if (processedCount > 1)
        {
            _logger.LogDebug("[Poll] {Count}개 이벤트 처리", processedCount);
        }
    }

    // ★ 이벤트를 큐에 넣기만 함 (빠른 반환)
    private void ProcessEvent(EvtMsg evt)
    {
        _logger.LogInformation("[이벤트] Svc={Service}, Evt=0x{EvtType:X}, Res=0x{Result:X}, Dn1={Dn1}, Dn2={Dn2}, Ext={Ext}",
            evt.Service, evt.EvtType, evt.Result, evt.Dn1, evt.Dn2, evt.ExtInfo?.Substring(0, Math.Min(evt.ExtInfo?.Length ?? 0, 50)));

        if (evt.EvtType == EVT_CONNECTED)
        {
            _logger.LogInformation("서버 연결됨");
        }
        else if (evt.EvtType == EVT_LOGIN)
        {
            if (evt.Result == SUCCESS)
            {
                _logger.LogInformation("로그인 완료");
                _gotLogin = true;
            }
            else
            {
                _logger.LogError("로그인 실패 (Result=0x{Result:X}) - 중복 로그인 또는 인증 오류 가능성", evt.Result);
                _gotLogin = false;
            }
        }
        else if (evt.EvtType == EVT_SERVICE_INFO)
        {
            _gotSvcInfo = true;
        }
        else if (evt.EvtType == EVT_SUBS_DN_QRY)
        {
            // Sub DN 목록 응답 - 가입자 소속 전화번호 리스트
            _logger.LogInformation("═══════════════════════════════════════════════════════");
            _logger.LogInformation("📋 [Sub DN 목록 응답] EVT_SUBS_DN_QRY (0x0107)");
            _logger.LogInformation("📋 Result: 0x{Result:X}", evt.Result);
            _logger.LogInformation("📋 Dn1: {Dn1}", evt.Dn1);
            _logger.LogInformation("📋 Dn2: {Dn2}", evt.Dn2);
            _logger.LogInformation("📋 ExtInfo: {ExtInfo}", evt.ExtInfo);
            _logger.LogInformation("═══════════════════════════════════════════════════════");

            // 070 번호가 목록에 있는지 확인
            string allData = $"{evt.Dn1} {evt.Dn2} {evt.ExtInfo}";
            if (allData.Contains("07047414202") || allData.Contains("070"))
            {
                _logger.LogInformation("✅ 070 번호가 Sub DN 목록에 포함되어 있습니다!");
            }
            else
            {
                _logger.LogWarning("❌ 070 번호가 Sub DN 목록에 포함되어 있지 않습니다!");
                _logger.LogWarning("   → SK브로드밴드에 070 번호를 같은 가입자 그룹에 추가 요청 필요");
            }
        }
        else if (evt.Service == IMS_SVC_RING || evt.Service == IMS_SVC_CID_NOTIFY)
        {
            if (!string.IsNullOrEmpty(evt.Dn1))
            {
                _logger.LogInformation("📞 전화 수신: {Caller} → {Called}", evt.Dn1, evt.Dn2);

                // ★ 동시착신 중복 방지: 같은 발신번호 + 1초 이내 재ring → 동시착신 → 무시
                // 같은 발신번호라도 1초 초과면 새 통화로 처리
                bool isDuplicate = !string.IsNullOrEmpty(_inboundCallerNumber) &&
                    _inboundCallerNumber == evt.Dn1 &&
                    (DateTime.Now - _inboundCallTime).TotalSeconds < 1.0;

                if (!isDuplicate)
                {
                    // 새로운 수신 통화 - 상태 초기화
                    _inboundCallerNumber = evt.Dn1;
                    _inboundCalledNumber = evt.Dn2;
                    _inboundCallStartSent = false;
                    _inboundCallTime = DateTime.Now;

                    _logger.LogInformation("📞 [신규 수신] ring 이벤트 생성: {Caller} → {Called}", evt.Dn1, evt.Dn2);

                    // 수신 전화 알림 (Pusher 팝업용)
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.IncomingCall,
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2
                    });

                    // 통화 로그 (ring)
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.CallLog,
                        EventType = "ring",
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2,
                        ExtInfo = evt.ExtInfo
                    });
                }
                else
                {
                    // 동시착신으로 인한 중복 ring - 무시
                    _logger.LogInformation("📞 [동시착신 중복 무시] ring: {Caller} → {Called} ({Elapsed:F0}ms)",
                        evt.Dn1, evt.Dn2, (DateTime.Now - _inboundCallTime).TotalMilliseconds);
                }
            }
        }
        else if (evt.Service == IMS_SVC_CONNECTED)
        {
            if (!string.IsNullOrEmpty(evt.Dn1))
            {
                // ★ 중복 방지: 이미 start를 보냈으면 무시
                if (!_inboundCallStartSent)
                {
                    _inboundCallStartSent = true;
                    _inboundCallStartTime = DateTime.Now;  // ★ 실제 통화 연결 시점 기록 (duration 계산용)
                    _inboundCalledNumber = evt.Dn2;  // 실제로 받은 전화기 번호 저장
                    _logger.LogInformation("📱 통화 연결: {Caller} → {Called} (착신번호 확정)", evt.Dn1, evt.Dn2);
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.CallLog,
                        EventType = "start",
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2,
                        ExtInfo = evt.ExtInfo
                    });

                    // ★ EVT_READY_SERVICE가 안 온 경우 능동적으로 녹취 시작 시도
                    if (!_isRecordingReady && !_isRecording && !_isClickCallActive)
                    {
                        _logger.LogInformation("🎙️ [Svc=9] EVT_READY_SERVICE 미수신 → 녹취 직접 시작 시도: {Caller} → {Called}", evt.Dn1, evt.Dn2);
                        _currentCallerId = evt.Dn1;
                        _currentCalledId = evt.Dn2;
                        int startResult = IMS_TermRec_Start();
                        if (startResult == SUCCESS)
                        {
                            _isRecordingReady = true;
                            _recordingStartTime = DateTime.Now;
                            _logger.LogInformation("✅ [Svc=9] 녹취 시작 요청 성공!");
                        }
                        else
                        {
                            _logger.LogWarning("⚠️ [Svc=9] 녹취 시작 실패 (코드: 0x{Code:X}) - 녹취 불가 통화", startResult);
                        }
                    }
                }
                else
                {
                    _logger.LogDebug("📱 [중복 무시] 통화 연결: {Caller} → {Called}", evt.Dn1, evt.Dn2);
                }
            }
        }
        else if (evt.Service == IMS_SVC_TERMCALL_START)
        {
            if (!string.IsNullOrEmpty(evt.Dn1))
            {
                // ★ 중복 방지: 이미 start를 보냈으면 무시
                if (!_inboundCallStartSent)
                {
                    _inboundCallStartSent = true;
                    _inboundCallStartTime = DateTime.Now;  // ★ 실제 통화 연결 시점
                    _inboundCalledNumber = evt.Dn2;
                    _logger.LogInformation("📱 통화 시작: {Caller} → {Called} (착신번호 확정)", evt.Dn1, evt.Dn2);
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.CallLog,
                        EventType = "start",
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2,
                        ExtInfo = evt.ExtInfo
                    });
                }
                else
                {
                    _logger.LogDebug("📱 [중복 무시] 통화 시작: {Caller} → {Called}", evt.Dn1, evt.Dn2);
                }
            }
        }
        else if (evt.Service == IMS_SVC_CALL_ANSWERED)
        {
            if (!string.IsNullOrEmpty(evt.Dn1))
            {
                // ★ 중복 방지: 이미 start를 보냈으면 무시
                if (!_inboundCallStartSent)
                {
                    _inboundCallStartSent = true;
                    _inboundCallStartTime = DateTime.Now;  // ★ 실제 통화 연결 시점
                    _inboundCalledNumber = evt.Dn2;
                    _logger.LogInformation("📱 통화 응답: {Caller} → {Called} (착신번호 확정)", evt.Dn1, evt.Dn2);
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.CallLog,
                        EventType = "start",
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2,
                        ExtInfo = evt.ExtInfo
                    });
                }
                else
                {
                    _logger.LogDebug("📱 [중복 무시] 통화 응답: {Caller} → {Called}", evt.Dn1, evt.Dn2);
                }
            }
        }
        // ★ IMS_SVC_TERMCALL_START (Svc=11)와 IMS_SVC_TERMCALL_END (Svc=12)는
        // 착신(수신) 통화 연결/종료 이벤트입니다. (TERM = Terminating call = 수신)
        // 발신(Originating call)이 아니므로 여기서 별도 처리하지 않습니다.
        // 수신 통화는 IMS_SVC_RING, IMS_SVC_CONNECTED, IMS_SVC_CALL_END 등에서 처리됩니다.
        else if (evt.Service == IMS_SVC_CALL_END)
        {
            if (!string.IsNullOrEmpty(evt.Dn1))
            {
                // ★ 동시착신 대응: 처리 중인 발신번호와 일치하고, 착신번호도 일치하는 경우에만 end 전송
                // - start를 보냈으면: 해당 착신번호와 일치해야 함
                // - start를 안 보냈으면 (부재중): ring을 보냈던 착신번호와 일치해야 함
                bool isMatchingCall = !string.IsNullOrEmpty(_inboundCallerNumber) &&
                    evt.Dn1 == _inboundCallerNumber &&
                    (string.IsNullOrEmpty(_inboundCalledNumber) || evt.Dn2 == _inboundCalledNumber);

                if (isMatchingCall)
                {
                    string eventType = _inboundCallStartSent ? "end" : "missed";
                    // ★ 수신 통화도 Duration 계산 (_inboundCallStartTime = 실제 연결 시점, 벨소리 시간 제외)
                    int inboundDuration = _inboundCallStartSent
                        ? (int)(DateTime.Now - _inboundCallStartTime).TotalSeconds
                        : 0;
                    _logger.LogInformation("📴 통화 종료 ({EventType}): {Caller} ← {Called} ({Duration}초)", eventType, evt.Dn1, evt.Dn2, inboundDuration);
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.CallLog,
                        EventType = eventType,
                        CallerNumber = evt.Dn1,
                        CalledNumber = evt.Dn2,
                        Duration = inboundDuration,
                        ExtInfo = evt.ExtInfo
                    });

                    // ★ 수신 통화 상태 리셋
                    ResetInboundCallState();
                }
                else
                {
                    _logger.LogDebug("📴 [동시착신 중복 무시] 통화 종료: {Caller} ← {Called}", evt.Dn1, evt.Dn2);
                }
            }
        }
        else if (evt.Service == IMS_SVC_CALL_STATUS && evt.EvtType == EVT_CALL_STATUS_CHANGE)
        {
            ProcessCallStatusEvent(evt);
        }
        else if (evt.Service == IMS_SVC_ORIGCALL_START_NOTI)
        {
            string ourNumber = evt.Dn1;
            string patientNumber = evt.Dn2;

            // ★ ClickCall이 활성화된 경우에만 발신 통화 이벤트 생성
            // 전화기로 직접 발신하는 경우는 통화기록에 남기지 않음
            if (_isClickCallActive && !string.IsNullOrEmpty(patientNumber))
            {
                // ★ 발신자(치과) 번호를 이벤트에서 확인하여 저장 (녹취 전송 시 사용)
                if (!string.IsNullOrEmpty(ourNumber) && string.IsNullOrEmpty(_clickCallCallerDn))
                {
                    _clickCallCallerDn = ourNumber;
                    _logger.LogInformation("📱 [ClickCall] 치과 번호 확인: {Our}", ourNumber);
                }

                _logger.LogInformation("📱 [ClickCall] 발신 시작: {Our} → {Patient}", ourNumber, patientNumber);
                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.OutgoingCall,
                    CallerNumber = patientNumber, // 환자번호
                    CalledNumber = ourNumber      // 치과번호
                });
            }
            else if (!string.IsNullOrEmpty(patientNumber))
            {
                // 전화기 직접 발신은 로그만 남기고 이벤트는 생성하지 않음
                _logger.LogDebug("📞 [전화기 발신] 무시: {Our} → {Patient} (ClickCall 아님)", ourNumber, patientNumber);
            }
        }
        else if (evt.Service == IMS_SVC_ORIGCALL_END_NOTI)
        {
            string ourNumber = evt.Dn1;
            string patientNumber = evt.Dn2;

            // ★ ClickCall이 활성화된 경우에만 발신 종료 이벤트 생성
            // 전화기로 직접 발신한 경우는 무시
            if (_isClickCallActive && !string.IsNullOrEmpty(patientNumber))
            {
                _logger.LogInformation("📴 [ClickCall] 발신 종료: {Our} → {Patient}", ourNumber, patientNumber);
                _logger.LogInformation("    ExtInfo: {ExtInfo}", evt.ExtInfo);

                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.CallLog,
                    EventType = "outbound_end",
                    CallerNumber = patientNumber,
                    CalledNumber = ourNumber,
                    ExtInfo = evt.ExtInfo
                });

                // 녹음 URL 확인
                if (!string.IsNullOrEmpty(evt.ExtInfo) &&
                    (evt.ExtInfo.StartsWith("http://") || evt.ExtInfo.StartsWith("https://")))
                {
                    _logger.LogInformation("📼 [ClickCall] 발신 통화 녹취 파일 감지: {Url}", evt.ExtInfo);
                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.Recording,
                        CallerNumber = patientNumber,
                        CalledNumber = ourNumber,
                        RecordingInfo = evt.ExtInfo,
                        Duration = 0,
                        CallLogId = _clickCallLogId  // ★ callLogId 저장 (레이스컨디션 방지)
                    });
                }
            }
            else if (!string.IsNullOrEmpty(patientNumber))
            {
                // 전화기 직접 발신 종료는 로그만 남기고 이벤트는 생성하지 않음
                _logger.LogDebug("📞 [전화기 발신 종료] 무시: {Our} → {Patient} (ClickCall 아님)", ourNumber, patientNumber);
            }
        }
        else if (evt.Service == IMS_SVC_TERM_REC)
        {
            ProcessTermRecEvent(evt);
        }
        // ★ ClickCall 이벤트 처리
        else if (evt.Service == IMS_SVC_CLICKCALL || _isClickCallActive)
        {
            ProcessClickCallEvent(evt);
        }
    }

    private void ProcessCallStatusEvent(EvtMsg evt)
    {
        string extLower = (evt.ExtInfo ?? "").ToLower();
        string callerNum = evt.Dn2;
        string calledNum = evt.Dn1;

        // ★ "calling" 상태는 수신 통화 중에도 발생하므로 발신으로 처리하지 않습니다.
        // 실제 발신은 ClickCall 또는 IMS_SVC_ORIGCALL_START_NOTI를 통해서만 감지합니다.
        if (extLower.Contains("calling"))
        {
            // 로그만 남기고 발신 이벤트는 생성하지 않음
            _logger.LogDebug("📞 [CallStatus] calling 상태 감지 (수신 통화 중일 수 있음): Dn1={Dn1}, Dn2={Dn2}", evt.Dn1, evt.Dn2);
        }
        else if (extLower.Contains("called") || extLower.Contains("answer") || extLower.Contains("connect"))
        {
            // ★ 중복 방지: 이미 start를 보냈으면 무시
            if (!_inboundCallStartSent)
            {
                _inboundCallStartSent = true;
                _inboundCallStartTime = DateTime.Now;  // ★ 실제 통화 연결 시점
                _inboundCalledNumber = calledNum;
                _logger.LogInformation("📱 [CallStatus] 통화 연결: {Caller} → {Called} (착신번호 확정)", callerNum, calledNum);
                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.CallLog,
                    EventType = "start",
                    CallerNumber = callerNum,
                    CalledNumber = calledNum,
                    ExtInfo = evt.ExtInfo
                });
            }
            else
            {
                _logger.LogDebug("📱 [CallStatus 중복 무시] 통화 연결: {Caller} → {Called}", callerNum, calledNum);
            }
        }
        else if (extLower.Contains("release") || extLower.Contains("disconnect") || extLower.Contains("end") || extLower.Contains("bye"))
        {
            // ★ 동시착신 대응: 처리 중인 발신번호와 일치하고, 착신번호도 일치하는 경우에만 end 전송
            bool isMatchingCall = !string.IsNullOrEmpty(_inboundCallerNumber) &&
                callerNum == _inboundCallerNumber &&
                (string.IsNullOrEmpty(_inboundCalledNumber) || calledNum == _inboundCalledNumber);

            if (isMatchingCall)
            {
                string eventType = _inboundCallStartSent ? "end" : "missed";
                // ★ 수신 통화도 Duration 계산 (_inboundCallStartTime = 실제 연결 시점, 벨소리 시간 제외)
                int inboundDuration = _inboundCallStartSent
                    ? (int)(DateTime.Now - _inboundCallStartTime).TotalSeconds
                    : 0;
                _logger.LogInformation("📴 [CallStatus] 통화 종료 ({EventType}): {Caller} ← {Called} ({Duration}초)", eventType, callerNum, calledNum, inboundDuration);
                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.CallLog,
                    EventType = eventType,
                    CallerNumber = callerNum,
                    CalledNumber = calledNum,
                    Duration = inboundDuration,
                    ExtInfo = evt.ExtInfo
                });

                // 녹음 URL 확인
                string originalExt = evt.ExtInfo ?? "";
                if (originalExt.Contains("http://") || originalExt.Contains("https://"))
                {
                    int urlStart = originalExt.IndexOf("http");
                    if (urlStart >= 0)
                    {
                        string recordingUrl = originalExt.Substring(urlStart).Split(' ', '\t', '\n', '\r')[0];
                        _logger.LogInformation("📼 [CallStatus] 통화 종료 녹취 파일 감지: {Url}", recordingUrl);
                        _eventQueue.Enqueue(new CallEvent
                        {
                            Type = CallEventType.Recording,
                            CallerNumber = callerNum,
                            CalledNumber = calledNum,
                            RecordingInfo = recordingUrl,
                            Duration = 0
                        });
                    }
                }

                // ★ 수신 통화 상태 리셋
                ResetInboundCallState();
            }
            else
            {
                _logger.LogDebug("📴 [CallStatus 중복 무시] 통화 종료: {Caller} ← {Called}", callerNum, calledNum);
            }
        }
    }

    // ★ 수신 통화 상태 리셋
    private void ResetInboundCallState()
    {
        _inboundCallStartSent = false;
        _inboundCallerNumber = "";
        _inboundCalledNumber = "";

        // ★ 녹취 상태도 함께 리셋 (EVT_STOP_RECORD 없이 통화 종료 시 다음 통화에 영향 방지)
        if (_isRecordingReady || _isRecording)
        {
            _logger.LogInformation("📞 [수신 상태 리셋] 녹취 상태도 리셋 (ready={Ready}, recording={Recording})", _isRecordingReady, _isRecording);
        }
        _isRecordingReady = false;
        _isRecording = false;
        _currentCallerId = "";
        _currentCalledId = "";

        _logger.LogDebug("📞 [수신 상태 리셋] 완료");
    }

    // ★ 수신 통화 타임아웃 체크 (end 이벤트 누락 대비)
    private void CheckInboundCallTimeout()
    {
        if (string.IsNullOrEmpty(_inboundCallerNumber)) return;

        int elapsedSeconds = (int)(DateTime.Now - _inboundCallTime).TotalSeconds;
        if (elapsedSeconds > INBOUND_CALL_TIMEOUT_SEC)
        {
            _logger.LogWarning("⏰ [수신 타임아웃] {Elapsed}초 경과 - 상태 리셋 (발신: {Caller})", elapsedSeconds, _inboundCallerNumber);
            ResetInboundCallState();
        }
    }

    // ★ Fix 3: 주기적 세션 건강체크 (무소식 끊김, 세션 만료 감지)
    private void CheckSessionHealth()
    {
        try
        {
            // 가벼운 API 호출로 세션 유효성 확인
            int result = IMS_QrySubDnList();
            if (result == 0x800B) // API_FC_USER_NOT_LOGIN
            {
                _logger.LogWarning("[HealthCheck] 세션 만료 감지 (0x800B) - 재연결 시도");
                _needReconnect = true;
            }
            else if (result == 0x8002) // API_FC_HB_TIMEOUT
            {
                _logger.LogWarning("[HealthCheck] Heartbeat 타임아웃 감지 (0x8002) - 재연결 시도");
                _needReconnect = true;
            }
            else if (result == 0x8014) // API_FC_HOST_NOT_CONNECTED
            {
                _logger.LogWarning("[HealthCheck] 호스트 미연결 감지 (0x8014) - 재연결 시도");
                _needReconnect = true;
            }
            else if (result == SUCCESS)
            {
                _logger.LogInformation("[HealthCheck] 세션 정상");
            }
            else
            {
                _logger.LogWarning("[HealthCheck] 예상치 못한 응답 (0x{Result:X})", result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HealthCheck] 건강체크 실패 - 재연결 시도");
            _needReconnect = true;
        }
    }

    private void ProcessTermRecEvent(EvtMsg evt)
    {
        _logger.LogInformation("═══════════════════════════════════════════════════════");
        _logger.LogInformation("[녹취 이벤트] Service={Service}, EvtType=0x{EvtType:X}, Result=0x{Result:X}",
            evt.Service, evt.EvtType, evt.Result);
        _logger.LogInformation("[녹취 이벤트] Dn1={Dn1}, Dn2={Dn2}", evt.Dn1, evt.Dn2);
        _logger.LogInformation("[녹취 이벤트] ExtInfo={ExtInfo}", evt.ExtInfo);
        _logger.LogInformation("═══════════════════════════════════════════════════════");

        switch (evt.EvtType)
        {
            case EVT_READY_SERVICE:
                // ★ Svc=9에서 이미 녹취 시작했으면 중복 호출 방지
                if (_isRecordingReady)
                {
                    _logger.LogInformation("🎙️ 착신녹취 준비 (이미 녹취 진행중 - 무시): {Caller} → {Called}", evt.Dn1, evt.Dn2);
                    break;
                }

                _isRecordingReady = true;
                _currentCallerId = evt.Dn1;
                _currentCalledId = evt.Dn2;
                _logger.LogInformation("🎙️ 착신녹취 준비: {Caller} → {Called}", evt.Dn1, evt.Dn2);

                int startResult = IMS_TermRec_Start();
                if (startResult == SUCCESS)
                {
                    _logger.LogInformation("녹취 시작 요청 성공");
                    _recordingStartTime = DateTime.Now;
                }
                else
                {
                    _logger.LogWarning("녹취 시작 실패 (코드: 0x{Code:X})", startResult);
                    _isRecordingReady = false;
                }
                break;

            case EVT_START_RECORD:
                if (evt.Result == SUCCESS)
                {
                    _isRecording = true;
                    _logger.LogInformation("🔴 녹취 시작!");
                }
                else
                {
                    _logger.LogWarning("🔴 녹취 시작 실패! Result=0x{Result:X}", evt.Result);
                }
                break;

            case EVT_STOP_RECORD:
                _isRecording = false;
                _isRecordingReady = false;
                int duration = (int)(DateTime.Now - _recordingStartTime).TotalSeconds;

                _logger.LogInformation("⏹️ 녹취 완료! 통화시간: {Duration}초", duration);

                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.Recording,
                    CallerNumber = _currentCallerId,
                    CalledNumber = _currentCalledId,
                    RecordingInfo = evt.ExtInfo,
                    Duration = duration
                });

                _currentCallerId = "";
                _currentCalledId = "";
                break;

            case EVT_STOP_SERVICE:
                _isRecording = false;
                _isRecordingReady = false;
                _logger.LogInformation("녹취 서비스 종료");
                break;

            case EVT_INIT_RECORD:
                _logger.LogInformation("📋 녹취 초기화 이벤트");
                break;

            default:
                _logger.LogInformation("❓ 알 수 없는 녹취 이벤트: EvtType=0x{EvtType:X}", evt.EvtType);
                break;
        }
    }
    #endregion

    #region Helpers
    private EvtMsg ParseRaw(_EVTMSG_RAW raw)
    {
        return new EvtMsg
        {
            Service = raw.nService,
            EvtType = raw.nEvtType,
            Result = raw.nResult,
            Dn1 = BytesToAnsiString(raw.dn1),
            Dn2 = BytesToAnsiString(raw.dn2),
            ExtInfo = BytesToAnsiString(raw.ext)
        };
    }

    private string BytesToAnsiString(byte[] buf)
    {
        if (buf == null || buf.Length == 0) return "";
        int len = Array.IndexOf<byte>(buf, 0);
        if (len < 0) len = buf.Length;
        if (len == 0) return "";
        return _cp949.GetString(buf, 0, len).Trim();
    }

    private bool HasPayload(EvtMsg e)
    {
        return e.Service != 0 || e.EvtType != 0 || e.Result != 0 ||
               !string.IsNullOrEmpty(e.Dn1) || !string.IsNullOrEmpty(e.Dn2) ||
               !string.IsNullOrEmpty(e.ExtInfo);
    }
    #endregion

    #region HTTP Server (발신 요청 수신)
    private void StartHttpServer()
    {
        try
        {
            _httpListener = new HttpListener();
            _httpListener.Prefixes.Add($"http://localhost:{HTTP_PORT}/");
            _httpListener.Prefixes.Add($"http://127.0.0.1:{HTTP_PORT}/");
            _httpListener.Start();

            _logger.LogInformation("═══════════════════════════════════════════════════════");
            _logger.LogInformation("📡 HTTP 서버 시작: http://localhost:{Port}/", HTTP_PORT);
            _logger.LogInformation("   발신 요청: POST /api/click-call");
            _logger.LogInformation("   상태 조회: GET /api/status");
            _logger.LogInformation("═══════════════════════════════════════════════════════");

            // 비동기로 요청 처리
            Task.Run(HttpListenerLoop);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HTTP 서버 시작 실패");
        }
    }

    private void StopHttpServer()
    {
        try
        {
            _httpListener?.Stop();
            _httpListener?.Close();
            _logger.LogInformation("HTTP 서버 종료됨");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HTTP 서버 종료 중 오류");
        }
    }

    private async Task HttpListenerLoop()
    {
        while (_httpListener?.IsListening == true)
        {
            try
            {
                var context = await _httpListener.GetContextAsync();
                _ = Task.Run(() => HandleHttpRequest(context));
            }
            catch (HttpListenerException)
            {
                break; // 서버 종료됨
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HTTP 요청 수신 오류");
            }
        }
    }

    private async Task HandleHttpRequest(HttpListenerContext context)
    {
        var request = context.Request;
        var response = context.Response;

        // CORS 헤더 + Private Network Access 허용
        response.Headers.Add("Access-Control-Allow-Origin", "*");
        response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network");
        response.Headers.Add("Access-Control-Allow-Private-Network", "true");

        try
        {
            // OPTIONS (CORS preflight)
            if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = 200;
                response.Close();
                return;
            }

            string path = request.Url?.AbsolutePath ?? "";
            _logger.LogInformation("[HTTP] {Method} {Path}", request.HttpMethod, path);

            if (path == "/api/click-call" && request.HttpMethod == "POST")
            {
                await HandleClickCallRequest(request, response);
            }
            else if (path == "/api/click-call/stop" && request.HttpMethod == "POST")
            {
                await HandleClickCallStopRequest(response);
            }
            else if (path == "/api/status" && request.HttpMethod == "GET")
            {
                await HandleStatusRequest(response);
            }
            else
            {
                await SendJsonResponse(response, 404, new { error = "Not Found" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HTTP 요청 처리 오류");
            await SendJsonResponse(response, 500, new { error = ex.Message });
        }
    }

    private async Task HandleClickCallRequest(HttpListenerRequest request, HttpListenerResponse response)
    {
        // 요청 본문 읽기
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        string body = await reader.ReadToEndAsync();

        _logger.LogInformation("[ClickCall] 발신 요청: {Body}", body);

        try
        {
            var json = JsonDocument.Parse(body);
            string calledNumber = json.RootElement.GetProperty("phoneNumber").GetString() ?? "";
            string callerNumber = json.RootElement.TryGetProperty("callerNumber", out var callerProp)
                ? callerProp.GetString() ?? "07047414202"
                : "07047414202";  // 기본 발신번호

            if (string.IsNullOrEmpty(calledNumber))
            {
                await SendJsonResponse(response, 400, new { error = "phoneNumber is required" });
                return;
            }

            // 이미 통화 중이면 거부
            if (_isClickCallActive)
            {
                await SendJsonResponse(response, 409, new { error = "Already in call", currentCall = _clickCallCalledDn });
                return;
            }

            // CTI 연결 확인
            if (!_isConnected)
            {
                await SendJsonResponse(response, 503, new { error = "CTI not connected" });
                return;
            }

            // ClickCall 시작
            int result = StartClickCall(callerNumber, calledNumber);

            if (result == SUCCESS)
            {
                await SendJsonResponse(response, 200, new
                {
                    success = true,
                    message = "ClickCall started",
                    callerNumber = callerNumber,
                    calledNumber = calledNumber
                });
            }
            else
            {
                await SendJsonResponse(response, 500, new
                {
                    error = "ClickCall start failed",
                    resultCode = $"0x{result:X}"
                });
            }
        }
        catch (JsonException ex)
        {
            await SendJsonResponse(response, 400, new { error = "Invalid JSON", details = ex.Message });
        }
    }

    private async Task HandleClickCallStopRequest(HttpListenerResponse response)
    {
        if (!_isClickCallActive)
        {
            await SendJsonResponse(response, 400, new { error = "No active call" });
            return;
        }

        int result = StopClickCall();

        await SendJsonResponse(response, 200, new
        {
            success = result == SUCCESS,
            message = result == SUCCESS ? "ClickCall stopped" : "Stop failed",
            resultCode = $"0x{result:X}"
        });
    }

    private async Task HandleStatusRequest(HttpListenerResponse response)
    {
        await SendJsonResponse(response, 200, new
        {
            ctiConnected = _isConnected,
            clickCallActive = _isClickCallActive,
            clickCallRecording = _isClickCallRecording,
            currentCallerDn = _clickCallCallerDn,
            currentCalledDn = _clickCallCalledDn,
            incomingRecording = _isRecording
        });
    }

    private async Task SendJsonResponse(HttpListenerResponse response, int statusCode, object data)
    {
        response.StatusCode = statusCode;
        response.ContentType = "application/json; charset=utf-8";

        string json = JsonSerializer.Serialize(data);
        byte[] buffer = Encoding.UTF8.GetBytes(json);

        response.ContentLength64 = buffer.Length;
        await response.OutputStream.WriteAsync(buffer);
        response.Close();
    }
    #endregion

    #region ClickCall 발신 녹취
    private int StartClickCall(string callerDn, string calledDn)
    {
        _logger.LogInformation("═══════════════════════════════════════════════════════");
        _logger.LogInformation("📞 [ClickCall] 발신 시작");
        _logger.LogInformation("   발신자 (치과): 로그인 계정 기본번호 사용");
        _logger.LogInformation("   착신자 (환자): {Called}", calledDn);
        _logger.LogInformation("═══════════════════════════════════════════════════════");

        // 번호 정규화 (하이픈 제거)
        calledDn = calledDn.Replace("-", "");

        // IMS_ClickCall_Start(착신번호, 녹취옵션, 이벤트수신, 자동응답안함)
        // 녹취옵션: 1 = 녹취함
        // 이벤트수신: 1 = 이벤트 수신
        // 자동응답: 1 = 자동응답 안함 (발신자가 수화기를 직접 들어야 함)
        int result = IMS_ClickCall_Start(calledDn, 1, 1, 1);

        if (result == SUCCESS)
        {
            _isClickCallActive = true;
            _clickCallCallerDn = "";  // 발신자는 이벤트에서 확인됨 (로그인 계정 기본번호)
            _clickCallCalledDn = calledDn;  // 착신자 = 환자번호
            _clickCallStartTime = DateTime.Now;

            _logger.LogInformation("✅ [ClickCall] 시작 성공 - 치과 전화기가 울립니다!");
            _logger.LogInformation("   → 환자({Called})에게 전화를 겁니다", calledDn);
            // ★ OutgoingCall 이벤트는 IMS_SVC_ORIGCALL_START_NOTI 핸들러에서 전송 (중복 방지)
        }
        else
        {
            _logger.LogError("❌ [ClickCall] 시작 실패 (코드: 0x{Code:X})", result);

            // ★ Fix 4: 세션 관련 오류 시 재연결 트리거
            if (result == 0x800B || result == 0x8002 || result == 0x8014)
            {
                _logger.LogWarning("[ClickCall] 세션 오류 감지 (0x{Code:X}) - 재연결 예정", result);
                _needReconnect = true;
            }
        }

        return result;
    }

    private int StopClickCall()
    {
        _logger.LogInformation("[ClickCall] 통화 종료 요청");

        // 녹음 중이면 먼저 종료
        if (_isClickCallRecording)
        {
            int stopRecResult = IMS_ClickCall_StopRecord();
            _logger.LogInformation("[ClickCall] 녹음 종료: 0x{Code:X}", stopRecResult);
        }

        int result = IMS_ClickCall_Stop();

        if (result == SUCCESS)
        {
            int duration = (int)(DateTime.Now - _clickCallStartTime).TotalSeconds;

            _logger.LogInformation("✅ [ClickCall] 종료 성공 (통화시간: {Duration}초)", duration);

            // 통화 종료 이벤트
            _eventQueue.Enqueue(new CallEvent
            {
                Type = CallEventType.CallLog,
                EventType = "end",
                CallerNumber = _clickCallCalledDn,
                CalledNumber = _clickCallCallerDn,
                Duration = duration
            });

            ResetClickCallState();
        }
        else
        {
            _logger.LogError("❌ [ClickCall] 종료 실패 (코드: 0x{Code:X})", result);
        }

        return result;
    }

    private void ResetClickCallState()
    {
        _isClickCallActive = false;
        _isClickCallRecording = false;
        _clickCallCallerDn = "";
        _clickCallCalledDn = "";
        _clickCallLogId = "";  // ★ callLogId도 리셋
    }

    // ★ ClickCall 타임아웃 체크 (메인 루프에서 호출)
    // 내부 상태만 리셋 - IMS_ClickCall_Stop() 호출하지 않음 (실제 통화를 끊으면 안 됨)
    // 통화 종료는 상담사/환자가 수화기를 내려놓으면 CTI가 EVT_STOP_SERVICE를 보내줌
    private void CheckClickCallTimeout()
    {
        if (!_isClickCallActive) return;

        int elapsedSeconds = (int)(DateTime.Now - _clickCallStartTime).TotalSeconds;

        if (elapsedSeconds > CLICKCALL_TIMEOUT_SEC)
        {
            _logger.LogWarning("⏰ [ClickCall] 타임아웃! {Elapsed}초 경과 - 내부 상태만 리셋 (통화는 유지)", elapsedSeconds);
            _logger.LogWarning("   발신자: {Caller}, 착신자: {Called}", _clickCallCallerDn, _clickCallCalledDn);

            ResetClickCallState();
            _logger.LogInformation("✅ [ClickCall] 내부 상태 리셋 완료 (통화는 계속 진행)");
        }
    }

    // ClickCall 이벤트 처리 (ProcessEvent에서 호출)
    private void ProcessClickCallEvent(EvtMsg evt)
    {
        _logger.LogInformation("═══════════════════════════════════════════════════════");
        _logger.LogInformation("[ClickCall 이벤트] Service={Service}, EvtType=0x{EvtType:X}, Result=0x{Result:X}",
            evt.Service, evt.EvtType, evt.Result);
        _logger.LogInformation("[ClickCall 이벤트] Dn1={Dn1}, Dn2={Dn2}", evt.Dn1, evt.Dn2);
        _logger.LogInformation("[ClickCall 이벤트] ExtInfo={ExtInfo}", evt.ExtInfo);
        _logger.LogInformation("═══════════════════════════════════════════════════════");

        // 이벤트 타입에 따른 처리
        string extLower = (evt.ExtInfo ?? "").ToLower();

        // ★ EVT_STOP_SERVICE(0x0303) 또는 서비스 종료 관련 이벤트 - ExtInfo에서 실제 종료 사유 판별
        if (evt.EvtType == EVT_STOP_SERVICE || evt.EvtType == 0x0303)
        {
            // ExtInfo에서 실제 종료 사유 판별 (NoAnswer, Busy 등)
            string endReason = "service_stopped";
            if (extLower.Contains("noanswer") || extLower.Contains("no answer"))
                endReason = "no_answer";
            else if (extLower.Contains("busy"))
                endReason = "busy";
            else if (extLower.Contains("reject"))
                endReason = "rejected";
            else if (extLower.Contains("cancel") && !extLower.Contains("success"))
                endReason = "cancelled";
            // ★ 성공한 통화 (녹취파일 있음) → outbound_end (부재중 아님!)
            else if (extLower.Contains("success") && extLower.Contains("recfile"))
                endReason = "outbound_end";

            _logger.LogInformation("📴 [ClickCall] 서비스 종료 이벤트 (EVT_STOP_SERVICE) - 사유: {Reason}", endReason);
            HandleClickCallEnd(evt, endReason);
            return;
        }

        // ★ 통화 실패/종료 감지 (NoAnswer, ServiceCancel, Cancel, Reject 등)
        bool isCallEnded = extLower.Contains("noanswer") ||
                           extLower.Contains("no answer") ||
                           extLower.Contains("servicecancel") ||
                           extLower.Contains("service cancel") ||
                           extLower.Contains("cancel") ||
                           extLower.Contains("reject") ||
                           extLower.Contains("busy") ||
                           extLower.Contains("fail") ||
                           extLower.Contains("timeout") ||
                           extLower.Contains("release") ||
                           extLower.Contains("disconnect") ||
                           extLower.Contains("bye");

        if (isCallEnded)
        {
            // 어떤 종류의 종료인지 판별
            string endReason = "end";
            if (extLower.Contains("noanswer") || extLower.Contains("no answer"))
                endReason = "no_answer";
            else if (extLower.Contains("cancel"))
                endReason = "cancelled";
            else if (extLower.Contains("busy"))
                endReason = "busy";
            else if (extLower.Contains("reject"))
                endReason = "rejected";

            _logger.LogInformation("📴 [ClickCall] 통화 종료 감지: {Reason}", endReason);
            HandleClickCallEnd(evt, endReason);
            return;
        }

        // 발신자(치과) 응답
        if (extLower.Contains("caller") && extLower.Contains("answer"))
        {
            // ★ Dn1/Dn2에서 치과 번호 보강 (StartClickCall에서 비어있는 경우)
            if (string.IsNullOrEmpty(_clickCallCallerDn))
            {
                if (!string.IsNullOrEmpty(evt.Dn1)) _clickCallCallerDn = evt.Dn1;
                else if (!string.IsNullOrEmpty(evt.Dn2)) _clickCallCallerDn = evt.Dn2;
            }

            _logger.LogInformation("📞 [ClickCall] 발신자(치과) 수화기 들음 (치과번호: {CallerDn})", _clickCallCallerDn);
            _eventQueue.Enqueue(new CallEvent
            {
                Type = CallEventType.CallLog,
                EventType = "caller_answered",
                CallerNumber = _clickCallCalledDn,
                CalledNumber = _clickCallCallerDn
            });
        }
        // 착신자(환자) 응답 → 자동 녹취 시작!
        else if (extLower.Contains("called") && extLower.Contains("answer"))
        {
            _logger.LogInformation("📱 [ClickCall] 착신자(환자) 전화 받음 → 녹취 시작!");

            // 녹취 시작
            int recResult = IMS_ClickCall_StartRecord();
            if (recResult == SUCCESS)
            {
                _isClickCallRecording = true;
                _logger.LogInformation("🔴 [ClickCall] 녹취 시작 성공!");
            }
            else
            {
                _logger.LogError("❌ [ClickCall] 녹취 시작 실패 (코드: 0x{Code:X})", recResult);
            }

            _eventQueue.Enqueue(new CallEvent
            {
                Type = CallEventType.CallLog,
                EventType = "start",
                CallerNumber = _clickCallCalledDn,
                CalledNumber = _clickCallCallerDn
            });
        }
        // 녹음 시작 확인
        else if (extLower.Contains("record") && extLower.Contains("start"))
        {
            _isClickCallRecording = true;
            _logger.LogInformation("🔴 [ClickCall] 녹음 시작 확인");
        }
        // 녹음 종료 확인
        else if (extLower.Contains("record") && extLower.Contains("stop"))
        {
            _isClickCallRecording = false;
            _logger.LogInformation("⏹️ [ClickCall] 녹음 종료 확인");

            // 녹취 파일 URL 처리
            if (!string.IsNullOrEmpty(evt.ExtInfo) &&
                (evt.ExtInfo.Contains("http://") || evt.ExtInfo.Contains("https://")))
            {
                int urlStart = evt.ExtInfo.IndexOf("http");
                if (urlStart >= 0)
                {
                    string recordingUrl = evt.ExtInfo.Substring(urlStart).Split(' ', '\t', '\n', '\r')[0];
                    int duration = (int)(DateTime.Now - _clickCallStartTime).TotalSeconds;

                    _logger.LogInformation("📼 [ClickCall] 녹취 파일: {Url}", recordingUrl);

                    _eventQueue.Enqueue(new CallEvent
                    {
                        Type = CallEventType.Recording,
                        CallerNumber = _clickCallCalledDn,
                        CalledNumber = _clickCallCallerDn,
                        RecordingInfo = recordingUrl,
                        Duration = duration,
                        CallLogId = _clickCallLogId  // ★ callLogId 저장 (레이스컨디션 방지)
                    });
                }
            }
        }
    }

    // ★ ClickCall 종료 공통 처리
    private void HandleClickCallEnd(EvtMsg evt, string endReason)
    {
        // 녹취 중이면 종료
        if (_isClickCallRecording)
        {
            try
            {
                int stopRecResult = IMS_ClickCall_StopRecord();
                _logger.LogInformation("[ClickCall] 녹음 종료: 0x{Code:X}", stopRecResult);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ClickCall] 녹음 종료 중 오류");
            }
        }

        int duration = (int)(DateTime.Now - _clickCallStartTime).TotalSeconds;

        _eventQueue.Enqueue(new CallEvent
        {
            Type = CallEventType.CallLog,
            EventType = endReason,
            CallerNumber = _clickCallCalledDn,
            CalledNumber = _clickCallCallerDn,
            Duration = duration,
            CallLogId = _clickCallLogId,  // ★ V2 callLogId 포함 (정확한 매칭)
            ExtInfo = evt.ExtInfo
        });

        // 녹취 파일 URL이 있으면 전송
        if (!string.IsNullOrEmpty(evt.ExtInfo) &&
            (evt.ExtInfo.Contains("http://") || evt.ExtInfo.Contains("https://")))
        {
            int urlStart = evt.ExtInfo.IndexOf("http");
            if (urlStart >= 0)
            {
                string recordingUrl = evt.ExtInfo.Substring(urlStart).Split(' ', '\t', '\n', '\r')[0];
                _logger.LogInformation("📼 [ClickCall] 녹취 파일: {Url}", recordingUrl);

                _eventQueue.Enqueue(new CallEvent
                {
                    Type = CallEventType.Recording,
                    CallerNumber = _clickCallCalledDn,
                    CalledNumber = _clickCallCallerDn,
                    RecordingInfo = recordingUrl,
                    Duration = duration,
                    CallLogId = _clickCallLogId  // ★ 리셋 전에 callLogId 저장 (레이스컨디션 방지)
                });
            }
        }

        _logger.LogInformation("✅ [ClickCall] 상태 리셋 완료 (종료 사유: {Reason}, 통화시간: {Duration}초)", endReason, duration);
        ResetClickCallState();
    }
    #endregion
}
