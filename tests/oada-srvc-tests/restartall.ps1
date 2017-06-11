# if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) { Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs; exit }

$scriptpath = $MyInvocation.MyCommand.Path
$dir = Split-Path $scriptpath

cd $dir
cd ..

Write-Host
Write-Host "================================"
Write-Host "pwd ..."
Write-Host "================================"

Write-Host $pwd

Write-Host
Write-Host "================================"
Write-Host "docker-compose down ..."
Write-Host "================================"
docker-compose down

cd .\oada-srvc-tests\

Write-Host
Write-Host "================================"
Write-Host "Clear docker containers ..."
Write-Host "================================"
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker volume rm $(docker volume ls -q)

cd ..

Write-Host
Write-Host "================================"
Write-Host "Git: pull stuff ..."
Write-Host "================================"
git pull
# git submodule update --remote --merge

Write-Host
Write-Host "================================"
Write-Host "docker-compose build ..."
Write-Host "================================"
docker-compose build

Write-Host
Write-Host "================================"
Write-Host "Yarn install stuff ..."
Write-Host "================================"
docker-compose run --rm admin do-yarn-install.sh
docker-compose run --rm admin do-yarn-upgrade.sh

Write-Host
Write-Host "================================"
Write-Host "docker-compose up -d ..."
Write-Host "================================"
$env:DEBUG = "*"
docker-compose up --force-recreate -d

Write-Host
Write-Host "================================"
Write-Host "docker-compose ps ..."
Write-Host "================================"
docker-compose ps

Write-Host
Write-Host "================================"
Write-Host "Done! Press any key to exit..."
Write-Host "================================"
$x = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
