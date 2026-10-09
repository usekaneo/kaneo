function Install-KaneoCli {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseShouldProcessForStateChangingFunctions', '')]
    [CmdletBinding()]
    param()

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    $useColor = -not $env:NO_COLOR

    function Write-Line {
        param([string]$Text = '', [string]$Color = '')
        if ($Color -and $useColor) {
            Write-Host $Text -ForegroundColor $Color
        }
        else {
            Write-Host $Text
        }
    }

    function Write-Warn {
        param([string]$Text)
        if ($useColor) {
            Write-Host 'warning: ' -ForegroundColor Yellow -NoNewline
            Write-Host $Text
        }
        else {
            Write-Host "warning: $Text"
        }
    }

    function Get-RemoteFile {
        param([string]$Url, [string]$OutFile)
        $localPath = $null
        if ($Url -notmatch '^[A-Za-z][A-Za-z0-9+.-]*://') {
            $localPath = $Url
        }
        elseif ($Url -match '^file://') {
            $localPath = ([Uri]$Url).LocalPath
        }
        if ($localPath) {
            if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
                return 'missing'
            }
            Copy-Item -LiteralPath $localPath -Destination $OutFile -Force
            return 'ok'
        }
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $OutFile
            return 'ok'
        }
        catch {
            $response = $_.Exception.Response
            if ($response -and [int]$response.StatusCode -eq 404) {
                return 'missing'
            }
            return "failed: $($_.Exception.Message)"
        }
    }

    function Get-LatestVersion {
        for ($page = 1; $page -le 3; $page++) {
            $url = "https://api.github.com/repos/usekaneo/kaneo/releases?per_page=100&page=$page"
            try {
                $response = Invoke-RestMethod -UseBasicParsing -Uri $url -Headers @{ Accept = 'application/vnd.github+json' }
            }
            catch {
                throw "Could not look up the latest release on GitHub ($($_.Exception.Message)). Check your internet connection, or set KANEO_VERSION to skip the lookup. Without a token GitHub allows 60 lookups per hour."
            }
            $releases = @($response)
            if ($releases.Count -eq 0) {
                break
            }
            $candidates = foreach ($release in $releases) {
                if ($release.draft -or $release.prerelease) {
                    continue
                }
                if (-not ($release.tag_name -match '^cli-v(\d+)\.(\d+)\.(\d+)')) {
                    continue
                }
                [pscustomobject]@{
                    Version = $release.tag_name.Substring(5)
                    Order   = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
                }
            }
            $best = @($candidates) | Sort-Object -Property Order -Descending | Select-Object -First 1
            if ($best) {
                return $best.Version
            }
        }
        throw 'No Kaneo CLI release found on GitHub. See https://github.com/usekaneo/kaneo/releases or set KANEO_VERSION.'
    }

    function Get-UserPath {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
        if (-not $key) {
            return ''
        }
        try {
            return [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        }
        finally {
            $key.Close()
        }
    }

    function Set-UserPath {
        param([string]$Value)
        $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
        try {
            $key.SetValue('Path', $Value, [Microsoft.Win32.RegistryValueKind]::ExpandString)
        }
        finally {
            $key.Close()
        }
        $notice = 'KANEO_INSTALL_' + [guid]::NewGuid().ToString('N')
        [Environment]::SetEnvironmentVariable($notice, '1', 'User')
        [Environment]::SetEnvironmentVariable($notice, '', 'User')
    }

    function ConvertTo-PathKey {
        param([string]$Path)
        return [Environment]::ExpandEnvironmentVariables($Path).Trim().Trim('"').TrimEnd('\', '/').ToLowerInvariant()
    }

    function Find-FirstKaneo {
        param([string[]]$Directories)
        foreach ($directory in $Directories) {
            if (-not $directory) {
                continue
            }
            $expanded = [Environment]::ExpandEnvironmentVariables($directory).Trim().Trim('"')
            foreach ($name in 'kaneo.exe', 'kaneo.cmd', 'kaneo.bat', 'kaneo.com', 'kaneo.ps1') {
                try {
                    $candidate = [IO.Path]::Combine($expanded, $name)
                }
                catch {
                    continue
                }
                if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                    return $candidate
                }
            }
        }
        return $null
    }

    if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) {
        throw 'This script is for Windows. On macOS and Linux run: curl -fsSL https://kaneo.app/cli/install.sh | sh'
    }

    $machineArch = $env:PROCESSOR_ARCHITEW6432
    if (-not $machineArch) {
        $machineArch = $env:PROCESSOR_ARCHITECTURE
    }
    if ($machineArch -ne 'AMD64' -and $machineArch -ne 'ARM64') {
        throw "Unsupported CPU architecture: $machineArch. The Kaneo CLI for Windows runs on x64 and arm64 PCs."
    }
    $asset = 'kaneo-windows-x64.exe'

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    }

    $requested = $env:KANEO_VERSION
    if ($requested) {
        $version = $requested -replace '^cli-v', '' -replace '^v', ''
        if ($version -notmatch '^[0-9A-Za-z.+-]+$') {
            throw "KANEO_VERSION is not a valid version: $requested. Use a version such as 0.1.0."
        }
    }
    elseif ($env:KANEO_DOWNLOAD_URL) {
        throw 'KANEO_VERSION is required when KANEO_DOWNLOAD_URL is set, for example $env:KANEO_VERSION = "0.1.0".'
    }
    else {
        Write-Line 'Looking up the latest Kaneo CLI release...' 'DarkGray'
        $version = Get-LatestVersion
    }

    if ($env:KANEO_DOWNLOAD_URL) {
        $baseUrl = $env:KANEO_DOWNLOAD_URL.TrimEnd('/', '\')
    }
    else {
        $baseUrl = 'https://github.com/usekaneo/kaneo/releases/download'
    }
    $releaseUrl = "$baseUrl/cli-v$version"
    $sumsUrl = "$releaseUrl/SHA256SUMS"
    $assetUrl = "$releaseUrl/$asset"

    if ($env:KANEO_INSTALL_DIR) {
        $installDir = $env:KANEO_INSTALL_DIR
    }
    else {
        $installDir = Join-Path $env:LOCALAPPDATA 'Programs\kaneo'
    }
    $installDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($installDir).TrimEnd('\', '/')
    try {
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    }
    catch {
        throw "Could not create $installDir ($($_.Exception.Message)). Set KANEO_INSTALL_DIR to a directory you can write to."
    }
    $target = Join-Path $installDir 'kaneo.exe'
    if (Test-Path -LiteralPath $target -PathType Container) {
        throw "$target is a directory. Remove it or set KANEO_INSTALL_DIR to another directory."
    }

    Write-Line "Installing kaneo $version for windows x64" 'Cyan'
    Write-Line "From $assetUrl" 'DarkGray'

    $tempDir = Join-Path ([IO.Path]::GetTempPath()) ('kaneo-install-' + [guid]::NewGuid().ToString('N'))
    $staged = Join-Path $installDir ('.kaneo-' + [guid]::NewGuid().ToString('N').Substring(0, 12) + '.exe')
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    try {
        $sumsFile = Join-Path $tempDir 'SHA256SUMS'
        $result = Get-RemoteFile -Url $sumsUrl -OutFile $sumsFile
        if ($result -eq 'missing') {
            throw "Kaneo CLI $version was not found: $sumsUrl does not exist. Check the version at https://github.com/usekaneo/kaneo/releases."
        }
        if ($result -ne 'ok') {
            throw "Could not download $sumsUrl ($($result.Substring(8))). Check your internet connection and try again."
        }

        $expected = $null
        foreach ($line in Get-Content -LiteralPath $sumsFile) {
            $fields = $line.Trim() -split '\s+'
            if ($fields.Count -ge 2 -and ($fields[1] -eq $asset -or $fields[1] -eq "*$asset")) {
                $expected = $fields[0].ToLowerInvariant()
                break
            }
        }
        if (-not $expected) {
            throw "Kaneo CLI $version has no build named $asset. Check https://github.com/usekaneo/kaneo/releases for the files it provides."
        }
        if ($expected -notmatch '^[0-9a-f]{64}$') {
            throw "SHA256SUMS has an invalid checksum for $asset."
        }

        try {
            $result = Get-RemoteFile -Url $assetUrl -OutFile $staged
        }
        catch {
            throw "Could not write to $installDir ($($_.Exception.Message)). Set KANEO_INSTALL_DIR to a directory you can write to."
        }
        if ($result -eq 'missing') {
            throw "Kaneo CLI $version is missing the $asset file: $assetUrl was not found."
        }
        if ($result -ne 'ok') {
            throw "Could not download $assetUrl ($($result.Substring(8))). Check your internet connection and try again."
        }

        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $staged).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            throw "Checksum mismatch for ${asset}: expected $expected, got $actual. The download is corrupted or was changed, so nothing was installed."
        }

        $exitCode = 1
        try {
            $versionOutput = (& $staged --version) -join "`n"
            $exitCode = $LASTEXITCODE
        }
        catch {
            $versionOutput = $_.Exception.Message
        }
        if ($exitCode -ne 0) {
            throw "The downloaded kaneo does not run on this system, so nothing was installed. Output: $versionOutput"
        }

        try {
            if (Test-Path -LiteralPath $target) {
                [IO.File]::Replace($staged, $target, [NullString]::Value)
            }
            else {
                [IO.File]::Move($staged, $target)
            }
        }
        catch {
            throw "Could not replace $target ($($_.Exception.Message)). Close any running kaneo and run the installer again."
        }
    }
    finally {
        if (Test-Path -LiteralPath $staged) {
            Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $installedVersion = $version
    if ($versionOutput -match '"version"\s*:\s*"([^"]+)"') {
        $installedVersion = $Matches[1]
    }
    elseif ($versionOutput -match '(\S+)\s*$') {
        $installedVersion = $Matches[1]
    }
    $installedVersion = $installedVersion -replace '^v', ''
    Write-Line "Installed kaneo $installedVersion to $target" 'Green'

    $installKey = ConvertTo-PathKey $installDir
    $machineEntries = @(([string][Environment]::GetEnvironmentVariable('Path', 'Machine')) -split ';' | Where-Object { $_ })
    $userEntries = @((Get-UserPath) -split ';' | Where-Object { $_ })
    $onMachinePath = @($machineEntries | Where-Object { (ConvertTo-PathKey $_) -eq $installKey }).Count -gt 0
    $onUserPath = @($userEntries | Where-Object { (ConvertTo-PathKey $_) -eq $installKey }).Count -gt 0

    if (-not $onMachinePath -and -not $onUserPath) {
        $userEntries = @($installDir) + $userEntries
        Set-UserPath -Value ($userEntries -join ';')
        Write-Line ''
        Write-Line "Added $installDir to your user PATH. Open a new terminal to use kaneo."
    }

    $sessionEntries = @($env:Path -split ';' | Where-Object { $_ })
    if (@($sessionEntries | Where-Object { (ConvertTo-PathKey $_) -eq $installKey }).Count -eq 0) {
        $env:Path = "$installDir;$env:Path"
    }

    $first = Find-FirstKaneo -Directories ($machineEntries + $userEntries)
    if ($first -and (ConvertTo-PathKey (Split-Path -Parent $first)) -ne $installKey) {
        Write-Line ''
        Write-Warn "Another kaneo comes first on your PATH: $first"
        Write-Warn "New terminals run that one, not $target. It may be an older community CLI. Remove it, or move $installDir earlier in your PATH."
    }

    Write-Line ''
    Write-Line 'Run kaneo login to sign in, or kaneo --help to see every command.'
}

Install-KaneoCli
