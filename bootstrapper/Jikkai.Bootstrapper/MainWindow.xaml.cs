using System.ComponentModel;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Windows;
using System.Windows.Input;
using Jikkai.Bootstrapper.Services;
using Forms = System.Windows.Forms;
using Brush = System.Windows.Media.Brush;
using Brushes = System.Windows.Media.Brushes;
using Color = System.Windows.Media.Color;
using SolidColorBrush = System.Windows.Media.SolidColorBrush;

namespace Jikkai.Bootstrapper;

public partial class MainWindow : Window
{
    private const long RequiredFreeBytes = 500L * 1024L * 1024L;
    private static readonly TimeSpan InstallerTimeout = TimeSpan.FromMinutes(12);
    private readonly string _defaultInstallDirectory;
    private bool _isBusy;
    private bool _installationCompleted;
    private string? _installedExecutable;

    public MainWindow()
    {
        InitializeComponent();

        _defaultInstallDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "JIKKAI");

        InstallPathTextBox.Text = _defaultInstallDirectory;
        Loaded += (_, _) => RefreshInstallMode();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (_isBusy)
        {
            e.Cancel = true;
            SetStatus(
                "Operação em andamento",
                "Aguarde a conclusão para evitar arquivos incompletos.",
                StatusTone.Warning);
        }

        base.OnClosing(e);
    }

    private void Header_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            DragMove();
        }
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy)
        {
            SetStatus(
                "Operação em andamento",
                "Aguarde a conclusão para fechar o instalador.",
                StatusTone.Warning);
            return;
        }

        Close();
    }

    private void Browse_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy) return;

        using var dialog = new Forms.FolderBrowserDialog
        {
            Description = "Escolha a pasta onde o JIKKAI será instalado.",
            UseDescriptionForTitle = true,
            SelectedPath = Directory.Exists(InstallPathTextBox.Text)
                ? InstallPathTextBox.Text
                : _defaultInstallDirectory,
            ShowNewFolderButton = true
        };

        if (dialog.ShowDialog() == Forms.DialogResult.OK && !string.IsNullOrWhiteSpace(dialog.SelectedPath))
        {
            var selected = Path.GetFullPath(dialog.SelectedPath);
            InstallPathTextBox.Text = string.Equals(
                Path.GetFileName(selected.TrimEnd(Path.DirectorySeparatorChar)),
                "JIKKAI",
                StringComparison.OrdinalIgnoreCase)
                ? selected
                : Path.Combine(selected, "JIKKAI");
            RefreshInstallMode();
        }
    }

    private async void Install_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy) return;

        if (_installationCompleted)
        {
            LaunchInstalledApplication();
            return;
        }

        string installDirectory;
        try
        {
            installDirectory = ValidateInstallDirectory(InstallPathTextBox.Text);
        }
        catch (Exception exception)
        {
            SetStatus("Local inválido", exception.Message, StatusTone.Error);
            return;
        }

        SetBusy(true);
        ResetProgress();

        try
        {
            PageKicker.Text = "ROMPENDO O SELO";
            PageTitle.Text = "Instalando o Jikkai";
            PageDescription.Text = "Mantenha esta janela aberta enquanto a operação é concluída.";
            PrimaryActionButton.Content = "INSTALANDO...";

            SetStage(1);
            SetStatus("Localizando o selo", "Preparando os arquivos necessários para a instalação.", StatusTone.Active);
            SetProgress(4);

            var payloadPath = PayloadLocator.Locate();
            VersionText.Text = $"PACOTE · {Path.GetFileName(payloadPath)}";
            BootstrapperLog.Write(
                $"Operação iniciada. Payload=\"{payloadPath}\"; destino=\"{installDirectory}\".");

            EnsureFreeSpace(installDirectory);

            SetStatus("Validando o fuuinjutsu", "Verificando a integridade do pacote oficial.", StatusTone.Active);
            var progress = new Progress<double>(value => SetProgress(6 + value * 0.17));
            var hash = await Task.Run(() => ComputeSha256(payloadPath, progress));
            VersionText.Text = $"PACOTE VERIFICADO · SHA-256 {hash[..12].ToUpperInvariant()}";
            BootstrapperLog.Write($"SHA-256 do payload: {hash}.");
            SetProgress(24);

            SetStage(2);
            SetStatus("Aplicando o selo", "Configurando o cliente, o overlay e os atalhos do Windows.", StatusTone.Active);

            var installTask = InstallerRunner.RunAsync(
                payloadPath,
                installDirectory,
                InstallerTimeout,
                CancellationToken.None);

            await AnimateInstallationProgressAsync(installTask, 25, 90);
            var result = await installTask;

            if (result.TimedOut)
            {
                throw new TimeoutException(
                    "A instalação interna demorou mais que o esperado e não pôde ser confirmada.");
            }

            if (!result.Succeeded)
            {
                if (result.ExitCode is not null && result.ExitCode != 0)
                {
                    throw new InvalidOperationException(
                        $"O instalador interno terminou com o código {result.ExitCode}.");
                }

                throw new InvalidOperationException(
                    "O instalador interno foi encerrado, mas os arquivos do JIKKAI não puderam ser confirmados.");
            }

            SetProgress(93);
            SetStage(3);
            SetStatus(
                "Confirmando instalação",
                "O selo foi aplicado. Confirmando os arquivos do cliente.",
                StatusTone.Active);

            _installedExecutable =
                result.InstalledExecutable ??
                PayloadLocator.FindInstalledExecutable(installDirectory);

            if (!PayloadLocator.IsUsableInstalledExecutable(_installedExecutable))
            {
                throw new FileNotFoundException(
                    "A instalação terminou, mas o executável principal do JIKKAI não foi encontrado.");
            }

            await Task.Delay(650);
            SetProgress(98);
            SetStatus(
                "Concluindo a operação",
                "Preparando o cliente para a primeira inicialização.",
                StatusTone.Active);
            await Task.Delay(350);

            SetProgress(100);
            CompleteInstallation();

            if (OpenAfterInstallCheckBox.IsChecked == true && _installedExecutable is not null)
            {
                await Task.Delay(800);
                LaunchInstalledApplication(closeAfterLaunch: true);
            }
        }
        catch (Exception exception)
        {
            BootstrapperLog.Write("Falha na operação do bootstrapper.", exception);
            ShowInstallationError(exception);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private string ValidateInstallDirectory(string rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            throw new InvalidOperationException("Escolha uma pasta para continuar.");
        }

        var fullPath = Path.GetFullPath(Environment.ExpandEnvironmentVariables(rawPath.Trim()));
        var root = Path.GetPathRoot(fullPath);
        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
        {
            throw new InvalidOperationException("A unidade selecionada não está disponível.");
        }

        if (fullPath.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
        {
            throw new InvalidOperationException("O caminho escolhido possui caracteres inválidos.");
        }

        InstallPathTextBox.Text = fullPath;
        return fullPath;
    }

    private static void EnsureFreeSpace(string installDirectory)
    {
        var root = Path.GetPathRoot(installDirectory);
        if (string.IsNullOrWhiteSpace(root)) return;

        var drive = new DriveInfo(root);
        if (drive.IsReady && drive.AvailableFreeSpace < RequiredFreeBytes)
        {
            throw new IOException("Não há espaço suficiente. Libere pelo menos 500 MB e tente novamente.");
        }
    }

    private static string ComputeSha256(string filePath, IProgress<double> progress)
    {
        using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 1024, FileOptions.SequentialScan);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[1024 * 1024];
        long totalRead = 0;

        while (true)
        {
            var read = stream.Read(buffer, 0, buffer.Length);
            if (read <= 0) break;

            hash.AppendData(buffer, 0, read);
            totalRead += read;
            progress.Report(stream.Length == 0 ? 1 : (double)totalRead / stream.Length);
        }

        return Convert.ToHexString(hash.GetHashAndReset());
    }

    private async Task AnimateInstallationProgressAsync(Task installTask, double start, double end)
    {
        var current = start;
        SetProgress(current);

        while (!installTask.IsCompleted)
        {
            await Task.Delay(360);
            var remaining = end - current;
            current += Math.Max(0.25, remaining * 0.055);
            SetProgress(Math.Min(end, current));
        }
    }

    private void CompleteInstallation()
    {
        _installationCompleted = true;
        PageKicker.Text = "OPERAÇÃO CONCLUÍDA";
        PageTitle.Text = "Jikkai pronto para operar";
        PageDescription.Text = "O cliente foi instalado com sucesso e já pode ser iniciado.";
        ModeBadge.Text = "PRONTO";
        PrimaryActionButton.Content = "ABRIR JIKKAI";
        SetStatus(
            "Selo concluído",
            "Todos os componentes foram instalados corretamente.",
            StatusTone.Success);
        SetStage(3, completed: true);
        BootstrapperLog.Write(
            $"Operação concluída. Executável=\"{_installedExecutable}\".");
    }

    private void ShowInstallationError(Exception exception)
    {
        _installationCompleted = false;
        PageKicker.Text = "OPERAÇÃO INTERROMPIDA";
        PageTitle.Text = "Não foi possível concluir";
        PageDescription.Text = $"Consulte o registro em {BootstrapperLog.FilePath}.";
        PrimaryActionButton.Content = "TENTAR NOVAMENTE";
        SetStatus("Falha na instalação", exception.Message, StatusTone.Error);
        ProgressPercent.Text = "ERRO";
        StatusDot.Background = FindBrush("DangerBrush", Brushes.IndianRed);
    }

    private void LaunchInstalledApplication(bool closeAfterLaunch = false)
    {
        var installDirectory = InstallPathTextBox.Text;
        _installedExecutable ??= PayloadLocator.FindInstalledExecutable(installDirectory);

        if (_installedExecutable is null)
        {
            SetStatus(
                "Atalho criado",
                "Não encontrei o executável na pasta escolhida. Abra o JIKKAI pelo atalho da área de trabalho.",
                StatusTone.Warning);
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = _installedExecutable,
                WorkingDirectory = Path.GetDirectoryName(_installedExecutable) ?? installDirectory,
                UseShellExecute = true
            });

            if (closeAfterLaunch)
            {
                _isBusy = false;
                Close();
            }
        }
        catch (Exception exception)
        {
            BootstrapperLog.Write(
                $"Não foi possível abrir o JIKKAI em \"{_installedExecutable}\".",
                exception);
            SetStatus("Não consegui abrir o Jikkai", exception.Message, StatusTone.Error);
        }
    }

    private void RefreshInstallMode()
    {
        try
        {
            var directory = ValidateInstallDirectory(InstallPathTextBox.Text);
            _installedExecutable = PayloadLocator.FindInstalledExecutable(directory);
            var updating = _installedExecutable is not null;
            ModeBadge.Text = updating ? "ATUALIZAÇÃO" : "NOVA INSTALAÇÃO";
            PrimaryActionButton.Content = updating ? "ATUALIZAR JIKKAI" : "INSTALAR JIKKAI";
            DiskSpaceText.Text = updating
                ? "A instalação existente será atualizada sem remover os dados do perfil."
                : "Requer aproximadamente 500 MB livres.";
        }
        catch
        {
            ModeBadge.Text = "NOVA INSTALAÇÃO";
        }
    }

    private void SetBusy(bool busy)
    {
        _isBusy = busy;
        InstallPathTextBox.IsEnabled = !busy;
        BrowseButton.IsEnabled = !busy;
        OpenAfterInstallCheckBox.IsEnabled = !busy;
        PrimaryActionButton.IsEnabled = !busy || _installationCompleted;
    }

    private void ResetProgress()
    {
        _installationCompleted = false;
        SetProgress(0);
        SetStage(0);
    }

    private void SetProgress(double value)
    {
        var normalized = Math.Clamp(value, 0, 100);
        InstallProgress.Value = normalized;
        ProgressPercent.Text = $"{Math.Round(normalized):0}%";
    }

    private void SetStage(int stage, bool completed = false)
    {
        ApplyStepState(StepPrepareDot, StepPrepareText, stage, 1, completed);
        ApplyStepState(StepInstallDot, StepInstallText, stage, 2, completed);
        ApplyStepState(StepFinishDot, StepFinishText, stage, 3, completed);
    }

    private void ApplyStepState(System.Windows.Controls.Border dot, System.Windows.Controls.TextBlock text, int stage, int step, bool allCompleted)
    {
        if (allCompleted || stage > step)
        {
            dot.Background = FindBrush("OrangeBrush", Brushes.DarkOrange);
            text.Foreground = FindBrush("OrangeBrightBrush", Brushes.OrangeRed);
            return;
        }

        if (stage == step)
        {
            dot.Background = FindBrush("OrangeBrightBrush", Brushes.OrangeRed);
            text.Foreground = FindBrush("TextBrush", Brushes.White);
            return;
        }

        dot.Background = new SolidColorBrush(Color.FromRgb(43, 32, 27));
        text.Foreground = new SolidColorBrush(Color.FromRgb(145, 131, 122));
    }

    private void SetStatus(string title, string description, StatusTone tone)
    {
        StatusTitle.Text = title;
        StatusDescription.Text = description;
        StatusDot.Background = tone switch
        {
            StatusTone.Success => FindBrush("OrangeBrush", Brushes.DarkOrange),
            StatusTone.Error => FindBrush("DangerBrush", Brushes.IndianRed),
            StatusTone.Warning => FindBrush("BurntRedBrush", Brushes.OrangeRed),
            _ => FindBrush("OrangeBrightBrush", Brushes.OrangeRed)
        };
    }

    private Brush FindBrush(string resourceKey, Brush fallback)
    {
        return TryFindResource(resourceKey) as Brush ?? fallback;
    }

    private enum StatusTone
    {
        Active,
        Success,
        Warning,
        Error
    }
}
