using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Events;

namespace CTIBridge
{
    class Program
    {
        static void Main(string[] args)
        {
            // 로그 디렉토리 생성
            string logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
            Directory.CreateDirectory(logDir);

            // Serilog 설정
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .WriteTo.Console()
                .WriteTo.File(
                    Path.Combine(logDir, "cti-.log"),
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 30,
                    encoding: System.Text.Encoding.UTF8
                )
                .CreateLogger();

            try
            {
                Log.Information("CTI Bridge 서비스 시작 중...");

                var builder = Host.CreateApplicationBuilder(args);

                // Serilog 사용
                builder.Logging.ClearProviders();
                builder.Logging.AddSerilog(Log.Logger);

                // CTI Worker 서비스 등록
                builder.Services.AddHostedService<CTIWorker>();

                // Windows 서비스로 실행
                builder.Services.AddWindowsService(options =>
                {
                    options.ServiceName = "CTI Bridge Service";
                });

                var host = builder.Build();
                host.Run();
            }
            catch (Exception ex)
            {
                Log.Fatal(ex, "CTI Bridge 시작 실패");
            }
            finally
            {
                Log.CloseAndFlush();
            }
        }
    }
}
