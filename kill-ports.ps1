$ports = @(3000, 3001, 3002, 3003, 5173)

foreach ($port in $ports) {
    Write-Host "Checking port $port..."
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            Write-Host "  Killing process $processId on port $port"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  No process found on port $port"
    }
}

Write-Host "`nAll ports cleaned!"
