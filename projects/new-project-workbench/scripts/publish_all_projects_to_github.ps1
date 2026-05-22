param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,

  [ValidateSet("private", "public")]
  [string]$Visibility = "private",

  [string]$WorkbenchRepo = "new-project-workbench",
  [string]$PackagingRepo = "github-packaging-review",
  [string]$DefaultBranch = "main",

  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PackagingRoot = Join-Path $WorkspaceRoot "github-packaging-review"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,

    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [string[]]$Arguments = @()
  )

  $display = "$FilePath $($Arguments -join ' ')".Trim()
  Write-Host "[$WorkingDirectory] $display"

  if ($DryRun) {
    return
  }

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE`: $display"
    }
  }
  finally {
    Pop-Location
  }
}

function Get-CommandOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,

    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [string[]]$Arguments = @()
  )

  Push-Location $WorkingDirectory
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $output = & $FilePath @Arguments 2>$null
      $code = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    return [PSCustomObject]@{
      Code = $code
      Text = ($output -join "`n")
    }
  }
  finally {
    Pop-Location
  }
}

function Ensure-GitHubAuth {
  Invoke-Checked -WorkingDirectory $WorkspaceRoot -FilePath "gh" -Arguments @("auth", "status")
}

function Ensure-GitRepository {
  param([string]$RepoPath)

  if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
    Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("init")
  }
}

function Ensure-InitialBranch {
  param([string]$RepoPath)

  $head = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("rev-parse", "--verify", "HEAD")
  if ($head.Code -eq 0) {
    return
  }

  $branch = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("branch", "--show-current")
  if ($branch.Text.Trim() -ne $DefaultBranch) {
    Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("branch", "-M", $DefaultBranch)
  }
}

function Ensure-GitHubRepository {
  param(
    [string]$FullName,
    [string]$Description
  )

  if ($DryRun) {
    Invoke-Checked -WorkingDirectory $WorkspaceRoot -FilePath "gh" -Arguments @("repo", "view", $FullName, "--json", "nameWithOwner")
    Invoke-Checked -WorkingDirectory $WorkspaceRoot -FilePath "gh" -Arguments @(
      "repo",
      "create",
      $FullName,
      "--$Visibility",
      "--description",
      $Description
    )
    return
  }

  $existing = Get-CommandOutput -WorkingDirectory $WorkspaceRoot -FilePath "gh" -Arguments @("repo", "view", $FullName, "--json", "nameWithOwner")
  if ($existing.Code -eq 0) {
    Write-Host "GitHub repo exists: $FullName"
    return
  }

  $visibilityArg = "--$Visibility"
  Invoke-Checked -WorkingDirectory $WorkspaceRoot -FilePath "gh" -Arguments @(
    "repo",
    "create",
    $FullName,
    $visibilityArg,
    "--description",
    $Description
  )
}

function Ensure-Origin {
  param(
    [string]$RepoPath,
    [string]$FullName
  )

  $remoteUrl = "https://github.com/$FullName.git"
  $origin = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("remote", "get-url", "origin")

  if ($origin.Code -eq 0 -and $origin.Text.Trim()) {
    Write-Host "Origin already configured for $RepoPath`: $($origin.Text.Trim())"
    return
  }

  Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("remote", "add", "origin", $remoteUrl)
}

function Commit-IfNeeded {
  param(
    [string]$RepoPath,
    [string]$Message
  )

  Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("add", "-A")
  $status = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("status", "--porcelain")

  if (-not $status.Text.Trim()) {
    Write-Host "No changes to commit in $RepoPath"
    return
  }

  Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("commit", "-m", $Message)
}

function Push-CurrentBranch {
  param([string]$RepoPath)

  $head = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("rev-parse", "--verify", "HEAD")
  if ($head.Code -ne 0) {
    $branchName = $DefaultBranch
    Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("push", "-u", "origin", $branchName)
    return
  }

  $branch = Get-CommandOutput -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("branch", "--show-current")
  if (-not $branch.Text.Trim()) {
    Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("checkout", "-b", "main")
    $branchName = "main"
  }
  else {
    $branchName = $branch.Text.Trim()
  }

  Invoke-Checked -WorkingDirectory $RepoPath -FilePath "git" -Arguments @("push", "-u", "origin", $branchName)
}

Ensure-GitHubAuth

$repositories = @(
  @{
    Path = $WorkspaceRoot
    Name = $WorkbenchRepo
    Message = "Organize workbench projects"
    Description = "Categorized workbench for web apps, automation tools, and report builders."
  },
  @{
    Path = $PackagingRoot
    Name = $PackagingRepo
    Message = "Update packaging review project"
    Description = "Server-backed packaging review and voting workflow."
  }
)

foreach ($repo in $repositories) {
  $fullName = "$Owner/$($repo.Name)"
  Ensure-GitRepository -RepoPath $repo.Path
  Ensure-InitialBranch -RepoPath $repo.Path
  Ensure-GitHubRepository -FullName $fullName -Description $repo.Description
  Ensure-Origin -RepoPath $repo.Path -FullName $fullName
  Commit-IfNeeded -RepoPath $repo.Path -Message $repo.Message
  Push-CurrentBranch -RepoPath $repo.Path
}

Write-Host "Done. Uploaded categorized project repositories to GitHub."
