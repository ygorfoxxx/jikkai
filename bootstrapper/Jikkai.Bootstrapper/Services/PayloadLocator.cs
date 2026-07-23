namespace Jikkai.Bootstrapper.Services;

internal static class PayloadLocator
{
    private const string PayloadFileName = "JIKKAI-Payload.exe";

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
        var candidates = new[]
        {
            Path.Combine(installDirectory, "JIKKAI.exe"),
            Path.Combine(installDirectory, "Jikkai.exe"),
            Path.Combine(installDirectory, "app", "JIKKAI.exe"),
            Path.Combine(installDirectory, "app", "Jikkai.exe")
        };

        return candidates.FirstOrDefault(File.Exists);
    }
}
