@echo off
echo Criando ZIP para envio...
echo.

REM Cria pasta temporária
if exist temp_dashboard rmdir /s /q temp_dashboard
mkdir temp_dashboard

REM Copia arquivos necessários
echo Copiando arquivos...
copy index.html temp_dashboard\
xcopy css temp_dashboard\css\ /E /I
xcopy js temp_dashboard\js\ /E /I
xcopy data temp_dashboard\data\ /E /I
xcopy assets temp_dashboard\assets\ /E /I

REM Compacta (requer PowerShell)
echo Criando arquivo ZIP...
powershell Compress-Archive -Path temp_dashboard\* -DestinationPath dashboard_fcv_envio.zip -Force

REM Limpa pasta temporária
rmdir /s /q temp_dashboard

echo.
echo ✅ Arquivo criado: dashboard_fcv_envio.zip
echo Pronto para enviar!
pause

