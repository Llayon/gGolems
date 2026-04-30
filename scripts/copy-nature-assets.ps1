$src = 'D:\Programms\Max\GODOT\Golem\Stylized Nature MegaKit[Standard]\glTF'
$dst = 'D:\Programms\Max\GODOT\Golem\gGolems\public\assets\nature'

$files = @(
    'CommonTree_1.gltf', 'CommonTree_1.bin',
    'CommonTree_2.gltf', 'CommonTree_2.bin',
    'CommonTree_3.gltf', 'CommonTree_3.bin',
    'CommonTree_4.gltf', 'CommonTree_4.bin',
    'CommonTree_5.gltf', 'CommonTree_5.bin',
    'DeadTree_1.gltf', 'DeadTree_1.bin',
    'DeadTree_2.gltf', 'DeadTree_2.bin',
    'DeadTree_3.gltf', 'DeadTree_3.bin',
    'DeadTree_4.gltf', 'DeadTree_4.bin',
    'DeadTree_5.gltf', 'DeadTree_5.bin',
    'TwistedTree_1.gltf', 'TwistedTree_1.bin',
    'TwistedTree_2.gltf', 'TwistedTree_2.bin',
    'TwistedTree_3.gltf', 'TwistedTree_3.bin',
    'TwistedTree_4.gltf', 'TwistedTree_4.bin',
    'TwistedTree_5.gltf', 'TwistedTree_5.bin',
    'Pine_1.gltf', 'Pine_1.bin',
    'Pine_2.gltf', 'Pine_2.bin',
    'Pine_3.gltf', 'Pine_3.bin',
    'Pine_4.gltf', 'Pine_4.bin',
    'Pine_5.gltf', 'Pine_5.bin',
    'Bush_Common.gltf', 'Bush_Common.bin',
    'Rock_Medium_1.gltf', 'Rock_Medium_1.bin',
    'Rock_Medium_2.gltf', 'Rock_Medium_2.bin',
    'Rock_Medium_3.gltf', 'Rock_Medium_3.bin',
    'Bark_NormalTree.png', 'Bark_NormalTree_Normal.png',
    'Bark_DeadTree.png', 'Bark_DeadTree_Normal.png',
    'Bark_TwistedTree.png', 'Bark_TwistedTree_Normal.png',
    'Leaves_NormalTree.png', 'Leaves_NormalTree_C.png',
    'Leaves_TwistedTree.png', 'Leaves_TwistedTree_C.png',
    'Grass.png', 'Flowers.png', 'Mushrooms.png',
    'Rocks_Diffuse.png', 'Rocks_Desert_Diffuse.png', 'PathRocks_Diffuse.png'
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
