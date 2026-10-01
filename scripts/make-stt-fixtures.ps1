# Synthetic speech only, saved for repeatable local comparisons; nothing is played.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'output\stt-fixtures'
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$Cases = @(
    @{ language='en'; voice='Microsoft David Desktop'; text='Two enemies behind us. Fall back to the bridge.' },
    @{ language='en'; voice='Microsoft Zira Desktop'; text='Wait for me. Do not push alone. I have no ammo.' },
    @{ language='en'; voice='Microsoft David Desktop'; text='One on the roof. Throw a smoke and revive me.' },
    @{ language='th'; voice='Microsoft Pattara'; text='มีศัตรูสองคนอยู่ข้างหลัง ถอยกลับมาที่สะพาน' },
    @{ language='th'; voice='Microsoft Pattara'; text='รอฉันก่อน อย่าเข้าไปคนเดียว กระสุนหมดแล้ว' },
    @{ language='th'; voice='Microsoft Pattara'; text='มีคนอยู่บนหลังคา ปาระเบิดควันแล้วมาชุบฉันด้วย' }
)
$Format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$Index = 0
foreach ($Case in $Cases) {
    $Index++
    $Name = '{0}-{1}.wav' -f $Index, $Case.language
    $Synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $Synth.SelectVoice($Case.voice)
        $Synth.SetOutputToWaveFile((Join-Path $Out $Name), $Format)
        $Synth.Speak($Case.text)
    } finally { $Synth.Dispose() }
    $Case.file = $Name
}
$Cases | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Out 'references.json') -Encoding utf8
