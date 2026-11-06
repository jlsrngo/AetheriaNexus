Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 1
$outFile = Join-Path (Get-Location) "apps\public\rust_voiceover.wav"
$synth.SetOutputToWaveFile($outFile)

$scriptText = @"
In 2006, an engineer named Graydon Hoare had to walk up twenty-one flights of stairs in his apartment building, because the elevator crashed from a C plus plus memory leak.
Frustrated by constant software crashes, he sat down at his kitchen table and drafted the blueprint for a new language.
His revolutionary idea was the Borrow Checker: mathematical compile-time memory safety with zero runtime cost and no garbage collector.
Today, that elevator crash powers the Linux kernel, Microsoft Windows, and the world's most critical cloud systems. This is Rust.
"@

$synth.Speak($scriptText)
$synth.Dispose()

Write-Output "Generated voiceover: $outFile"

