import bpy
import json
import pathlib
import sys


ARMATURE_NAME = "Armature"


def main():
    argv = sys.argv
    export_args = argv[argv.index("--") + 1 :] if "--" in argv else []
    output_arg = export_args[0] if export_args else "src/assets/mechs/KWII_source_low.glb"
    output_path = pathlib.Path(output_arg)
    if not output_path.is_absolute():
        output_path = pathlib.Path(bpy.path.abspath("//")) / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None or armature.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {ARMATURE_NAME}")

    armature.hide_set(False)
    armature.hide_viewport = False
    armature.hide_render = False

    mesh_objects = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.name.endswith("_low") and obj.parent == armature
    ]
    if not mesh_objects:
        raise RuntimeError("No *_low mesh objects parented to Armature were found")

    for obj in mesh_objects:
        for modifier in obj.modifiers:
            if modifier.type == "NODES":
                modifier.show_viewport = False
                modifier.show_render = False

    material_map_path = output_path.with_suffix(".materials.json")
    material_map = {
        obj.name: obj.material_slots[0].material.name
        for obj in mesh_objects
        if obj.material_slots and obj.material_slots[0].material is not None
    }
    material_map_path.write_text(json.dumps(material_map, indent=2), encoding="utf-8")

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        use_visible=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="PLACEHOLDER",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_current_frame=False,
        export_rest_position_armature=False,
        export_skins=True,
        export_influence_nb=4,
        export_all_influences=False,
        export_def_bones=True,
        export_lights=False,
        export_cameras=False,
    )

    print(
        "EXPORTED",
        {
            "output": str(output_path),
            "material_map": str(material_map_path),
            "mesh_count": len(mesh_objects),
            "materials": sorted(
                {
                    slot.material.name
                    for obj in mesh_objects
                    for slot in obj.material_slots
                    if slot.material is not None
                }
            ),
        },
    )


main()
