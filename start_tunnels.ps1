$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$dir = "C:\Users\Gosha\Desktop\Yoz"

Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:3000" -WindowStyle Minimized -RedirectStandardError "$dir\tunnel_web.log"
Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:8000" -WindowStyle Minimized -RedirectStandardError "$dir\tunnel_api.log"
Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:9000" -WindowStyle Minimized -RedirectStandardError "$dir\tunnel_minio.log"

Write-Host "Tunnels started. Wait 15-20 seconds, then you can close this window."
Start-Sleep -Seconds 15
