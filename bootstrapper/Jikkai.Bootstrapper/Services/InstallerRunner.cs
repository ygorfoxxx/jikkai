using System.Diagnostics;

namespace Jikkai.Bootstrapper.Services;

internal sealed record InstallerRunResult(
    int? ExitCode,
    bool InstallationConfirmed,
    bool ProcessTerminatedAfterConfirmation,
    bool TimedOut,
    int ProcessId,
    TimeSpan Duration,
    string? InstalledExecutable)
{
    public bool Succeeded =>
        InstallationConfirmed &&
        (ExitCode == 0 || ProcessTerminatedAfterConfirmation);
}

internal static class InstallerRunner
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan StableWindow = TimeSpan.FromSeconds(6);
    private static readonly TimeSpan MinimumObservation = TimeSpan.FromSeconds(8);

    public static async Task<InstallerRunResult> RunAsync(
        string payloadPath,
        string installDirectory,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(installDirectory);

        var baseline = InstallationSnapshot.Capture(installDirectory);
        var startedAt = DateTimeOffset.UtcNow;
        var startInfo = new ProcessStartInfo
        {
            FileName = payloadPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            WorkingDirectory = Path.GetDirectoryName(payloadPath) ?? AppContext.BaseDirectory
        };

        startInfo.ArgumentList.Add("/S");
        // No NSIS, /D precisa ser o último argumento e não deve ser colocado entre aspas manualmente.
        startInfo.ArgumentList.Add($"/D={installDirectory}");

        BootstrapperLog.Write(
            $"Iniciando payload. Arquivo=\"{payloadPath}\"; argumentos=\"/S /D={installDirectory}\"; destino=\"{installDirectory}\".");

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Não foi possível iniciar o instalador interno do JIKKAI.");

        var processId = process.Id;
        BootstrapperLog.Write($"Payload iniciado. PID={processId}.");

        var exitTask = process.WaitForExitAsync(cancellationToken);
        var lastSnapshot = baseline;
        var unchangedSince = DateTimeOffset.UtcNow;
        var installationActivityObserved = false;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (exitTask.IsCompleted)
            {
                await exitTask;
                var installedExecutable = PayloadLocator.FindInstalledExecutable(installDirectory);
                var confirmed = PayloadLocator.IsUsableInstalledExecutable(installedExecutable);
                var duration = DateTimeOffset.UtcNow - startedAt;

                BootstrapperLog.Write(
                    $"Payload encerrou. PID={processId}; código={process.ExitCode}; duração={duration}; " +
                    $"instalação confirmada={confirmed}; executável=\"{installedExecutable ?? "(não encontrado)"}\".");

                return new InstallerRunResult(
                    process.ExitCode,
                    confirmed,
                    ProcessTerminatedAfterConfirmation: false,
                    TimedOut: false,
                    processId,
                    duration,
                    installedExecutable);
            }

            var now = DateTimeOffset.UtcNow;
            var elapsed = now - startedAt;
            if (elapsed >= timeout)
            {
                TryTerminateInstallerProcess(process);
                var duration = DateTimeOffset.UtcNow - startedAt;

                BootstrapperLog.Write(
                    $"Timeout do payload. PID={processId}; duração={duration}; destino=\"{installDirectory}\".");

                return new InstallerRunResult(
                    ExitCode: null,
                    InstallationConfirmed: false,
                    ProcessTerminatedAfterConfirmation: false,
                    TimedOut: true,
                    processId,
                    duration,
                    PayloadLocator.FindInstalledExecutable(installDirectory));
            }

            await Task.Delay(PollInterval, cancellationToken);

            var snapshot = InstallationSnapshot.Capture(installDirectory);
            if (snapshot != lastSnapshot)
            {
                installationActivityObserved = installationActivityObserved || snapshot != baseline;
                lastSnapshot = snapshot;
                unchangedSince = DateTimeOffset.UtcNow;
            }

            var installedExecutableCandidate = PayloadLocator.FindInstalledExecutable(installDirectory);
            var executableIsUsable =
                PayloadLocator.IsUsableInstalledExecutable(installedExecutableCandidate);
            var filesAreStable = DateTimeOffset.UtcNow - unchangedSince >= StableWindow;

            if (elapsed >= MinimumObservation &&
                installationActivityObserved &&
                executableIsUsable &&
                filesAreStable)
            {
                BootstrapperLog.Write(
                    $"Arquivos instalados e estáveis. PID={processId}; executável=\"{installedExecutableCandidate}\". " +
                    "Encerrando somente o processo do instalador interno que permaneceu aberto.");

                var terminated = TryTerminateInstallerProcess(process);
                if (terminated)
                {
                    try
                    {
                        await process.WaitForExitAsync(CancellationToken.None)
                            .WaitAsync(TimeSpan.FromSeconds(5));
                    }
                    catch (TimeoutException)
                    {
                        BootstrapperLog.Write(
                            $"O processo do instalador PID={processId} não confirmou encerramento em 5 segundos.");
                    }
                }

                var duration = DateTimeOffset.UtcNow - startedAt;
                int? exitCode = process.HasExited ? process.ExitCode : null;

                BootstrapperLog.Write(
                    $"Instalação confirmada pelos arquivos. PID={processId}; código={exitCode?.ToString() ?? "(indisponível)"}; " +
                    $"duração={duration}; processo encerrado={terminated}.");

                return new InstallerRunResult(
                    exitCode,
                    InstallationConfirmed: true,
                    ProcessTerminatedAfterConfirmation: terminated,
                    TimedOut: false,
                    processId,
                    duration,
                    installedExecutableCandidate);
            }
        }
    }

    private static bool TryTerminateInstallerProcess(Process process)
    {
        try
        {
            if (process.HasExited)
            {
                return false;
            }

            process.Kill();
            return true;
        }
        catch (Exception exception)
        {
            BootstrapperLog.Write(
                $"Não foi possível encerrar o processo do instalador PID={process.Id}.",
                exception);
            return false;
        }
    }

    private readonly record struct InstallationSnapshot(
        int FileCount,
        long TotalBytes,
        long LatestWriteTicks)
    {
        public static InstallationSnapshot Capture(string directory)
        {
            if (!Directory.Exists(directory))
            {
                return default;
            }

            var fileCount = 0;
            long totalBytes = 0;
            long latestWriteTicks = 0;

            try
            {
                foreach (var path in Directory.EnumerateFiles(
                             directory,
                             "*",
                             SearchOption.AllDirectories))
                {
                    try
                    {
                        var file = new FileInfo(path);
                        if (!file.Exists)
                        {
                            continue;
                        }

                        fileCount++;
                        totalBytes = totalBytes > long.MaxValue - file.Length
                            ? long.MaxValue
                            : totalBytes + file.Length;
                        latestWriteTicks = Math.Max(
                            latestWriteTicks,
                            file.LastWriteTimeUtc.Ticks);
                    }
                    catch (IOException)
                    {
                        // O instalador pode estar substituindo o arquivo durante a leitura.
                    }
                    catch (UnauthorizedAccessException)
                    {
                        // Ignora arquivos temporariamente inacessíveis.
                    }
                }
            }
            catch (IOException)
            {
                // Mantém o último retrato possível durante alterações da árvore.
            }
            catch (UnauthorizedAccessException)
            {
                // Mantém o último retrato possível durante alterações da árvore.
            }

            return new InstallationSnapshot(fileCount, totalBytes, latestWriteTicks);
        }
    }
}
