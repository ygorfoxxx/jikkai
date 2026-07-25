namespace Jikkai.Bootstrapper.Services;

internal static class BootstrapperLog
{
    private static readonly object SyncRoot = new();

    public static string FilePath { get; } =
        Path.Combine(Path.GetTempPath(), "JIKKAI-Bootstrapper.log");

    public static void Write(string message, Exception? exception = null)
    {
        try
        {
            var lines = new List<string>
            {
                $"[{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss zzz}] {message}"
            };

            if (exception is not null)
            {
                lines.Add(exception.ToString());
            }

            lock (SyncRoot)
            {
                File.AppendAllLines(FilePath, lines);
            }
        }
        catch
        {
            // O log nunca deve interromper a instalação.
        }
    }
}
