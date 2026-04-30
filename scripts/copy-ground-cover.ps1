$src = 'D:\Programms\Max\GODOT\Golem\Stylized Nature MegaKit[Standard]\glTF'
$dst = 'D:\Programms\Max\GODOT\Golem\gGolems\public\assets\nature'

$files = @(
    'Grass_Common_Short.gltf', 'Grass_Common_Short.bin',
    'Grass_Common_Tall.gltf', 'Grass_Common_Tall.bin',
    'Grass_Wispy_Short.gltf', 'Grass_Wispy_Short.bin',
    'Grass_Wispy_Tall.gltf', 'Grass_Wispy_Tall.bin',
    'Bush_Common_Flowers.gltf', 'Bush_Common_Flowers.bin',
    'Fern_1.gltf', 'Fern_1.bin',
    'Clover_1.gltf', 'Clover_1.bin',
    'Clover_2.gltf', 'Clover_2.bin',
    'Flower_3_Single.gltf', 'Flower_3_Single.bin',
    'Flower_3_Group.gltf', 'Flower_3_Group.bin',
    'Flower_4_Single.gltf', 'Flower_4_Single.bin',
    'Flower_4_Group.gltf', 'Flower_4_Group.bin',
    'Plant_1.gltf', 'Plant_1.bin',
    'Plant_1_Big.gltf', 'Plant_1_Big.bin',
    'Plant_7.gltf', 'Plant_7.bin',
    'Plant_7_Big.gltf', 'Plant_7_Big.bin',
    'Leaves_Pine.png', 'Leaves_Pine_C.png',
    'Leaves_GiantPine_C.png'
)

foreach ($f in $files) {
    $srcPath = Join-Path $src $f
    if (Test-Path -LiteralPath $srcPath) {
        Copy-Item -LiteralPath $srcPath -Destination $dst -Force
        Write-Host "Copied: $f"
    } else {
        Write-Host "Missing: $f" -ForegroundColor Yellow
    }
}
