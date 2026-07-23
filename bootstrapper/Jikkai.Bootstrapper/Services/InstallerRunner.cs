using System.Diagnostics;

namespace Jikkai.Bootstrapper.Services;

internal static class InstallerRunner
{
    public static async Task<int> RunAsync(string payloadPath, string installDirectory, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(installDirectory);

        var startInfo = new ProcessStartInfo
        {
            FileName = payloadPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            WorkingDirectory = Path.GetDirectoryName(payloadPath) ?? AppContext.BaseDirectory
        };

        startInfo.ArgumentList.Add("/S");
        startInfo.ArgumentList.Add($"/D={installDirectory}");

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Não foi possível iniciar o instalador interno do JIKKAI.");

        await process.WaitForExitAsync(cancellationToken);
        return process.ExitCode;
    }
}
