namespace Jikkai.Bootstrapper.Services;

internal static class PayloadLocator
{
    private const string PayloadFileName = "JIKKAI-Payload.exe";
    private static readonly string[] InstalledExecutableNames = ["JIKKAI.exe", "Jikkai.exe"];

    public static string Locate()
    {
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("JIKKAI_INSTALLER_PAYLOAD"),
            Path.Combine(AppContext.BaseDirectory, "Payload", PayloadFileName),
            Path.Combine(AppContext.BaseDirectory, PayloadFileName),
            Path.Combine(Environment.CurrentDirectory, "Payload", PayloadFileName),
            Path.Combine(Environment.CurrentDirectory, PayloadFileName)
        };

        var payload = candidates
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => Path.GetFullPath(path!))
            .FirstOrDefault(File.Exists);

        if (payload is null)
        {
            throw new FileNotFoundException(
                "O pacote de instalação do JIKKAI não foi encontrado. Baixe novamente o instalador oficial.",
                PayloadFileName);
        }

        return payload;
    }

    public static string? FindInstalledExecutable(string installDirectory)
    {
        if (string.IsNullOrWhiteSpace(installDirectory) || !Directory.Exists(installDirectory))
        {
            return null;
        }

        var candidates = new[]
        {
            Path.Combine(installDirectory, "JIKKAI.exe"),
            Path.Combine(installDirectory, "Jikkai.exe"),
            Path.Combine(installDirectory, "app", "JIKKAI.exe"),
            Path.Combine(installDirectory, "app", "Jikkai.exe")
        };

        var directMatch = candidates.FirstOrDefault(IsUsableInstalledExecutable);
        if (directMatch is not null)
        {
            return directMatch;
        }

        try
        {
            return Directory
                .EnumerateFiles(installDirectory, "*.exe", SearchOption.AllDirectories)
                .Where(path => InstalledExecutableNames.Contains(
                    Path.GetFileName(path),
                    StringComparer.OrdinalIgnoreCase))
                .OrderBy(path => path.Count(character => character == Path.DirectorySeparatorChar))
                .FirstOrDefault(IsUsableInstalledExecutable);
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    public static bool IsUsableInstalledExecutable(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        try
        {
            var file = new FileInfo(path);
            return file.Exists && file.Length > 0;
        }
        catch
        {
            return false;
        }
    }
}
