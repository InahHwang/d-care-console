using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Net.Http;
using System.Text.Json;

namespace CTIBridge
{
    class Program
    {
        // ===== DLL IMPORTS (Ansi 호출) =====
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

        // ===== EVT 구조체 (문자열 대신 byte[]로 안전 수신) =====
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

        // 파싱 후 사용할 구조
        public struct EvtMsg
        {
            public int Service;
            public int EvtType;
            public int Result;
            public string Dn1;
            public string Dn2;
            public string ExtInfo;
        }

        // ===== 상수 =====
        public const int SUCCESS            = 0x0000;
        public const int IMS_SVC_CID_NOTIFY = 28;      // 0x1C - CID 알림 (구형)
        public const int IMS_SVC_RING       = 7;       // 착신 링 - 발신번호 포함
        public const int IMS_SVC_CONNECTED  = 9;       // 통화 연결
        public const int EVT_CONNECTED      = 0x0101;  // 257
        public const int EVT_LOGIN          = 0x0104;  // 260
        public const int EVT_SERVICE_INFO   = 0x0300;  // 768

        // ===== 설정 =====
        static string APP_KEY   = "zeQ4GBTe/n7Of6S0fd3egUfL4QDxsyc9fJWHwRTGUW4woKsHqFYINVBmFGEnCNyc";
        static string USER_ID   = "dsbrdental";
        static string PASSWORD  = "ektksqkfms1!";

        // Next.js 서버 URL (로컬 개발시 3000, 배포시 변경)
        static string NEXTJS_URL = "http://localhost:3000";

        static bool gotLogin   = false;
        static bool gotSvcInfo = false;
        static readonly HttpClient http = new();
        static Encoding Cp949;

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            // CP949 코드페이지 등록
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            Cp949 = Encoding.GetEncoding(949);

            Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
            Console.WriteLine("║       CTI Bridge - SK Broadband CID 연동 프로그램         ║");
            Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
            Console.WriteLine();
            Console.WriteLine($"  실행 경로: {AppDomain.CurrentDomain.BaseDirectory}");
            Console.WriteLine($"  시작 시간: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            Console.WriteLine($"  Next.js URL: {NEXTJS_URL}");
            Console.WriteLine();

            // 1. API 초기화
            Console.WriteLine("[1/3] SK CTI API 초기화 중...");
            int rc = IMS_Init(APP_KEY);
            if (rc != SUCCESS)
            {
                Console.WriteLine($"  ✗ 초기화 실패 (코드: 0x{rc:X})");
                Console.WriteLine("    → APP_KEY 확인 또는 DLL 파일 위치 확인 필요");
                return;
            }
            Console.WriteLine("  ✓ 초기화 성공");

            // 2. 로그인 시도 (최대 3회)
            Console.WriteLine("\n[2/3] CTI 서버 로그인 중...");
            bool ok = false;
            for (int attempt = 1; attempt <= 3 && !ok; attempt++)
            {
                if (attempt > 1)
                {
                    Console.WriteLine($"  → {attempt}차 재시도...");
                    try { IMS_Logout(); } catch { }
                    Thread.Sleep(1500);
                }

                gotLogin = false;
                gotSvcInfo = false;

                rc = IMS_Login(USER_ID, PASSWORD);
                if (rc != SUCCESS)
                {
                    Console.WriteLine($"  ✗ 로그인 요청 실패 (코드: 0x{rc:X})");
                    continue;
                }

                Thread.Sleep(200);
                ok = WaitLoginAndSvcInfo(60000);

                if (!ok)
                    Console.WriteLine("  ! 로그인 응답 대기 시간 초과");
            }

            if (!ok)
            {
                Console.WriteLine("\n✗ 로그인 실패");
                Console.WriteLine("  확인사항:");
                Console.WriteLine("  - 다른 CTI 프로그램이 실행 중인지 확인");
                Console.WriteLine("  - 사용자 ID/비밀번호 확인");
                Console.WriteLine("  - 방화벽/백신 프로그램 확인");
                Console.WriteLine("  - x86(32비트) 모드로 실행 중인지 확인");
                IMS_Close();
                return;
            }

            Console.WriteLine("  ✓ 로그인 성공");

            // 3. CID 수신 대기
            Console.WriteLine("\n[3/3] CID 수신 대기 시작");
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine("  전화가 오면 발신자번호가 여기에 표시됩니다.");
            Console.WriteLine("  종료하려면 Ctrl+C를 누르세요.");
            Console.WriteLine("═══════════════════════════════════════════════════════════\n");

            // 이벤트 폴링 루프
            while (true)
            {
                PollOnce();
                Thread.Sleep(200);
            }
        }

        static bool WaitLoginAndSvcInfo(int maxWaitMs)
        {
            int end = Environment.TickCount + maxWaitMs;
            while (Environment.TickCount < end && !gotLogin)
            {
                PollOnce();
                Thread.Sleep(150);
            }
            if (!gotLogin) return false;

            int end2 = Environment.TickCount + 5000;
            while (Environment.TickCount < end2 && !gotSvcInfo)
            {
                PollOnce();
                Thread.Sleep(150);
            }
            return true;
        }

        static void PollOnce()
        {
            try
            {
                _EVTMSG_RAW raw = new _EVTMSG_RAW
                {
                    dn1 = new byte[32],
                    dn2 = new byte[32],
                    ext = new byte[1024]
                };
                int r = IMS_GetEvent(ref raw);
                if (r != SUCCESS) return;

                var evt = ParseRaw(raw);
                if (!HasPayload(evt)) return;

                // 모든 이벤트 로그 출력 (디버깅용)
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 이벤트 수신: Svc={evt.Service} Type=0x{evt.EvtType:X} Res=0x{evt.Result:X}");
                if (!string.IsNullOrEmpty(evt.Dn1)) Console.WriteLine($"  DN1(발신): {evt.Dn1}");
                if (!string.IsNullOrEmpty(evt.Dn2)) Console.WriteLine($"  DN2(수신): {evt.Dn2}");
                if (!string.IsNullOrEmpty(evt.ExtInfo) && evt.ExtInfo.Length < 100)
                    Console.WriteLine($"  ExtInfo: {evt.ExtInfo}");

                // 이벤트 타입별 처리
                if (evt.EvtType == EVT_CONNECTED)
                {
                    Console.WriteLine("  → 서버 연결됨");
                }
                else if (evt.EvtType == EVT_LOGIN)
                {
                    Console.WriteLine("  → 로그인 완료");
                    gotLogin = true;
                }
                else if (evt.EvtType == EVT_SERVICE_INFO)
                {
                    gotSvcInfo = true;
                }
                // Svc=7 (착신 링) 또는 Svc=28 (CID 알림) 일 때 발신번호 처리
                else if (evt.Service == IMS_SVC_RING || evt.Service == IMS_SVC_CID_NOTIFY)
                {
                    // 발신번호가 있을 때만 처리
                    if (!string.IsNullOrEmpty(evt.Dn1))
                    {
                        Console.WriteLine();
                        Console.WriteLine("╔══════════════════════════════════════╗");
                        Console.WriteLine("║          📞 전화 수신!              ║");
                        Console.WriteLine("╠══════════════════════════════════════╣");
                        Console.WriteLine($"║  발신번호: {evt.Dn1,-24} ║");
                        Console.WriteLine($"║  수신번호: {evt.Dn2,-24} ║");
                        Console.WriteLine($"║  시각: {DateTime.Now:yyyy-MM-dd HH:mm:ss,-20} ║");
                        Console.WriteLine("╚══════════════════════════════════════╝");
                        Console.WriteLine();

                        // Next.js 서버로 전송
                        _ = SendToNextJS(evt.Dn1, evt.Dn2);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[오류] {ex.Message}");
            }
        }

        static EvtMsg ParseRaw(_EVTMSG_RAW raw)
        {
            return new EvtMsg
            {
                Service = raw.nService,
                EvtType = raw.nEvtType,
                Result  = raw.nResult,
                Dn1     = BytesToAnsiString(raw.dn1),
                Dn2     = BytesToAnsiString(raw.dn2),
                ExtInfo = BytesToAnsiString(raw.ext)
            };
        }

        static string BytesToAnsiString(byte[] buf)
        {
            if (buf == null || buf.Length == 0) return "";
            int len = Array.IndexOf<byte>(buf, 0);
            if (len < 0) len = buf.Length;
            if (len == 0) return "";
            return Cp949.GetString(buf, 0, len).Trim();
        }

        static bool HasPayload(EvtMsg e)
        {
            return e.Service != 0 || e.EvtType != 0 || e.Result != 0 ||
                   !string.IsNullOrEmpty(e.Dn1) || !string.IsNullOrEmpty(e.Dn2) ||
                   !string.IsNullOrEmpty(e.ExtInfo);
        }

        static async System.Threading.Tasks.Task SendToNextJS(string callerNumber, string calledNumber)
        {
            try
            {
                var payload = new
                {
                    callerNumber = callerNumber,
                    calledNumber = calledNumber,
                    timestamp = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
                };

                var json = JsonSerializer.Serialize(payload);
                Console.WriteLine($"  → Next.js 서버로 전송 중...");

                var response = await http.PostAsync(
                    $"{NEXTJS_URL}/api/cti/incoming-call",
                    new StringContent(json, Encoding.UTF8, "application/json")
                );

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"  ✓ 전송 성공! 응답: {(int)response.StatusCode}");
                }
                else
                {
                    Console.WriteLine($"  ✗ 전송 실패: HTTP {(int)response.StatusCode}");
                }
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"  ✗ 연결 실패: {ex.Message}");
                Console.WriteLine($"    → Next.js 서버가 {NEXTJS_URL}에서 실행 중인지 확인하세요.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  ✗ 오류: {ex.Message}");
            }
        }
    }
}
