import bpy
import os

output_dir = r"D:\Programms\Max\GODOT\Golem\gGolems\public\assets\nature"
os.makedirs(output_dir, exist_ok=True)

for img in bpy.data.images:
    if img.size[0] == 0 or img.size[1] == 0:
        continue
    
    # Skip non-texture images
    if not img.filepath:
        continue

    print(f"Processing: {img.name} ({img.size[0]}x{img.size[1]})")
    
    # Resize to 256 if larger
    if img.size[0] > 256 or img.size[1] > 256:
        img.scale(256, 256)
        print(f"  Resized to {img.size[0]}x{img.size[1]}")
    
    # Clean filename
    safe_name = img.name.replace(" ", "_").replace(".", "_").replace("(", "").replace(")", "")
    out_path = os.path.join(output_dir, f"ground_{safe_name}.png")
    
    img.filepath_raw = out_path
    img.file_format = 'PNG'
    img.save()
    print(f"  Saved to {out_path}")

print("Done.")
